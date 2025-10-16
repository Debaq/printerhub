-- PrinterHub Database Schema
-- SQLite Database

-- Tabla de impresoras registradas
CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    last_seen INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
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
    uploaded_by TEXT,
    uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
    downloaded INTEGER DEFAULT 0,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_commands_printer_status ON commands(printer_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
CREATE INDEX IF NOT EXISTS idx_files_printer ON files(printer_id);
CREATE INDEX IF NOT EXISTS idx_printers_token ON printers(token);
