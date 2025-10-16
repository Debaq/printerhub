# PrinterHub - Printer API

API para comunicación con clientes Python de impresoras Klipper/Moonraker.

## 📁 Estructura

```
printer-api/
├── config.php      # Configuración y funciones comunes
├── update.php      # Recibe estados de impresoras (cada 5s)
├── commands.php    # Entrega comandos pendientes (cada 3s)
└── files.php       # Gestión de archivos gcode

data/
├── printerhub.db   # Base de datos SQLite
└── init_db.sql     # Script de inicialización

uploads/            # Archivos .gcode
```

## 🔌 Endpoints

### 1. POST printer-api/update.php
**Recibe estados del cliente Python cada 5 segundos**

Request body:
```json
{
  "action": "update_printer",
  "token": "TECMED_PRINTER_001",
  "name": "Mi Impresora 3D",
  "status": "printing",
  "progress": 75,
  "current_file": "pieza.gcode",
  "temp_hotend": 210.5,
  "temp_bed": 60.0,
  "temp_hotend_target": 215.0,
  "temp_bed_target": 60.0,
  "print_speed": 100,
  "fan_speed": 80,
  "time_remaining": 45,
  "image": "base64_or_url",
  "uptime": "12h 34m",
  "bed_status": "limpia",
  "filament": {...},
  "tags": [...],
  "files": [...]
}
```

Response:
```json
{
  "success": true,
  "message": "Estado actualizado",
  "printer_id": 123,
  "timestamp": 1234567890
}
```

### 2. GET printer-api/commands.php?token=XXX
**El cliente consulta comandos pendientes cada 3 segundos**

Response:
```json
{
  "success": true,
  "message": "OK",
  "commands": [
    {
      "id": 1,
      "type": "gcode",
      "command": "G28",
      "priority": 1
    }
  ]
}
```

### 3. GET printer-api/files.php?action=list_files&printer_token=XXX
**Lista archivos disponibles para descargar**

Response:
```json
{
  "success": true,
  "message": "OK",
  "files": [
    {
      "name": "pieza.gcode",
      "original_name": "pieza_v2.gcode",
      "size": "2.5 MB",
      "size_bytes": 2621440,
      "md5": "abc123...",
      "uploaded": "2025-01-15 10:30:00",
      "downloaded": false,
      "exists": true
    }
  ]
}
```

### 4. GET printer-api/files.php?action=download_file&file=XXX&printer_token=XXX
**Descarga un archivo gcode**

Response: Binary file download

### 5. POST printer-api/files.php
**Marca archivo como descargado**

Request body:
```json
{
  "action": "mark_downloaded",
  "file": "pieza.gcode",
  "printer_token": "TECMED_PRINTER_001"
}
```

Response:
```json
{
  "success": true,
  "message": "Archivo marcado como descargado"
}
```

## 🗄️ Base de Datos

### Tabla: printers
```sql
id, token (UNIQUE), name, status, last_seen, created_at
```

### Tabla: printer_states
```sql
printer_id (PK/FK), status, progress, current_file,
temp_hotend, temp_bed, temp_hotend_target, temp_bed_target,
print_speed, fan_speed, time_remaining, image, uptime,
bed_status, filament (JSON), tags (JSON), files (JSON),
raw_data (JSON), updated_at
```

### Tabla: commands
```sql
id, printer_id (FK), type, command, priority,
status (pending/sent/completed/failed),
created_at, sent_at, completed_at
```

### Tabla: files
```sql
id, filename, original_name, size_bytes, checksum_md5,
printer_id (FK, nullable), uploaded_by, uploaded_at, downloaded
```

## 🔧 Instalación

1. **Subir archivos al servidor:**
```bash
printer-api/
data/
uploads/
```

2. **Dar permisos:**
```bash
chmod 755 printer-api/*.php
chmod 666 data/printerhub.db
chmod 777 uploads/
```

3. **Configurar cliente Python:**
Editar `printer_config.json`:
```json
{
  "server_url": "https://tudominio.com/printer-api/update.php"
}
```

4. **URLs de los endpoints:**
- Update: `https://tudominio.com/printer-api/update.php`
- Commands: `https://tudominio.com/printer-api/commands.php`
- Files: `https://tudominio.com/printer-api/files.php`

## ⚠️ Importante para el Cliente Python

El cliente Python actual usa:
```python
"server_url": "https://tmeduca.org/printerhub/api.php"
```

**Debes cambiar a:**
```python
"server_url": "https://tudominio.com/printer-api/update.php"
```

Y agregar configuración para comandos y archivos:
```python
"commands_url": "https://tudominio.com/printer-api/commands.php",
"files_url": "https://tudominio.com/printer-api/files.php"
```

## ✅ Estado Actual

- ✅ Base de datos SQLite creada
- ✅ Endpoint de actualización de estados (update.php)
- ✅ Endpoint de comandos (commands.php)
- ✅ Endpoint de archivos (files.php)
- ⏳ Pendiente: API web para usuarios
- ⏳ Pendiente: Frontend web

## 🚀 Siguiente Paso

Crear la **API Web** (`/api/`) para que los usuarios puedan:
- Ver impresoras
- Enviar comandos
- Subir archivos
- Ver historial
- Gestionar usuarios
