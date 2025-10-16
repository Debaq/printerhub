-- PrinterHub - Schema Completo SQLite
-- Sistema de gestión de impresoras 3D con usuarios, permisos y auditoría

-- =============================================================================
-- TABLAS EXISTENTES (YA CREADAS EN printer-api)
-- =============================================================================

-- Tabla de impresoras registradas
CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    last_seen INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    is_blocked INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1  -- 1=visible para usuario público, 0=privado
);

-- Tabla de estados actuales (se actualiza cada 5s desde el cliente)
CREATE TABLE IF NOT EXISTS printer_states (
    printer_id INTEGER PRIMARY KEY,
    status TEXT,
    progress INTEGER DEFAULT 0,
    current_file TEXT,
    temp_hotend REAL DEFAULT 0,
    temp_bed REAL DEFAULT 0,
    temp_hotend_target REAL DEFAULT 0,
    temp_bed_target REAL DEFAULT 0,
    print_speed INTEGER DEFAULT 100,
    fan_speed INTEGER DEFAULT 0,
    time_remaining INTEGER,
    image TEXT,
    uptime TEXT,
    bed_status TEXT,
    filament TEXT, -- JSON string
    tags TEXT, -- JSON array string
    files TEXT, -- JSON array string
    raw_data TEXT, -- JSON completo del cliente
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

-- Tabla de comandos pendientes/ejecutados
CREATE TABLE IF NOT EXISTS commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'gcode', 'macro', 'basic'
    command TEXT NOT NULL,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'completed', 'failed'
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    sent_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

-- Tabla de archivos gcode en el servidor
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT,
    size_bytes INTEGER,
    checksum_md5 TEXT,
    printer_id INTEGER, -- NULL = disponible para todas las impresoras
    uploaded_by_user_id INTEGER, -- ID del usuario que subió
    uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
    downloaded INTEGER DEFAULT 0,
    is_private INTEGER DEFAULT 0, -- 0=público, 1=privado
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- NUEVAS TABLAS - SISTEMA DE USUARIOS Y PERMISOS
-- =============================================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'admin', 'user'
    can_print_private INTEGER DEFAULT 0, -- Puede hacer impresiones privadas
    is_blocked INTEGER DEFAULT 0, -- 0=activo, 1=bloqueado
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_login INTEGER,
    last_ip TEXT
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de grupos (permisos personalizados)
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT NOT NULL, -- JSON: {"can_control": true, "can_upload": true, ...}
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Relación usuarios-grupos (un usuario puede estar en varios grupos)
CREATE TABLE IF NOT EXISTS user_groups (
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    assigned_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Asignación de impresoras a usuarios (quién puede ver/controlar qué)
CREATE TABLE IF NOT EXISTS printer_assignments (
    printer_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    can_control INTEGER DEFAULT 1, -- Puede pausar/detener/enviar comandos
    can_view_details INTEGER DEFAULT 1, -- Puede ver nombre archivo, detalles
    assigned_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (printer_id, user_id),
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- HISTORIAL Y AUDITORÍA
-- =============================================================================

-- Historial de trabajos de impresión
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER NOT NULL,
    file_id INTEGER,
    user_id INTEGER, -- Quién inició el trabajo
    started_at INTEGER,
    ended_at INTEGER,
    duration INTEGER, -- Segundos
    filament_used REAL, -- Gramos
    status TEXT, -- 'completed', 'failed', 'cancelled', 'in_progress'
    error_message TEXT,
    is_private INTEGER DEFAULT 0, -- Si la impresión fue privada
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Historial de comandos ejecutados (auditoría detallada)
CREATE TABLE IF NOT EXISTS command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id INTEGER NOT NULL,
    printer_id INTEGER NOT NULL,
    user_id INTEGER, -- NULL si fue comando automático
    executed_at INTEGER DEFAULT (strftime('%s', 'now')),
    result TEXT, -- 'success', 'failed'
    error_message TEXT,
    execution_time INTEGER, -- Milisegundos
    FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Log de acciones del sistema (auditoría completa)
CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- NULL = usuario público o sistema
    action_type TEXT NOT NULL, -- 'login', 'pause', 'stop', 'upload', 'delete_user', etc
    target_type TEXT, -- 'printer', 'user', 'file', 'job'
    target_id INTEGER, -- ID del objeto afectado
    description TEXT, -- Descripción legible
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- JSON con datos adicionales
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================================================

-- Índices de tablas existentes
CREATE INDEX IF NOT EXISTS idx_commands_printer_status ON commands(printer_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
CREATE INDEX IF NOT EXISTS idx_files_printer ON files(printer_id);
CREATE INDEX IF NOT EXISTS idx_printers_token ON printers(token);

-- Índices nuevos
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_printer_assignments_user ON printer_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_printer_assignments_printer ON printer_assignments(printer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_printer ON jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_command_history_printer ON command_history(printer_id);
CREATE INDEX IF NOT EXISTS idx_command_history_user ON command_history(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_user ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_type ON action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs(created_at);

-- =============================================================================
-- DATOS INICIALES
-- =============================================================================

-- Usuario admin por defecto (password: admin123 - cambiar en producción)
-- Hash generado con password_hash('admin123', PASSWORD_BCRYPT)
INSERT OR IGNORE INTO users (username, email, password_hash, role, can_print_private)
VALUES ('admin', 'admin@printerhub.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 1);

-- Grupo básico de usuarios
INSERT OR IGNORE INTO groups (name, description, permissions)
VALUES (
    'Usuarios Básicos',
    'Permisos estándar para usuarios regulares',
    '{"can_view_printers": true, "can_control_printers": true, "can_upload_files": true, "can_print_private": false}'
);

-- Grupo avanzado
INSERT OR IGNORE INTO groups (name, description, permissions)
VALUES (
    'Usuarios Avanzados',
    'Usuarios con permisos de impresión privada',
    '{"can_view_printers": true, "can_control_printers": true, "can_upload_files": true, "can_print_private": true}'
);
