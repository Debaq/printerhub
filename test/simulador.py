#!/usr/bin/env python3
"""
Simulador de 6 impresoras 3D para TecMedHub
Envía datos aleatorios al servidor para testing
"""

import requests
import time
import random
import base64
from datetime import datetime, timedelta

# Configuración
SERVER_URL = "https://tmeduca.org/printerhub/api.php"  # Cambiar por tu URL real
UPDATE_INTERVAL = 5  # segundos

# Configuración de las 6 impresoras de prueba
PRINTERS = [
    {
        'token': 'TECMED_PRINTER_001',
        'name': '🦄 UNICORNIO MAGICO',
        'status': 'printing',
        'tags': ['Prusa', 'PLA']
    },
    {
        'token': 'TECMED_PRINTER_002',
        'name': '🌈 ARCOIRIS EXPRESS',
        'status': 'idle',
        'tags': ['Ender', 'Multi-Material']
    },
    {
        'token': 'TECMED_PRINTER_003',
        'name': '⚡ RAYO MCQUEEN',
        'status': 'printing',
        'tags': ['Creality', 'Fast']
    },
    {
        'token': 'TECMED_PRINTER_004',
        'name': '🎨 PICASSO 3D',
        'status': 'idle',
        'tags': ['Anycubic', 'Resin']
    },
    {
        'token': 'TECMED_PRINTER_005',
        'name': '🚀 COHETE ESPACIAL',
        'status': 'error',
        'tags': ['Prusa', 'PETG']
    },
    {
        'token': 'TECMED_PRINTER_006',
        'name': '💎 DIAMANTE ROSA',
        'status': 'printing',
        'tags': ['Voron', 'TPU']
    }
]

# Archivos de ejemplo que las impresoras pueden estar imprimiendo
SAMPLE_FILES = [
    'protesis_mano.gcode',
    'soporte_tablet.gcode',
    'calibration_cube.gcode',
    'vase_mode.gcode',
    'benchy.gcode',
    'skull.gcode',
    'respirador_valvula.gcode',
    'porta_jeringas.gcode'
]

# Colores de filamento disponibles
FILAMENT_COLORS = ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Negro', 'Blanco', 'Rosa', 'Morado', 'Naranja', 'Cyan']

# Materiales de filamento
FILAMENT_MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon', 'ASA']

# Estados de cama
BED_STATUSES = ['limpia', 'necesita limpieza', 'calibrar', 'perfecta']

# Estado persistente para cada impresora
printer_states = {}

def init_printer_state(token):
    """Inicializar estado de una impresora"""
    if token not in printer_states:
        printer_states[token] = {
            'progress': 0,
            'start_time': datetime.now(),
            'filament': {
                'material': random.choice(FILAMENT_MATERIALS),
                'color': random.choice(FILAMENT_COLORS),
                'remaining': random.randint(30, 100)
            },
            'bed_status': random.choice(BED_STATUSES),
            'last_completed': None,
            'print_speed': 100,
            'fan_on': True
        }

def generate_fake_image():
    """Genera una imagen base64 fake (cuadrado de colores con timestamp)"""
    return "data:image/svg+xml;base64," + base64.b64encode(
        f'''<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad{random.randint(0,1000)}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#{random.randint(0, 0xFFFFFF):06x};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#{random.randint(0, 0xFFFFFF):06x};stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#grad{random.randint(0,1000)})"/>
        <rect x="50" y="50" width="100" height="100" fill="rgba(0,0,0,0.3)" rx="10"/>
        <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="16" font-weight="bold">
        TECMEDHUB
        </text>
        <text x="50%" y="60%" text-anchor="middle" fill="white" font-size="12">
        {datetime.now().strftime('%H:%M:%S')}
        </text>
        </svg>'''.encode()
    ).decode()

def calculate_uptime(start_time):
    """Calcular uptime desde inicio"""
    delta = datetime.now() - start_time
    hours = int(delta.total_seconds() // 3600)
    minutes = int((delta.total_seconds() % 3600) // 60)
    return f"{hours}h {minutes}m"

def simulate_printer(printer_config):
    """Simula datos de una impresora"""
    token = printer_config['token']
    status = printer_config['status']
    
    # Inicializar estado si no existe
    init_printer_state(token)
    state = printer_states[token]
    
    data = {
        'action': 'update_printer',
        'token': token,
        'name': printer_config['name'],
        'status': status,
        'temp_hotend': random.randint(20, 250) if status != 'idle' else random.randint(20, 30),
        'temp_bed': random.randint(20, 100) if status != 'idle' else random.randint(20, 25),
        'image': generate_fake_image(),
        'uptime': calculate_uptime(state['start_time']),
        'bed_status': state['bed_status'],
        'filament': state['filament'],
        'print_speed': state['print_speed'],
        'tags': printer_config.get('tags', [])
    }
    
    # Si está imprimiendo, agregar progreso y archivo
    if status == 'printing':
        # Incrementar progreso
        state['progress'] += random.randint(1, 5)
        if state['progress'] > 100:
            state['progress'] = 100
            # Marcar como completado
            completed_file = random.choice(SAMPLE_FILES)
            state['last_completed'] = f"{completed_file} ({datetime.now().strftime('%H:%M')})"
            # Reiniciar progreso después de un momento
            state['progress'] = 0
        
        # Consumir filamento gradualmente
        if state['progress'] % 10 == 0 and state['filament']['remaining'] > 0:
            state['filament']['remaining'] -= 1
        
        data['progress'] = state['progress']
        data['current_file'] = random.choice(SAMPLE_FILES)
        
        # Tiempo restante estimado (basado en progreso)
        if state['progress'] > 0:
            total_time = 120  # 2 horas estimadas
            remaining = int((100 - state['progress']) * total_time / 100)
            data['time_remaining'] = remaining
    else:
        data['progress'] = 0
        data['current_file'] = ''
        data['time_remaining'] = None
    
    # Agregar último trabajo completado si existe
    if state['last_completed']:
        data['last_completed'] = state['last_completed']
    
    return data

def send_update(printer_data):
    """Envía actualización al servidor"""
    try:
        response = requests.post(
            SERVER_URL,
            json=printer_data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ {printer_data['name']}: Actualizado correctamente")
            else:
                print(f"❌ {printer_data['name']}: {result.get('message')}")
        else:
            print(f"⚠️ {printer_data['name']}: Error HTTP {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"🔴 {printer_data['name']}: Error de conexión - {e}")

def check_commands(token, printer_name):
    """Verifica si hay comandos pendientes para esta impresora"""
    try:
        response = requests.get(
            f"{SERVER_URL}?action=get_commands&token={token}",
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                commands = result.get('commands', [])
                for cmd in commands:
                    action = cmd.get('action')
                    print(f"📨 {printer_name}: Comando recibido -> {action.upper()}")
                    
                    # Procesar comandos
                    state = printer_states.get(token)
                    if not state:
                        continue
                    
                    if action == 'print':
                        file = cmd.get('file', 'unknown')
                        print(f"   🖨️ Iniciando impresión: {file}")
                        state['progress'] = 0
                    elif action == 'emergency_stop':
                        print(f"   🚨 STOP DE EMERGENCIA")
                        state['progress'] = 0
                    elif action == 'home':
                        print(f"   🏠 Haciendo homing")
                    elif action == 'heat':
                        print(f"   🔥 Calentando extrusor")
                    elif action == 'pause':
                        print(f"   ⏸️ Pausando impresión")
                    elif action == 'resume':
                        print(f"   ▶️ Reanudando impresión")
                    elif action == 'reboot':
                        print(f"   🔄 Reiniciando impresora")
                        state['start_time'] = datetime.now()
                    elif action == 'toggle_fan':
                        state['fan_on'] = not state['fan_on']
                        print(f"   💨 Ventilador: {'ON' if state['fan_on'] else 'OFF'}")
                    elif action == 'set_speed':
                        speed = cmd.get('speed', 100)
                        state['print_speed'] = speed
                        print(f"   ⚡ Velocidad ajustada a {speed}%")
                        
    except requests.exceptions.RequestException as e:
        print(f"🔴 {printer_name}: Error verificando comandos - {e}")

def main():
    """Loop principal del simulador"""
    print("=" * 60)
    print("🌈 SIMULADOR DE IMPRESORAS TECMEDHUB 🌈")
    print("=" * 60)
    print(f"Servidor: {SERVER_URL}")
    print(f"Intervalo de actualización: {UPDATE_INTERVAL}s")
    print(f"Impresoras simuladas: {len(PRINTERS)}")
    print("-" * 60)
    
    for printer in PRINTERS:
        print(f"  • {printer['name']} ({printer['token']})")
        print(f"    Tags: {', '.join(printer.get('tags', []))}")
    
    print("=" * 60)
    print("Iniciando simulación... (Ctrl+C para detener)")
    print()
    
    try:
        iteration = 0
        while True:
            iteration += 1
            print(f"\n🔄 Iteración #{iteration} - {datetime.now().strftime('%H:%M:%S')}")
            print("-" * 60)
            
            for printer in PRINTERS:
                # Enviar actualización
                data = simulate_printer(printer)
                send_update(data)
                
                # Verificar comandos pendientes
                check_commands(printer['token'], printer['name'])
                
                # Pequeña pausa entre impresoras
                time.sleep(0.5)
            
            # Cambiar estados aleatoriamente (10% de probabilidad)
            for printer in PRINTERS:
                if random.random() < 0.1:
                    old_status = printer['status']
                    new_status = random.choice(['printing', 'idle', 'error'])
                    printer['status'] = new_status
                    if old_status != new_status:
                        print(f"🔀 {printer['name']}: {old_status} -> {new_status}")
                        
                        # Reiniciar progreso si cambia a printing
                        if new_status == 'printing':
                            printer_states[printer['token']]['progress'] = 0
            
            # Simular cambios en filamento (raro)
            for printer in PRINTERS:
                if random.random() < 0.05:  # 5% probabilidad
                    state = printer_states[printer['token']]
                    state['filament']['remaining'] = random.randint(20, 100)
                    print(f"📦 {printer['name']}: Filamento recargado ({state['filament']['remaining']}%)")
            
            # Simular cambios en estado de cama (raro)
            for printer in PRINTERS:
                if random.random() < 0.03:  # 3% probabilidad
                    state = printer_states[printer['token']]
                    old_bed = state['bed_status']
                    state['bed_status'] = random.choice(BED_STATUSES)
                    if old_bed != state['bed_status']:
                        print(f"🛏️ {printer['name']}: Cama {old_bed} -> {state['bed_status']}")
            
            # Esperar antes de la próxima iteración
            print(f"\n💤 Esperando {UPDATE_INTERVAL}s...")
            time.sleep(UPDATE_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n👋 Simulación detenida por el usuario")
        print("=" * 60)
        print("📊 Resumen final:")
        for printer in PRINTERS:
            state = printer_states.get(printer['token'], {})
            print(f"\n{printer['name']}:")
            print(f"  Estado: {printer['status']}")
            print(f"  Progreso: {state.get('progress', 0)}%")
            print(f"  Filamento: {state.get('filament', {}).get('remaining', 0)}%")
            print(f"  Uptime: {calculate_uptime(state.get('start_time', datetime.now()))}")
        print("=" * 60)

if __name__ == "__main__":
    main()