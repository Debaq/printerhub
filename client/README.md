# TecMedHub - Cliente Robusto para Impresoras Klipper v4.0

## 🎯 Objetivo

Cliente Python **bulletproof** para conectar impresoras con Klipper/Moonraker a tu servidor PHP. Diseñado para correr 24/7 sin supervisión con recuperación automática de cualquier error.

## ✨ Características Principales

### 🛡️ Robustez y Recuperación
- ✅ Reconexión automática si pierde conexión con Moonraker
- ✅ Reconexión automática si pierde conexión con servidor PHP
- ✅ Sistema de reintentos exponenciales configurable
- ✅ Modo degradado (sigue funcionando si falla cámara u otros componentes)
- ✅ Persistencia de datos durante desconexiones
- ✅ Recuperación automática de errores

### ⚙️ Configuración Total por JSON
- ✅ **NUNCA** necesitas editar el `.py`, todo se configura en `printer_config.json`
- ✅ Intervalos configurables para updates, cámara, comandos
- ✅ Timeouts configurables
- ✅ Reintentos configurables
- ✅ Logging configurable

### 🎮 Sistema de Comandos Extensible
- ✅ Soporte para comandos básicos (home, heat, pause, resume, etc.)
- ✅ Soporte para G-codes personalizados
- ✅ Soporte para macros de Klipper con parámetros
- ✅ Sistema de validación y seguridad
- ✅ Rate limiting para evitar spam

### 📊 Información Completa
- ✅ Todo lo que Moonraker API puede proporcionar
- ✅ Temperaturas, velocidades, progreso
- ✅ Estado de componentes (fans, heaters, etc.)
- ✅ Estadísticas de sistema (CPU, RAM, red)
- ✅ Historial de trabajos
- ✅ Lista de archivos locales

### 📷 Cámara Inteligente
- ✅ Soporte para múltiples cámaras
- ✅ Captura solo cuando es necesario (ahorra ancho de banda)
- ✅ Timelapse automático durante impresión
- ✅ Fallback si cámara no responde

### 📁 Gestión Avanzada de Archivos
- ✅ Descarga de archivos desde servidor PHP
- ✅ Verificación de integridad con checksums
- ✅ Limpieza automática de archivos antiguos
- ✅ Progress de descargas

### 📝 Logging y Debugging
- ✅ Logs rotativos con tamaño configurable
- ✅ Múltiples niveles de logging (DEBUG, INFO, WARNING, ERROR)
- ✅ Colores en terminal para mejor legibilidad
- ✅ Modo verbose opcional

### 🔒 Seguridad
- ✅ Validación de comandos peligrosos
- ✅ Token de autenticación
- ✅ Rate limiting
- ✅ Whitelist de comandos G-code

## 📦 Instalación

### Requisitos
- Python 3.7+
- Impresora con Klipper/Moonraker
- Conexión a internet

### Dependencias
```bash
pip install requests
```

Eso es todo. El cliente usa solo la librería estándar de Python más `requests`.

## 🚀 Uso

### Primera vez

1. **Copiar el cliente a tu Raspberry Pi:**
```bash
scp klipper_client.py pi@tu-impresora:/home/pi/
```

2. **Ejecutar por primera vez** (creará el archivo de configuración):
```bash
python3 klipper_client.py
```

3. **Editar `printer_config.json`** con tus datos:
```bash
nano printer_config.json
```

Campos importantes a configurar:
- `server_url`: URL de tu servidor PHP
- `printer_token`: Token único para esta impresora
- `printer_name`: Nombre descriptivo
- `moonraker_url`: URL de Moonraker (usualmente http://localhost:7125)
- `camera.urls`: URL(s) de tu(s) cámara(s)

4. **Ejecutar nuevamente:**
```bash
python3 klipper_client.py
```

### Ejecutar como servicio (recomendado)

Para que se ejecute automáticamente al iniciar y se reinicie si falla:

1. **Crear archivo de servicio systemd:**
```bash
sudo nano /etc/systemd/system/tecmedhub-client.service
```

2. **Contenido del archivo:**
```ini
[Unit]
Description=TecMedHub Printer Client
After=network.target moonraker.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/klipper_client.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. **Habilitar y arrancar el servicio:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable tecmedhub-client
sudo systemctl start tecmedhub-client
```

4. **Ver logs en tiempo real:**
```bash
sudo journalctl -u tecmedhub-client -f
```

## 📖 Configuración Detallada

### Estructura de `printer_config.json`

```json
{
    // URLs y conexión básica
    "server_url": "https://tmeduca.org/printerhub/api.php",
    "printer_token": "TECMED_PRINTER_001",
    "printer_name": "🦄 Mi Impresora 3D",
    "moonraker_url": "http://localhost:7125",
    
    // Configuración de cámara
    "camera": {
        "enabled": true,
        "urls": ["http://localhost:8080/?action=snapshot"],
        "capture_interval": 30,
        "timelapse_enabled": true,
        "timelapse_interval": 60
    },
    
    // Intervalos (segundos)
    "intervals": {
        "status_update": 5,      // Cada cuánto envía el estado
        "command_check": 3,      // Cada cuánto verifica comandos
        "health_check": 60,      // Cada cuánto hace health check
        "reconnect_attempt": 10  // Delay entre intentos de reconexión
    },
    
    // Timeouts (segundos)
    "timeouts": {
        "moonraker": 5,      // Timeout para Moonraker
        "server": 10,        // Timeout para servidor PHP
        "camera": 5,         // Timeout para captura de cámara
        "file_download": 60  // Timeout para descarga de archivos
    },
    
    // Configuración de reintentos
    "retries": {
        "max_attempts": 5,           // Máximo de intentos
        "exponential_backoff": true, // Duplicar delay en cada intento
        "base_delay": 2             // Delay base en segundos
    },
    
    // Gestión de archivos
    "file_management": {
        "auto_cleanup": true,
        "max_age_days": 30,
        "verify_checksums": true,
        "gcode_directory": "/home/pi/printer_data/gcodes"
    },
    
    // Logging
    "logging": {
        "level": "INFO",        // DEBUG, INFO, WARNING, ERROR, CRITICAL
        "max_size_mb": 10,     // Tamaño máximo de cada log
        "backup_count": 5,     // Cantidad de backups a mantener
        "verbose": false       // Mostrar más detalles
    },
    
    // Seguridad
    "security": {
        "validate_dangerous_commands": true,
        "rate_limit_seconds": 1,
        "allowed_gcode_patterns": ["G*", "M*", "T*"]
    },
    
    // Datos de la impresora
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
```

## 🎮 Comandos Soportados

El cliente puede recibir y ejecutar estos comandos desde el servidor PHP:

### Comandos de Movimiento
- `home` - Home todos los ejes
- `home_x` - Home eje X
- `home_y` - Home eje Y
- `home_z` - Home eje Z

### Comandos de Temperatura
- `heat` - Calentar (params: `hotend_temp`, `bed_temp`)
- `cool_down` - Apagar calentadores

### Control de Impresión
- `pause` - Pausar impresión
- `resume` - Reanudar impresión
- `cancel` - Cancelar impresión
- `print` - Iniciar impresión (params: `file`, `download_url`)

### Velocidad y Flow
- `set_speed` - Ajustar velocidad (params: `speed` 50-200%)
- `set_flow` - Ajustar flow (params: `flow` 75-125%)

### Ventiladores
- `toggle_fan` - Encender/apagar ventilador
- `set_fan` - Ajustar velocidad ventilador (params: `speed` 0-255)
- `fan_off` - Apagar ventilador

### Comandos de Sistema
- `emergency_stop` - Stop de emergencia
- `firmware_restart` - Reiniciar firmware
- `reboot` - Reiniciar sistema
- `shutdown` - Apagar sistema

### Comandos Personalizados
- `gcode` - Ejecutar G-code (params: `gcode`)
- `macro` - Ejecutar macro Klipper (params: `macro_name`, `params`)

### Ejemplo de envío desde PHP:

```php
// Comando simple
$commands[] = [
    'id' => uniqid('cmd_'),
    'token' => $token,
    'action' => 'home',
    'timestamp' => time()
];

// Comando con parámetros
$commands[] = [
    'id' => uniqid('cmd_'),
    'token' => $token,
    'action' => 'heat',
    'hotend_temp' => 210,
    'bed_temp' => 60,
    'timestamp' => time()
];

// Comando G-code personalizado
$commands[] = [
    'id' => uniqid('cmd_'),
    'token' => $token,
    'action' => 'gcode',
    'gcode' => 'G28 X Y',
    'timestamp' => time()
];

// Ejecutar macro con parámetros
$commands[] = [
    'id' => uniqid('cmd_'),
    'token' => $token,
    'action' => 'macro',
    'macro_name' => 'LOAD_FILAMENT',
    'params' => [
        'TEMP' => 210,
        'LENGTH' => 50
    ],
    'timestamp' => time()
];
```

## 📊 Datos Enviados al Servidor

El cliente envía esta información al servidor:

```json
{
    "action": "update_printer",
    "token": "TECMED_PRINTER_001",
    "name": "🦄 Mi Impresora",
    "client_version": "4.0.0",
    "status": "printing|idle|error|offline",
    "temp_hotend": 210.5,
    "temp_bed": 60.0,
    "temp_hotend_target": 210.0,
    "temp_bed_target": 60.0,
    "print_speed": 100,
    "fan_speed": 75,
    "progress": 45,
    "current_file": "modelo.gcode",
    "time_remaining": 120,
    "last_completed": "pieza.gcode (14:30)",
    "uptime": "5h 23m",
    "system": {
        "cpu_usage": 45.2,
        "memory_usage": 512.5,
        "cpu_temp": 55.3
    },
    "files": [...],
    "tags": ["Prusa", "PLA"],
    "filament": {...},
    "bed_status": "limpia",
    "location": "Lab Principal",
    "image": "printer_images/snapshot.jpg?t=..."
}
```

## 🔧 Mantenimiento

### Ver logs
```bash
# Logs del servicio
sudo journalctl -u tecmedhub-client -f

# Logs del archivo
tail -f /home/pi/printer_client.log
```

### Reiniciar servicio
```bash
sudo systemctl restart tecmedhub-client
```

### Recargar configuración
El cliente recarga automáticamente la configuración al reiniciar el servicio.

### Ver estado
```bash
sudo systemctl status tecmedhub-client
```

## 🐛 Troubleshooting

### El cliente no se conecta a Moonraker
1. Verificar que Moonraker esté corriendo: `systemctl status moonraker`
2. Verificar la URL en config: debe ser `http://localhost:7125`
3. Ver logs: `journalctl -u moonraker -f`

### El cliente no envía datos al servidor
1. Verificar conectividad: `ping tmeduca.org`
2. Verificar URL del servidor en config
3. Verificar token de impresora
4. Ver logs del cliente para errores HTTP

### La cámara no funciona
1. Verificar que mjpg-streamer esté corriendo
2. Probar la URL manualmente: `curl http://localhost:8080/?action=snapshot -o test.jpg`
3. Si no funciona, desactivar en config: `"camera": {"enabled": false}`

### Archivos no se descargan
1. Verificar permisos en directorio gcodes
2. Verificar espacio disponible: `df -h`
3. Ver logs para errores de descarga

## 📈 Estadísticas y Monitoreo

El cliente mantiene estadísticas en `printer_state.json`:
- Total de actualizaciones enviadas
- Comandos ejecutados
- Errores encontrados
- Tiempo de actividad
- Última actualización

## 🔄 Actualización del Cliente

Para actualizar a una nueva versión:

1. Detener el servicio:
```bash
sudo systemctl stop tecmedhub-client
```

2. Hacer backup de la configuración:
```bash
cp printer_config.json printer_config.json.backup
```

3. Reemplazar el archivo Python:
```bash
scp nuevo_klipper_client.py pi@tu-impresora:/home/pi/klipper_client.py
```

4. Iniciar el servicio:
```bash
sudo systemctl start tecmedhub-client
```

Tu configuración se mantiene intacta.

## ⚡ Optimización de Rendimiento

### Reducir uso de ancho de banda:
- Aumentar `intervals.status_update` a 10-15 segundos
- Aumentar `camera.capture_interval` a 60 segundos o más
- Desactivar timelapse: `"timelapse_enabled": false`

### Reducir uso de CPU:
- Desactivar verbose: `"logging": {"verbose": false}`
- Nivel de logging menos detallado: `"level": "WARNING"`

### Para conexiones lentas:
- Aumentar todos los timeouts
- Reducir `retries.max_attempts` a 3
- Desactivar cámara si no es esencial

## 📝 Notas Importantes

1. **NO EDITES el archivo .py** - Todo se configura en el JSON
2. El cliente está diseñado para recuperarse de cualquier error automáticamente
3. Si algo falla, revisa los logs primero
4. La configuración se puede cambiar sin modificar código
5. Puedes tener múltiples impresoras con la misma instalación, solo copia el directorio y cambia el token

## 🆘 Soporte

Si encuentras un problema:
1. Revisa los logs: `journalctl -u tecmedhub-client -n 100`
2. Verifica la configuración
3. Prueba con `verbose: true` para más detalles
4. Reporta el issue con los logs relevantes

## 📜 Licencia

Copyright © 2025 TecMedHub

---

**Version 4.0.0** - Cliente Bulletproof que nunca necesitarás modificar 🚀
