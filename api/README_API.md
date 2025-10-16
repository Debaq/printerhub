# PrinterHub - API Web Documentation

API REST para gestión de impresoras 3D con sistema de usuarios, permisos y auditoría completa.

## 🚀 Instalación

### Estructura de Archivos

```
/
├── api/                          # API WEB (nueva)
│   ├── config.php               # Configuración y auto-instalador
│   ├── schema.sql               # Schema de la base de datos
│   ├── install.php              # Instalador web manual
│   ├── auth.php                 # Autenticación
│   ├── users.php                # Gestión de usuarios (admin)
│   ├── printers.php             # Gestión de impresoras
│   ├── commands.php             # Comandos y control
│   ├── files.php                # Archivos gcode
│   ├── statistics.php           # Estadísticas
│   └── groups.php               # Grupos con permisos
│
├── printer-api/                  # API PYTHON (existente, no modificar)
│   ├── update.php
│   ├── commands.php
│   └── files.php
│
├── data/
│   └── printerhub.db            # Base de datos compartida (auto-creada)
│
└── uploads/                      # Archivos gcode (auto-creado)
```

### Instalación Automática

La base de datos se crea **automáticamente** la primera vez que llamas a cualquier endpoint de la API.

1. Sube la carpeta `/api/` a tu servidor
2. Asegúrate que la carpeta `/data/` tenga permisos de escritura (777)
3. Llama a cualquier endpoint o visita `/api/install.php`

### Instalación Manual (Opcional)

Visita en tu navegador:
```
https://tudominio.com/api/install.php
```

Esto te mostrará una interfaz visual para verificar/reinstalar la BD.

### Credenciales por Defecto

```
Usuario: admin
Contraseña: admin123
Email: admin@printerhub.local
```

⚠️ **IMPORTANTE:** Cambia la contraseña inmediatamente después del primer login.

---

## 🔐 Autenticación

Todos los endpoints (excepto públicos) requieren autenticación mediante token de sesión.

### POST `/api/auth.php?action=register`
Registrar nuevo usuario

**Request:**
```json
{
  "username": "juan",
  "email": "juan@example.com",
  "password": "mipassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": 2,
    "username": "juan",
    "email": "juan@example.com"
  }
}
```

### POST `/api/auth.php?action=login`
Iniciar sesión

**Request:**
```json
{
  "username": "admin",
  "password": "admin123",
  "remember_me": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "session": {
    "token": "abc123def456...",
    "expires_at": 1234567890
  },
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@printerhub.local",
    "role": "admin",
    "can_print_private": 1
  }
}
```

**Usar el token en siguientes peticiones:**
```
Header: X-Session-Token: abc123def456...
```
O
```
Cookie: session_token=abc123def456...
```

### GET `/api/auth.php?action=check_session`
Verificar sesión válida

**Headers:**
```
X-Session-Token: abc123def456...
```

**Response:**
```json
{
  "success": true,
  "message": "Sesión válida",
  "user": { ... }
}
```

### POST `/api/auth.php?action=logout`
Cerrar sesión

---

## 👥 Gestión de Usuarios (Solo Admin)

### GET `/api/users.php?action=list`
Listar usuarios

**Query params:**
- `search`: Buscar por username o email
- `role`: Filtrar por rol (admin/user)
- `blocked`: Filtrar por estado (0/1)

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@printerhub.local",
      "role": "admin",
      "can_print_private": 1,
      "is_blocked": 0,
      "printers_count": 5
    }
  ]
}
```

### GET `/api/users.php?action=get&id=1`
Obtener usuario específico (incluye impresoras asignadas y grupos)

### POST `/api/users.php?action=create`
Crear usuario

**Request:**
```json
{
  "username": "maria",
  "email": "maria@example.com",
  "password": "password123",
  "role": "user",
  "can_print_private": 0
}
```

### POST `/api/users.php?action=update`
Actualizar usuario

**Request:**
```json
{
  "id": 2,
  "email": "nuevoemail@example.com",
  "role": "user",
  "can_print_private": 1
}
```

### POST `/api/users.php?action=delete`
Eliminar usuario

**Request:**
```json
{
  "id": 2
}
```

### POST `/api/users.php?action=block` / `action=unblock`
Bloquear/desbloquear usuario

### POST `/api/users.php?action=assign_printers`
Asignar impresoras a usuario

**Request:**
```json
{
  "user_id": 2,
  "printers": [
    {
      "printer_id": 1,
      "can_control": 1,
      "can_view_details": 1
    },
    {
      "printer_id": 3,
      "can_control": 0,
      "can_view_details": 1
    }
  ]
}
```

---

## 🖨️ Gestión de Impresoras

### GET `/api/printers.php?action=list`
Listar impresoras

**Permisos:**
- **Usuario público:** Solo impresoras públicas
- **Usuario registrado:** Sus impresoras asignadas
- **Admin:** Todas las impresoras

**Query params:**
- `status`: Filtrar por estado
- `search`: Buscar por nombre o token

**Response:**
```json
{
  "success": true,
  "printers": [
    {
      "id": 1,
      "name": "Prusa MK3",
      "token": "PRINTER_001",
      "is_public": 1,
      "is_blocked": 0,
      "current_status": "printing",
      "progress": 45,
      "current_file": "pieza.gcode",
      "temp_hotend": 210.5,
      "temp_bed": 60.0,
      "time_remaining": 1800
    }
  ]
}
```

### GET `/api/printers.php?action=get&id=1`
Obtener impresora específica con detalles completos

### POST `/api/printers.php?action=create` (Admin)
Crear impresora

**Request:**
```json
{
  "token": "PRINTER_005",
  "name": "Ender 3 Pro",
  "is_public": 1
}
```

### POST `/api/printers.php?action=update` (Admin)
Actualizar impresora

### POST `/api/printers.php?action=delete` (Admin)
Eliminar impresora

### POST `/api/printers.php?action=block` / `action=unblock` (Admin)
Bloquear/desbloquear impresora

### POST `/api/printers.php?action=update_notes`
Actualizar notas de impresora

**Request:**
```json
{
  "printer_id": 1,
  "notes": "Requiere mantenimiento"
}
```

### POST `/api/printers.php?action=update_tags`
Actualizar tags

**Request:**
```json
{
  "printer_id": 1,
  "tags": ["PLA", "Alta velocidad", "Prusa"]
}
```

### POST `/api/printers.php?action=set_privacy` (Admin)
Configurar privacidad

**Request:**
```json
{
  "printer_id": 1,
  "is_public": 0
}
```

---

## 🎮 Comandos y Control

### POST `/api/commands.php?action=pause`
Pausar impresión (Todos los usuarios registrados pueden pausar cualquier impresión)

**Request:**
```json
{
  "printer_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Impresión pausada",
  "command_id": 123
}
```

### POST `/api/commands.php?action=resume`
Reanudar impresión

### POST `/api/commands.php?action=cancel`
Cancelar impresión

### POST `/api/commands.php?action=emergency_stop`
Parada de emergencia

### POST `/api/commands.php?action=home`
Home de ejes

**Request:**
```json
{
  "printer_id": 1,
  "axes": "XYZ"
}
```

### POST `/api/commands.php?action=heat`
Configurar temperaturas

**Request:**
```json
{
  "printer_id": 1,
  "hotend": 210,
  "bed": 60
}
```

### POST `/api/commands.php?action=set_speed`
Configurar velocidad de impresión

**Request:**
```json
{
  "printer_id": 1,
  "speed": 120
}
```

### POST `/api/commands.php?action=custom_gcode`
Enviar gcode personalizado

**Request:**
```json
{
  "printer_id": 1,
  "gcode": "G28\nG1 Z10 F1000"
}
```

### GET `/api/commands.php?action=history&printer_id=1`
Obtener historial de comandos

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 100,
      "type": "basic",
      "command": "PAUSE",
      "username": "juan",
      "executed_at": 1234567890,
      "result": "sent"
    }
  ]
}
```

### GET `/api/commands.php?action=actions_log&printer_id=1`
Log de auditoría completo (quién hizo qué)

**Query params:**
- `printer_id`: Filtrar por impresora
- `action_type`: Filtrar por tipo de acción
- `limit`: Número de resultados (max 500)

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": 500,
      "username": "maria",
      "action_type": "print_paused",
      "description": "maria pausó la impresión en Prusa MK3",
      "printer_name": "Prusa MK3",
      "created_at": 1234567890,
      "ip_address": "192.168.1.100"
    }
  ]
}
```

---

## 📁 Gestión de Archivos

### POST `/api/files.php?action=upload`
Subir archivo gcode

**Request (multipart/form-data):**
```
file: [archivo .gcode]
printer_id: 1 (opcional)
is_private: 0
```

**Response:**
```json
{
  "success": true,
  "message": "Archivo subido exitosamente",
  "file": {
    "id": 10,
    "filename": "1234567890_abc123.gcode",
    "original_name": "pieza.gcode",
    "size": "2.5 MB",
    "is_private": 0
  }
}
```

### GET `/api/files.php?action=list`
Listar archivos

**Permisos:**
- **Usuario público:** Solo archivos públicos
- **Usuario registrado:** Archivos públicos + propios + de sus impresoras
- **Admin:** Todos

**Query params:**
- `printer_id`: Filtrar por impresora
- `search`: Buscar por nombre

### GET `/api/files.php?action=get&id=10`
Obtener detalles de archivo

### GET `/api/files.php?action=download&id=10`
Descargar archivo (devuelve el archivo binario)

### POST `/api/files.php?action=delete`
Eliminar archivo (solo dueño o admin)

**Request:**
```json
{
  "id": 10
}
```

### POST `/api/files.php?action=send_to_printer`
Enviar archivo a impresora para imprimir

**Request:**
```json
{
  "file_id": 10,
  "printer_id": 1,
  "is_private": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Archivo enviado a la impresora",
  "job_id": 50,
  "command_id": 200
}
```

### POST `/api/files.php?action=set_privacy`
Cambiar privacidad del archivo

**Request:**
```json
{
  "file_id": 10,
  "is_private": 1
}
```

---

## 📊 Estadísticas

### GET `/api/statistics.php?action=overview`
Resumen general del sistema

**Permisos:**
- **Usuario público:** Datos limitados (solo impresoras públicas)
- **Usuario registrado:** Sus datos
- **Admin:** Datos completos del sistema

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_printers": 5,
    "active_printers": 2,
    "total_jobs": 150,
    "completed_jobs": 120,
    "failed_jobs": 10,
    "total_print_time_hours": 450.5,
    "total_filament_kg": 12.3,
    "total_files": 45,
    "total_users": 8
  }
}
```

### GET `/api/statistics.php?action=printer_stats&id=1`
Estadísticas de impresora específica

**Query params:**
- `period`: 7d, 30d, 90d, all (default: 30d)

### GET `/api/statistics.php?action=user_stats&id=2` (Admin)
Estadísticas de usuario específico

### GET `/api/statistics.php?action=usage_report`
Reporte de uso por período

**Query params:**
- `start_date`: Fecha inicio (YYYY-MM-DD)
- `end_date`: Fecha fin (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "report": {
    "jobs_by_day": [
      {
        "date": "2025-01-15",
        "count": 10,
        "completed": 8,
        "failed": 2
      }
    ],
    "top_printers": [
      {
        "name": "Prusa MK3",
        "jobs_count": 50,
        "completed": 45
      }
    ]
  }
}
```

### GET `/api/statistics.php?action=jobs_history`
Historial de trabajos

**Query params:**
- `printer_id`: Filtrar por impresora
- `user_id`: Filtrar por usuario (admin)
- `status`: completed, failed, cancelled, in_progress
- `limit`: Número de resultados (max 200)

### GET `/api/statistics.php?action=filament_usage`
Uso de filamento

**Query params:**
- `period`: 7d, 30d, 90d, all

### GET `/api/statistics.php?action=top_users` (Admin)
Usuarios más activos

**Query params:**
- `period`: 7d, 30d, 90d, all
- `limit`: Número de usuarios (max 50)

---

## 👨‍👩‍👧‍👦 Gestión de Grupos (Admin)

### GET `/api/groups.php?action=list`
Listar grupos

### GET `/api/groups.php?action=get&id=1`
Obtener grupo con miembros

### POST `/api/groups.php?action=create`
Crear grupo

**Request:**
```json
{
  "name": "Operadores",
  "description": "Usuarios que operan las impresoras",
  "permissions": {
    "can_view_printers": true,
    "can_control_printers": true,
    "can_upload_files": true,
    "can_print_private": false,
    "can_delete_files": false
  }
}
```

### POST `/api/groups.php?action=update`
Actualizar grupo

### POST `/api/groups.php?action=delete`
Eliminar grupo

### POST `/api/groups.php?action=add_users`
Agregar usuarios al grupo

**Request:**
```json
{
  "group_id": 1,
  "user_ids": [2, 3, 5]
}
```

### POST `/api/groups.php?action=remove_user`
Remover usuario del grupo

---

## 🔒 Sistema de Permisos

### Roles

**Admin:**
- Acceso completo al sistema
- CRUD de usuarios, impresoras, archivos
- Ver todas las estadísticas
- Gestionar grupos

**User:**
- Ver y controlar impresoras asignadas
- Subir archivos
- Ver sus trabajos
- **TODOS los usuarios pueden pausar/detener cualquier impresión**

**Público (sin login):**
- Ver estado de impresoras públicas
- Ver imágenes de impresiones públicas
- NO puede controlar nada

### Impresiones Privadas

Cuando `is_private = 1`:
- **Todos ven:** Porcentaje, estado básico
- **Solo dueño/admin ve:** Nombre archivo, imagen, detalles completos

---

## 🔧 Configuración

Edita `/api/config.php`:

```php
// Rutas
define('DB_PATH', __DIR__ . '/../data/printerhub.db');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_UPLOAD_SIZE', 100 * 1024 * 1024); // 100 MB

// Sesiones
define('SESSION_DURATION', 24 * 60 * 60); // 24 horas

// Seguridad
define('BCRYPT_COST', 10);
define('MAX_LOGIN_ATTEMPTS', 5);

// CORS
define('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'https://tudominio.com'
]);
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Login y ver impresoras

```javascript
// Login
const loginResponse = await fetch('/api/auth.php?action=login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});

const { session, user } = await loginResponse.json();
const token = session.token;

// Listar impresoras
const printersResponse = await fetch('/api/printers.php?action=list', {
  headers: { 'X-Session-Token': token }
});

const { printers } = await printersResponse.json();
console.log(printers);
```

### Ejemplo 2: Pausar impresión

```javascript
await fetch('/api/commands.php?action=pause', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-Token': token
  },
  body: JSON.stringify({
    printer_id: 1
  })
});
```

### Ejemplo 3: Subir y enviar archivo a imprimir

```javascript
// Subir archivo
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('is_private', '0');

const uploadResponse = await fetch('/api/files.php?action=upload', {
  method: 'POST',
  headers: { 'X-Session-Token': token },
  body: formData
});

const { file } = await uploadResponse.json();

// Enviar a imprimir
await fetch('/api/files.php?action=send_to_printer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-Token': token
  },
  body: JSON.stringify({
    file_id: file.id,
    printer_id: 1,
    is_private: 0
  })
});
```

---

## ⚠️ Importante

1. **Cambia la contraseña de admin** después de la instalación
2. Configura los **CORS** según tu frontend
3. La BD se comparte entre `/api/` y `/printer-api/`
4. Los clientes Python NO necesitan modificarse
5. El directorio `/data/` debe tener permisos de escritura
6. El directorio `/uploads/` se crea automáticamente

---

## 🐛 Troubleshooting

**Error: "Database connection failed"**
- Verifica permisos del directorio `/data/`
- Asegúrate que PHP tenga SQLite habilitado

**Error: "No se recibió ningún archivo"**
- Verifica `MAX_UPLOAD_SIZE` en config.php
- Revisa `upload_max_filesize` y `post_max_size` en php.ini

**Usuario público no puede ver impresoras**
- Verifica que las impresoras tengan `is_public = 1`
- Verifica que no estén bloqueadas (`is_blocked = 0`)

---

## 📞 Soporte

Para más información, revisa los comentarios en cada archivo PHP.
