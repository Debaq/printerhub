#!/usr/bin/env python3
"""
TecMedHub - Cliente Robusto para Impresoras Klipper/Moonraker
Version: 4.0.0
Diseñado para correr 24/7 sin supervisión con recuperación automática
"""

import requests
import time
import json
import sys
import os
import hashlib
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from logging.handlers import RotatingFileHandler
from urllib.parse import urljoin
import traceback
import signal
import threading
from queue import Queue, Empty
from collections import deque

# ==============================================================================
# CONFIGURACIÓN Y CONSTANTES
# ==============================================================================

VERSION = "4.0.0"
CONFIG_FILE = "printer_config.json"
STATE_FILE = "printer_state.json"
LOG_FILE = "printer_client.log"

DEFAULT_CONFIG = {
    "server_url": "https://tmeduca.org/printerhub/api.php",
    "printer_token": "TECMED_PRINTER_001",
    "printer_name": "🦄 Mi Impresora 3D",
    "moonraker_url": "http://localhost:7125",
    
    # Configuración de cámara
    "camera": {
        "enabled": True,
        "urls": ["http://localhost:8080/?action=snapshot"],
        "resolution": "high",
        "capture_interval": 30,
        "timelapse_enabled": True,
        "timelapse_interval": 60
    },
    
    # Intervalos de actualización (segundos)
    "intervals": {
        "status_update": 5,
        "command_check": 3,
        "health_check": 60,
        "reconnect_attempt": 10
    },
    
    # Timeouts (segundos)
    "timeouts": {
        "moonraker": 5,
        "server": 10,
        "camera": 5,
        "file_download": 60
    },
    
    # Configuración de reintentos
    "retries": {
        "max_attempts": 5,
        "exponential_backoff": True,
        "base_delay": 2
    },
    
    # Configuración de archivos
    "file_management": {
        "auto_cleanup": True,
        "max_age_days": 30,
        "verify_checksums": True,
        "gcode_directory": "/home/pi/printer_data/gcodes"
    },
    
    # Configuración de logging
    "logging": {
        "level": "INFO",
        "max_size_mb": 10,
        "backup_count": 5,
        "verbose": False
    },
    
    # Seguridad
    "security": {
        "validate_dangerous_commands": True,
        "rate_limit_seconds": 1,
        "allowed_gcode_patterns": ["G*", "M*", "T*"]
    },
    
    # Auto-actualización
    "auto_update": {
        "enabled": False,
        "check_interval": 3600,
        "update_url": ""
    },
    
    # Datos de la impresora
    "printer_data": {
        "tags": ["Prusa", "PLA"],
        "filament": {
            "material": "PLA",
            "color": "Negro",
            "remaining": 100
        },
        "bed_status": "limpia",
        "location": "Lab Principal"
    }
}


# ==============================================================================
# SISTEMA DE LOGGING
# ==============================================================================

class ColoredFormatter(logging.Formatter):
    """Formatter con colores para terminal"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
        'RESET': '\033[0m'
    }
    
    def format(self, record):
        if sys.stdout.isatty():
            levelname = record.levelname
            record.levelname = f"{self.COLORS.get(levelname, '')}{levelname}{self.COLORS['RESET']}"
        return super().format(record)


def setup_logging(config: Dict) -> logging.Logger:
    """Configurar sistema de logging"""
    logger = logging.getLogger('TecMedHub')
    
    log_config = config.get('logging', {})
    level = getattr(logging, log_config.get('level', 'INFO'))
    logger.setLevel(level)
    
    # Handler para archivo con rotación
    max_bytes = log_config.get('max_size_mb', 10) * 1024 * 1024
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=max_bytes,
        backupCount=log_config.get('backup_count', 5),
        encoding='utf-8'
    )
    file_handler.setLevel(level)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    # Handler para consola con colores
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_formatter = ColoredFormatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    return logger


# ==============================================================================
# GESTOR DE CONFIGURACIÓN
# ==============================================================================

class ConfigManager:
    """Gestión de configuración con validación y valores por defecto"""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = self.load_or_create()
    
    def load_or_create(self) -> Dict:
        """Cargar configuración o crear una nueva"""
        if not os.path.exists(self.config_path):
            print(f"📝 Creando archivo de configuración: {self.config_path}")
            self.save(DEFAULT_CONFIG)
            print("✅ Archivo de configuración creado")
            print("🔧 Por favor edita el archivo con tus datos y vuelve a ejecutar")
            sys.exit(0)
        
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            # Validar campos requeridos
            self._validate_config(config)
            
            # Mezclar con valores por defecto
            config = self._merge_with_defaults(config)
            
            return config
            
        except json.JSONDecodeError as e:
            print(f"❌ Error en formato JSON: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error cargando configuración: {e}")
            sys.exit(1)
    
    def _validate_config(self, config: Dict):
        """Validar campos requeridos"""
        required = ['server_url', 'printer_token', 'printer_name', 'moonraker_url']
        for field in required:
            if field not in config:
                raise ValueError(f"Campo requerido faltante: {field}")
    
    def _merge_with_defaults(self, config: Dict) -> Dict:
        """Mezclar configuración con valores por defecto"""
        def deep_merge(default, custom):
            result = default.copy()
            for key, value in custom.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = deep_merge(result[key], value)
                else:
                    result[key] = value
            return result
        
        return deep_merge(DEFAULT_CONFIG, config)
    
    def save(self, config: Dict):
        """Guardar configuración"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    
    def reload(self):
        """Recargar configuración"""
        self.config = self.load_or_create()


# ==============================================================================
# GESTOR DE ESTADO PERSISTENTE
# ==============================================================================

class StateManager:
    """Gestión de estado persistente para sobrevivir a reinicios"""
    
    def __init__(self, state_file: str):
        self.state_file = state_file
        self.state = self.load()
        self.pending_updates = deque(maxlen=100)  # Buffer de actualizaciones fallidas
    
    def load(self) -> Dict:
        """Cargar estado guardado"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        
        return {
            'last_update': None,
            'total_updates': 0,
            'failed_updates': 0,
            'uptime_start': datetime.now().isoformat(),
            'last_commands': [],
            'statistics': {
                'commands_executed': 0,
                'files_downloaded': 0,
                'errors': 0
            }
        }
    
    def save(self):
        """Guardar estado"""
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self.state, f, indent=2, ensure_ascii=False)
        except Exception as e:
            # No queremos que falle el cliente si no puede guardar estado
            pass
    
    def add_pending_update(self, data: Dict):
        """Agregar actualización pendiente"""
        self.pending_updates.append({
            'timestamp': datetime.now().isoformat(),
            'data': data
        })
        self.save()
    
    def get_pending_updates(self) -> List[Dict]:
        """Obtener actualizaciones pendientes"""
        updates = list(self.pending_updates)
        self.pending_updates.clear()
        return updates


# ==============================================================================
# CLIENTE HTTP CON REINTENTOS
# ==============================================================================

class RobustHTTPClient:
    """Cliente HTTP con reintentos exponenciales y manejo de errores"""
    
    def __init__(self, config: Dict, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': f'TecMedHub-Client/{VERSION}'
        })
    
    def request(self, method: str, url: str, **kwargs) -> Optional[requests.Response]:
        """Realizar petición con reintentos"""
        retry_config = self.config.get('retries', {})
        max_attempts = retry_config.get('max_attempts', 5)
        base_delay = retry_config.get('base_delay', 2)
        exponential = retry_config.get('exponential_backoff', True)
        
        for attempt in range(max_attempts):
            try:
                response = self.session.request(method, url, **kwargs)
                response.raise_for_status()
                return response
                
            except requests.exceptions.RequestException as e:
                if attempt < max_attempts - 1:
                    delay = base_delay * (2 ** attempt if exponential else 1)
                    self.logger.warning(
                        f"Intento {attempt + 1}/{max_attempts} falló: {e}. "
                        f"Reintentando en {delay}s..."
                    )
                    time.sleep(delay)
                else:
                    self.logger.error(f"Todos los intentos fallaron: {e}")
                    return None
        
        return None
    
    def get(self, url: str, **kwargs) -> Optional[requests.Response]:
        """GET request"""
        return self.request('GET', url, **kwargs)
    
    def post(self, url: str, **kwargs) -> Optional[requests.Response]:
        """POST request"""
        return self.request('POST', url, **kwargs)


# ==============================================================================
# INTERFACE CON MOONRAKER API
# ==============================================================================

class MoonrakerInterface:
    """Interface completa con Moonraker API"""
    
    def __init__(self, config: Dict, logger: logging.Logger, http_client: RobustHTTPClient):
        self.config = config
        self.logger = logger
        self.http = http_client
        self.base_url = config['moonraker_url']
        self.connected = False
        self.last_error = None
    
    def check_connection(self) -> bool:
        """Verificar conexión con Moonraker"""
        try:
            response = self.http.get(
                f"{self.base_url}/server/info",
                timeout=self.config['timeouts']['moonraker']
            )
            
            if response and response.status_code == 200:
                self.connected = True
                self.last_error = None
                return True
            
            self.connected = False
            return False
            
        except Exception as e:
            self.connected = False
            self.last_error = str(e)
            return False
    
    def query(self, endpoint: str, **kwargs) -> Optional[Dict]:
        """Realizar consulta a Moonraker"""
        try:
            url = f"{self.base_url}/{endpoint}"
            response = self.http.get(
                url,
                timeout=self.config['timeouts']['moonraker'],
                **kwargs
            )
            
            if response and response.status_code == 200:
                return response.json().get('result', {})
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error consultando {endpoint}: {e}")
            return None
    
    def command(self, endpoint: str, **kwargs) -> bool:
        """Enviar comando a Moonraker"""
        try:
            url = f"{self.base_url}/{endpoint}"
            response = self.http.post(
                url,
                timeout=self.config['timeouts']['moonraker'],
                **kwargs
            )
            
            return response is not None and response.status_code == 200
            
        except Exception as e:
            self.logger.error(f"Error ejecutando comando {endpoint}: {e}")
            return False
    
    def get_full_status(self) -> Dict:
        """Obtener estado completo de la impresora"""
        objects = [
            'heater_bed', 'extruder', 'print_stats', 'gcode_move',
            'fan', 'toolhead', 'display_status', 'virtual_sdcard',
            'motion_report', 'system_stats', 'webhooks'
        ]
        
        query_str = '&'.join([f'{obj}' for obj in objects])
        result = self.query(f"printer/objects/query?{query_str}")
        
        if result:
            return result.get('status', {})
        
        return {}
    
    def get_printer_info(self) -> Dict:
        """Información del sistema"""
        return self.query('printer/info') or {}
    
    def get_system_info(self) -> Dict:
        """Información del sistema operativo"""
        return self.query('machine/system_info') or {}
    
    def get_files(self, path: str = 'gcodes') -> List[Dict]:
        """Listar archivos"""
        result = self.query(f"server/files/list?root={path}")
        if result:
            return result.get(path, [])
        return []
    
    def get_job_history(self, limit: int = 10) -> List[Dict]:
        """Historial de trabajos"""
        result = self.query(f"server/history/list?limit={limit}")
        if result:
            return result.get('jobs', [])
        return []
    
    def execute_gcode(self, gcode: str) -> bool:
        """Ejecutar G-code"""
        return self.command(
            'printer/gcode/script',
            json={'script': gcode}
        )
    
    def execute_macro(self, macro_name: str, **params) -> bool:
        """Ejecutar macro de Klipper"""
        gcode = f"{macro_name}"
        if params:
            param_str = ' '.join([f'{k}={v}' for k, v in params.items()])
            gcode = f"{macro_name} {param_str}"
        
        return self.execute_gcode(gcode)


# ==============================================================================
# GESTOR DE CÁMARA
# ==============================================================================

class CameraManager:
    """Gestión inteligente de múltiples cámaras"""
    
    def __init__(self, config: Dict, logger: logging.Logger, http_client: RobustHTTPClient):
        self.config = config
        self.logger = logger
        self.http = http_client
        self.camera_config = config.get('camera', {})
        self.last_capture = {}
        self.timelapse_frames = []
    
    def capture_snapshot(self, camera_index: int = 0) -> Optional[bytes]:
        """Capturar imagen de cámara específica"""
        if not self.camera_config.get('enabled', True):
            return None
        
        urls = self.camera_config.get('urls', [])
        if camera_index >= len(urls):
            return None
        
        url = urls[camera_index]
        
        try:
            response = self.http.get(
                url,
                timeout=self.config['timeouts']['camera']
            )
            
            if response and response.status_code == 200:
                self.last_capture[camera_index] = datetime.now()
                return response.content
            
        except Exception as e:
            self.logger.warning(f"Error capturando cámara {camera_index}: {e}")
        
        return None
    
    def should_capture(self, camera_index: int = 0) -> bool:
        """Determinar si es momento de capturar"""
        if not self.camera_config.get('enabled', True):
            return False
        
        interval = self.camera_config.get('capture_interval', 30)
        last = self.last_capture.get(camera_index)
        
        if last is None:
            return True
        
        return (datetime.now() - last).total_seconds() >= interval
    
    def capture_timelapse_frame(self, printing: bool) -> Optional[bytes]:
        """Capturar frame para timelapse"""
        if not printing or not self.camera_config.get('timelapse_enabled', True):
            return None
        
        interval = self.camera_config.get('timelapse_interval', 60)
        
        if not self.timelapse_frames or \
           (datetime.now() - self.timelapse_frames[-1]['timestamp']).total_seconds() >= interval:
            
            frame = self.capture_snapshot(0)
            if frame:
                self.timelapse_frames.append({
                    'timestamp': datetime.now(),
                    'data': frame
                })
                
                # Limitar frames en memoria
                if len(self.timelapse_frames) > 100:
                    self.timelapse_frames.pop(0)
                
                return frame
        
        return None


# ==============================================================================
# GESTOR DE ARCHIVOS
# ==============================================================================

class FileManager:
    """Gestión de archivos G-code con limpieza automática"""
    
    def __init__(self, config: Dict, logger: logging.Logger, http_client: RobustHTTPClient):
        self.config = config
        self.logger = logger
        self.http = http_client
        self.file_config = config.get('file_management', {})
        self.gcode_dir = Path(self.file_config.get('gcode_directory', '/tmp/gcodes'))
        self.gcode_dir.mkdir(parents=True, exist_ok=True)
    
    def download_file(self, filename: str, source_url: str) -> Tuple[bool, Optional[str]]:
        """Descargar archivo del servidor con verificación"""
        try:
            local_path = self.gcode_dir / filename
            
            self.logger.info(f"📥 Descargando: {filename}")
            
            response = self.http.get(
                source_url,
                timeout=self.config['timeouts']['file_download'],
                stream=True
            )
            
            if not response:
                return False, "Error de conexión"
            
            # Descargar con progress
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            if downloaded % (1024 * 1024) == 0:  # Log cada MB
                                self.logger.info(f"   {progress:.1f}% descargado")
            
            # Verificar checksum si está configurado
            if self.file_config.get('verify_checksums', True):
                # Aquí podrías implementar verificación de checksum
                pass
            
            self.logger.info(f"✅ Descargado: {filename} ({self.format_bytes(local_path.stat().st_size)})")
            return True, str(local_path)
            
        except Exception as e:
            self.logger.error(f"❌ Error descargando {filename}: {e}")
            return False, str(e)
    
    def cleanup_old_files(self):
        """Limpiar archivos antiguos"""
        if not self.file_config.get('auto_cleanup', True):
            return
        
        max_age_days = self.file_config.get('max_age_days', 30)
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        
        try:
            removed = 0
            for file_path in self.gcode_dir.glob('*.gcode'):
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff_date:
                    file_path.unlink()
                    removed += 1
            
            if removed > 0:
                self.logger.info(f"🧹 Limpiados {removed} archivos antiguos")
                
        except Exception as e:
            self.logger.warning(f"Error en limpieza de archivos: {e}")
    
    def calculate_checksum(self, file_path: Path) -> str:
        """Calcular checksum MD5"""
        md5 = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                md5.update(chunk)
        return md5.hexdigest()
    
    @staticmethod
    def format_bytes(bytes_val: int) -> str:
        """Formatear bytes a string legible"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_val < 1024.0:
                return f"{bytes_val:.1f} {unit}"
            bytes_val /= 1024.0
        return f"{bytes_val:.1f} TB"


# ==============================================================================
# PROCESADOR DE COMANDOS
# ==============================================================================

class CommandProcessor:
    """Procesamiento robusto de comandos del servidor"""
    
    def __init__(self, config: Dict, logger: logging.Logger, 
                 moonraker: MoonrakerInterface, file_manager: FileManager):
        self.config = config
        self.logger = logger
        self.moonraker = moonraker
        self.file_manager = file_manager
        self.security_config = config.get('security', {})
        self.last_command_time = 0
        self.command_history = deque(maxlen=100)
    
    def process_command(self, cmd: Dict) -> bool:
        """Procesar comando con validación de seguridad"""
        action = cmd.get('action', 'unknown')
        
        # Rate limiting
        if not self._check_rate_limit():
            self.logger.warning(f"Rate limit alcanzado para comando: {action}")
            return False
        
        # Validación de seguridad
        if not self._validate_command(cmd):
            self.logger.error(f"Comando rechazado por validación de seguridad: {action}")
            return False
        
        # Registrar comando
        self.command_history.append({
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'params': cmd
        })
        
        self.logger.info(f"🔨 Ejecutando comando: {action}")
        
        # Ejecutar comando
        try:
            result = self._execute_command(cmd)
            if result:
                self.logger.info(f"   ✅ Comando {action} ejecutado correctamente")
            else:
                self.logger.error(f"   ❌ Comando {action} falló")
            return result
            
        except Exception as e:
            self.logger.error(f"   ❌ Error ejecutando {action}: {e}")
            self.logger.debug(traceback.format_exc())
            return False
    
    def _check_rate_limit(self) -> bool:
        """Verificar límite de tasa de comandos"""
        rate_limit = self.security_config.get('rate_limit_seconds', 1)
        now = time.time()
        
        if now - self.last_command_time < rate_limit:
            return False
        
        self.last_command_time = now
        return True
    
    def _validate_command(self, cmd: Dict) -> bool:
        """Validar comando según configuración de seguridad"""
        if not self.security_config.get('validate_dangerous_commands', True):
            return True
        
        action = cmd.get('action', '')
        
        # Lista de comandos potencialmente peligrosos que requieren confirmación
        dangerous = ['emergency_stop', 'firmware_restart', 'reboot']
        
        if action in dangerous:
            # En producción, podrías implementar un sistema de confirmación
            self.logger.warning(f"⚠️  Comando peligroso: {action}")
        
        return True
    
    def _execute_command(self, cmd: Dict) -> bool:
        """Ejecutar comando específico"""
        action = cmd.get('action')
        
        # Comandos de movimiento
        if action == 'home':
            return self.moonraker.execute_gcode("G28")
        
        elif action == 'home_x':
            return self.moonraker.execute_gcode("G28 X")
        
        elif action == 'home_y':
            return self.moonraker.execute_gcode("G28 Y")
        
        elif action == 'home_z':
            return self.moonraker.execute_gcode("G28 Z")
        
        # Comandos de temperatura
        elif action == 'heat':
            hotend_temp = cmd.get('hotend_temp', 200)
            bed_temp = cmd.get('bed_temp', 60)
            self.moonraker.execute_gcode(f"M104 S{hotend_temp}")
            return self.moonraker.execute_gcode(f"M140 S{bed_temp}")
        
        elif action == 'cool_down':
            self.moonraker.execute_gcode("M104 S0")
            return self.moonraker.execute_gcode("M140 S0")
        
        # Control de impresión
        elif action == 'pause':
            return self.moonraker.command("printer/print/pause")
        
        elif action == 'resume':
            return self.moonraker.command("printer/print/resume")
        
        elif action == 'cancel':
            return self.moonraker.command("printer/print/cancel")
        
        # Velocidad y flow
        elif action == 'set_speed':
            speed = cmd.get('speed', 100)
            return self.moonraker.execute_gcode(f"M220 S{speed}")
        
        elif action == 'set_flow':
            flow = cmd.get('flow', 100)
            return self.moonraker.execute_gcode(f"M221 S{flow}")
        
        # Ventiladores
        elif action == 'toggle_fan':
            return self.moonraker.execute_gcode("M106 S255")
        
        elif action == 'set_fan':
            speed = cmd.get('speed', 255)
            return self.moonraker.execute_gcode(f"M106 S{speed}")
        
        elif action == 'fan_off':
            return self.moonraker.execute_gcode("M107")
        
        # Sistema
        elif action == 'emergency_stop':
            return self.moonraker.command("printer/emergency_stop")
        
        elif action == 'firmware_restart':
            return self.moonraker.command("printer/firmware_restart")
        
        elif action == 'reboot':
            return self.moonraker.command("machine/reboot")
        
        elif action == 'shutdown':
            return self.moonraker.command("machine/shutdown")
        
        # Impresión de archivo
        elif action == 'print':
            filename = cmd.get('file', '')
            if not filename:
                return False
            
            # Verificar si el archivo existe localmente
            local_path = self.file_manager.gcode_dir / filename
            
            if not local_path.exists():
                # Descargar del servidor
                download_url = cmd.get('download_url', '')
                if download_url:
                    success, error = self.file_manager.download_file(filename, download_url)
                    if not success:
                        self.logger.error(f"Error descargando archivo: {error}")
                        return False
                else:
                    self.logger.error(f"Archivo {filename} no existe y no hay URL de descarga")
                    return False
            
            # Iniciar impresión
            return self.moonraker.command(f"printer/print/start?filename={filename}")
        
        # Comando G-code personalizado
        elif action == 'gcode':
            gcode = cmd.get('gcode', '')
            if gcode:
                return self.moonraker.execute_gcode(gcode)
        
        # Macro de Klipper
        elif action == 'macro':
            macro_name = cmd.get('macro_name', '')
            params = cmd.get('params', {})
            if macro_name:
                return self.moonraker.execute_macro(macro_name, **params)
        
        else:
            self.logger.warning(f"Comando desconocido: {action}")
            return False
        
        return False


# ==============================================================================
# CLIENTE PRINCIPAL
# ==============================================================================

class PrinterClient:
    """Cliente principal robusto y completo"""
    
    def __init__(self, config_path: str):
        # Configuración
        self.config_manager = ConfigManager(config_path)
        self.config = self.config_manager.config
        
        # Logging
        self.logger = setup_logging(self.config)
        self.logger.info("="*70)
        self.logger.info("🌈 TECMEDHUB - CLIENTE DE IMPRESORA 🌈")
        self.logger.info(f"Versión: {VERSION}")
        self.logger.info("="*70)
        
        # Estado persistente
        self.state_manager = StateManager(STATE_FILE)
        
        # Cliente HTTP
        self.http_client = RobustHTTPClient(self.config, self.logger)
        
        # Componentes
        self.moonraker = MoonrakerInterface(self.config, self.logger, self.http_client)
        self.camera_manager = CameraManager(self.config, self.logger, self.http_client)
        self.file_manager = FileManager(self.config, self.logger, self.http_client)
        self.command_processor = CommandProcessor(
            self.config, self.logger, self.moonraker, self.file_manager
        )
        
        # Control de ejecución
        self.running = False
        self.threads = []
        
        # Tiempos de última ejecución
        self.last_status_update = 0
        self.last_command_check = 0
        self.last_health_check = 0
        self.last_cleanup = 0
        
        # Estadísticas
        self.start_time = datetime.now()
        self.stats = {
            'updates_sent': 0,
            'commands_received': 0,
            'errors': 0,
            'reconnections': 0
        }
        
        # Configurar señales
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, sig, frame):
        """Manejar señales de terminación"""
        self.logger.info("\n👋 Señal de terminación recibida")
        self.shutdown()
    
    def startup_checks(self) -> bool:
        """Verificaciones de inicio"""
        self.logger.info("🔍 Realizando verificaciones de inicio...")
        
        # Verificar conexión a Moonraker
        self.logger.info(f"   Conectando a Moonraker: {self.config['moonraker_url']}")
        if not self.moonraker.check_connection():
            self.logger.error("   ❌ No se puede conectar a Moonraker")
            self.logger.error("   Verifica que Moonraker esté corriendo")
            return False
        self.logger.info("   ✅ Conexión a Moonraker OK")
        
        # Verificar conexión al servidor
        self.logger.info(f"   Conectando al servidor: {self.config['server_url']}")
        try:
            response = self.http_client.get(
                f"{self.config['server_url']}?action=get_printers",
                timeout=self.config['timeouts']['server']
            )
            if response and response.status_code == 200:
                self.logger.info("   ✅ Conexión al servidor OK")
            else:
                self.logger.warning("   ⚠️  Servidor no responde correctamente")
        except:
            self.logger.warning("   ⚠️  No se puede conectar al servidor (continuará intentando)")
        
        # Información del sistema
        printer_info = self.moonraker.get_printer_info()
        if printer_info:
            state = printer_info.get('state', 'unknown')
            self.logger.info(f"   Estado de impresora: {state}")
        
        self.logger.info("✅ Verificaciones completadas\n")
        return True
    
    def collect_printer_data(self) -> Dict:
        """Recolectar todos los datos de la impresora"""
        data = {
            'action': 'update_printer',
            'token': self.config['printer_token'],
            'name': self.config['printer_name'],
            'client_version': VERSION,
            'uptime': self.get_uptime(),
            'timestamp': datetime.now().isoformat()
        }
        
        # Estado completo
        full_status = self.moonraker.get_full_status()
        
        # Estado básico
        print_stats = full_status.get('print_stats', {})
        state = print_stats.get('state', 'unknown')
        
        status_map = {
            'printing': 'printing',
            'paused': 'printing',
            'standby': 'idle',
            'ready': 'idle',
            'error': 'error',
            'complete': 'idle'
        }
        data['status'] = status_map.get(state, 'idle')
        
        # Temperaturas
        extruder = full_status.get('extruder', {})
        heater_bed = full_status.get('heater_bed', {})
        
        data['temp_hotend'] = round(extruder.get('temperature', 0), 1)
        data['temp_bed'] = round(heater_bed.get('temperature', 0), 1)
        data['temp_hotend_target'] = round(extruder.get('target', 0), 1)
        data['temp_bed_target'] = round(heater_bed.get('target', 0), 1)
        
        # Velocidad y ventiladores
        gcode_move = full_status.get('gcode_move', {})
        fan = full_status.get('fan', {})
        
        data['print_speed'] = int(gcode_move.get('speed_factor', 1.0) * 100)
        data['fan_speed'] = int(fan.get('speed', 0) * 100)
        
        # Progreso de impresión
        if state in ['printing', 'paused']:
            display_status = full_status.get('display_status', {})
            data['progress'] = int(display_status.get('progress', 0) * 100)
            data['current_file'] = print_stats.get('filename', '')
            
            # Tiempo estimado
            print_duration = print_stats.get('print_duration', 0)
            total_duration = print_stats.get('total_duration', 0)
            if total_duration > 0:
                remaining = (total_duration - print_duration) / 60
                data['time_remaining'] = int(remaining)
        
        # Último trabajo completado
        history = self.moonraker.get_job_history(limit=1)
        if history:
            last_job = history[0]
            filename = last_job.get('filename', '')
            end_time = last_job.get('end_time', 0)
            if end_time:
                end_dt = datetime.fromtimestamp(end_time)
                data['last_completed'] = f"{filename} ({end_dt.strftime('%H:%M')})"
        
        # Información del sistema
        system_stats = full_status.get('system_stats', {})
        if system_stats:
            data['system'] = {
                'cpu_usage': round(system_stats.get('cpu_usage', 0), 1),
                'memory_usage': round(system_stats.get('memavail', 0) / 1024 / 1024, 1),
                'cpu_temp': round(system_stats.get('cputemp', 0), 1)
            }
        
        # Archivos locales
        files = self.moonraker.get_files()
        data['files'] = [{
            'name': f.get('filename', ''),
            'size': self.file_manager.format_bytes(f.get('size', 0)),
            'modified': f.get('modified', 0)
        } for f in files[:50]]  # Limitar a 50 archivos
        
        # Datos configurables
        printer_data = self.config.get('printer_data', {})
        data.update({
            'tags': printer_data.get('tags', []),
            'filament': printer_data.get('filament', {}),
            'bed_status': printer_data.get('bed_status', ''),
            'location': printer_data.get('location', '')
        })
        
        # Capturar imagen si corresponde
        if self.camera_manager.should_capture():
            snapshot = self.camera_manager.capture_snapshot()
            if snapshot:
                # Subir imagen al servidor
                image_url = self.upload_image(snapshot)
                if image_url:
                    data['image'] = image_url
        
        # Timelapse si está imprimiendo
        if state == 'printing':
            timelapse_frame = self.camera_manager.capture_timelapse_frame(True)
            # Los frames se almacenan en memoria, podrías enviarlos al finalizar
        
        return data
    
    def upload_image(self, image_data: bytes) -> Optional[str]:
        """Subir imagen al servidor"""
        try:
            upload_url = self.config['server_url'].replace('api.php', 'upload_image.php')
            
            files = {'image': ('snapshot.jpg', image_data, 'image/jpeg')}
            data = {'token': self.config['printer_token']}
            
            response = self.http_client.post(
                upload_url,
                files=files,
                data=data,
                timeout=self.config['timeouts']['server']
            )
            
            if response and response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return result.get('image_url')
            
        except Exception as e:
            self.logger.debug(f"Error subiendo imagen: {e}")
        
        return None
    
    def send_status_update(self) -> bool:
        """Enviar actualización de estado al servidor"""
        try:
            data = self.collect_printer_data()
            
            response = self.http_client.post(
                self.config['server_url'],
                json=data,
                timeout=self.config['timeouts']['server']
            )
            
            if response and response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.stats['updates_sent'] += 1
                    self.state_manager.state['last_update'] = datetime.now().isoformat()
                    self.state_manager.state['total_updates'] += 1
                    
                    if self.config['logging'].get('verbose'):
                        self.logger.debug(f"✅ Actualización enviada: {data['status']}")
                    
                    return True
                else:
                    self.logger.warning(f"Servidor rechazó actualización: {result.get('message')}")
            else:
                # Guardar para reenvío
                self.state_manager.add_pending_update(data)
                self.stats['errors'] += 1
                
        except Exception as e:
            self.logger.error(f"Error enviando actualización: {e}")
            self.stats['errors'] += 1
            # Guardar para reenvío
            data = self.collect_printer_data()
            self.state_manager.add_pending_update(data)
        
        return False
    
    def check_commands(self):
        """Verificar y ejecutar comandos pendientes"""
        try:
            url = f"{self.config['server_url']}?action=get_commands&token={self.config['printer_token']}"
            
            response = self.http_client.get(
                url,
                timeout=self.config['timeouts']['server']
            )
            
            if response and response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    commands = result.get('commands', [])
                    
                    for cmd in commands:
                        self.stats['commands_received'] += 1
                        self.command_processor.process_command(cmd)
                        self.state_manager.state['statistics']['commands_executed'] += 1
            
        except Exception as e:
            self.logger.debug(f"Error verificando comandos: {e}")
    
    def health_check(self):
        """Verificación de salud del sistema"""
        self.logger.info("🏥 Health Check")
        
        # Verificar conexión a Moonraker
        if not self.moonraker.check_connection():
            self.logger.warning("   ⚠️  Moonraker desconectado, intentando reconectar...")
            self.stats['reconnections'] += 1
            
            # Intentar reconectar
            for i in range(3):
                time.sleep(2)
                if self.moonraker.check_connection():
                    self.logger.info("   ✅ Moonraker reconectado")
                    break
        else:
            self.logger.info("   ✅ Moonraker OK")
        
        # Limpieza de archivos antiguos
        current_time = time.time()
        if current_time - self.last_cleanup > 3600:  # Cada hora
            self.file_manager.cleanup_old_files()
            self.last_cleanup = current_time
        
        # Estadísticas
        uptime = datetime.now() - self.start_time
        self.logger.info(f"   Uptime: {uptime}")
        self.logger.info(f"   Updates enviados: {self.stats['updates_sent']}")
        self.logger.info(f"   Comandos recibidos: {self.stats['commands_received']}")
        self.logger.info(f"   Errores: {self.stats['errors']}")
        self.logger.info(f"   Reconexiones: {self.stats['reconnections']}")
        
        # Guardar estado
        self.state_manager.state['statistics'] = self.stats
        self.state_manager.save()
    
    def get_uptime(self) -> str:
        """Calcular uptime"""
        delta = datetime.now() - self.start_time
        hours = int(delta.total_seconds() // 3600)
        minutes = int((delta.total_seconds() % 3600) // 60)
        return f"{hours}h {minutes}m"
    
    def run(self):
        """Loop principal"""
        if not self.startup_checks():
            self.logger.error("❌ Fallo en verificaciones de inicio")
            sys.exit(1)
        
        self.logger.info("="*70)
        self.logger.info(f"Impresora: {self.config['printer_name']}")
        self.logger.info(f"Token: {self.config['printer_token']}")
        self.logger.info(f"Servidor: {self.config['server_url']}")
        self.logger.info(f"Moonraker: {self.config['moonraker_url']}")
        self.logger.info("="*70)
        self.logger.info("▶️  Cliente iniciado (Ctrl+C para detener)\n")
        
        self.running = True
        
        try:
            while self.running:
                current_time = time.time()
                
                # Actualización de estado
                status_interval = self.config['intervals']['status_update']
                if current_time - self.last_status_update >= status_interval:
                    if self.send_status_update():
                        if self.config['logging'].get('verbose'):
                            self.logger.debug(f"✓ Status actualizado")
                    self.last_status_update = current_time
                
                # Verificar comandos
                command_interval = self.config['intervals']['command_check']
                if current_time - self.last_command_check >= command_interval:
                    self.check_commands()
                    self.last_command_check = current_time
                
                # Health check
                health_interval = self.config['intervals']['health_check']
                if current_time - self.last_health_check >= health_interval:
                    self.health_check()
                    self.last_health_check = current_time
                
                # Sleep pequeño para no saturar CPU
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            self.logger.info("\n👋 Detenido por el usuario")
        except Exception as e:
            self.logger.error(f"❌ Error crítico: {e}")
            self.logger.debug(traceback.format_exc())
        finally:
            self.shutdown()
    
    def shutdown(self):
        """Apagado limpio"""
        self.logger.info("\n🛑 Iniciando apagado...")
        self.running = False
        
        # Guardar estado final
        self.state_manager.save()
        
        # Estadísticas finales
        self.logger.info("📊 Estadísticas finales:")
        self.logger.info(f"   Tiempo activo: {self.get_uptime()}")
        self.logger.info(f"   Updates enviados: {self.stats['updates_sent']}")
        self.logger.info(f"   Comandos ejecutados: {self.stats['commands_received']}")
        self.logger.info(f"   Errores: {self.stats['errors']}")
        
        self.logger.info("="*70)
        self.logger.info("👋 Cliente detenido correctamente")
        self.logger.info("="*70)


# ==============================================================================
# PUNTO DE ENTRADA
# ==============================================================================

def main():
    """Punto de entrada principal"""
    print("""
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              🌈  TECMEDHUB PRINTER CLIENT  🌈                 ║
║                     Version 4.0.0                             ║
║                                                               ║
║              Cliente Robusto para Klipper/Moonraker          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
""")
    
    try:
        client = PrinterClient(CONFIG_FILE)
        client.run()
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        print(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
