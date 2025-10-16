<?php
/**
 * PrinterHub - Web API Configuration
 * API para usuarios web - Comparte BD con printer-api
 */

// ==================== RUTAS Y ARCHIVOS ====================

// Base de datos compartida con printer-api
define('DB_PATH', __DIR__ . '/../data/printerhub.db');

// Carpeta de uploads compartida
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_UPLOAD_SIZE', 100 * 1024 * 1024); // 100 MB

// ==================== CONFIGURACIÓN DE SESIONES ====================

define('SESSION_DURATION', 24 * 60 * 60); // 24 horas
define('SESSION_TOKEN_LENGTH', 64);

// ==================== SEGURIDAD ====================

define('BCRYPT_COST', 10);
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_TIME', 15 * 60); // 15 minutos

// CORS - Configurar según tu frontend
define('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://tudominio.com'
]);

// ==================== TIMEOUTS ====================

define('PRINTER_OFFLINE_TIMEOUT', 60); // Segundos
define('RATE_LIMIT_REQUESTS', 100); // Peticiones por minuto por IP

// ==================== BASE DE DATOS ====================

$db = null;

/**
 * Obtener conexión a la base de datos SQLite compartida
 */
function getDB() {
    global $db;
    
    if ($db !== null) {
        return $db;
    }
    
    // Verificar si la BD existe
    $dbExists = file_exists(DB_PATH);
    
    try {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // Habilitar foreign keys
        $db->exec('PRAGMA foreign_keys = ON');
        
        // Si la BD no existía, inicializarla
        if (!$dbExists) {
            initializeDatabase($db);
        } else {
            // Verificar si las tablas existen
            $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
            if (!$stmt->fetch()) {
                initializeDatabase($db);
            }
        }
        
        return $db;
    } catch (PDOException $e) {
        error_log("Error conectando a la base de datos: " . $e->getMessage());
        jsonResponse(false, 'Error de base de datos', [], 500);
    }
}

/**
 * Inicializar base de datos con el schema completo
 */
function initializeDatabase($db) {
    try {
        // Leer el schema SQL
        $schemaPath = __DIR__ . '/schema.sql';
        
        if (!file_exists($schemaPath)) {
            error_log("ADVERTENCIA: schema.sql no encontrado, creando schema básico");
            createBasicSchema($db);
            return;
        }
        
        $sql = file_get_contents($schemaPath);
        
        // Ejecutar el schema completo
        $db->exec($sql);
        
        error_log("Base de datos inicializada exitosamente");
        
    } catch (PDOException $e) {
        error_log("Error inicializando base de datos: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Crear schema básico si no existe el archivo schema.sql
 */
function createBasicSchema($db) {
    $sql = "
    -- Tablas básicas existentes
    CREATE TABLE IF NOT EXISTS printers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        last_seen INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        is_blocked INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 1
    );
    
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
        filament TEXT,
        tags TEXT,
        files TEXT,
        raw_data TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        printer_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        command TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        sent_at INTEGER,
        completed_at INTEGER,
        FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT,
        size_bytes INTEGER,
        checksum_md5 TEXT,
        printer_id INTEGER,
        uploaded_by_user_id INTEGER,
        uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
        downloaded INTEGER DEFAULT 0,
        is_private INTEGER DEFAULT 0,
        FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL,
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    
    -- Sistema de usuarios
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        can_print_private INTEGER DEFAULT 0,
        is_blocked INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_login INTEGER,
        last_ip TEXT
    );
    
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
    
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        permissions TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE TABLE IF NOT EXISTS user_groups (
        user_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        assigned_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, group_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS printer_assignments (
        printer_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        can_control INTEGER DEFAULT 1,
        can_view_details INTEGER DEFAULT 1,
        assigned_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (printer_id, user_id),
        FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        printer_id INTEGER NOT NULL,
        file_id INTEGER,
        user_id INTEGER,
        started_at INTEGER,
        ended_at INTEGER,
        duration INTEGER,
        filament_used REAL,
        status TEXT,
        error_message TEXT,
        is_private INTEGER DEFAULT 0,
        FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    
    CREATE TABLE IF NOT EXISTS command_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command_id INTEGER NOT NULL,
        printer_id INTEGER NOT NULL,
        user_id INTEGER,
        executed_at INTEGER DEFAULT (strftime('%s', 'now')),
        result TEXT,
        error_message TEXT,
        execution_time INTEGER,
        FOREIGN KEY (command_id) REFERENCES commands(id) ON DELETE CASCADE,
        FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    
    CREATE TABLE IF NOT EXISTS action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action_type TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    
    -- Índices
    CREATE INDEX IF NOT EXISTS idx_commands_printer_status ON commands(printer_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_printer_assignments_user ON printer_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_printer ON jobs(printer_id);
    CREATE INDEX IF NOT EXISTS idx_action_logs_user ON action_logs(user_id);
    
    -- Usuario admin por defecto (password: admin123)
    INSERT OR IGNORE INTO users (username, email, password_hash, role, can_print_private)
    VALUES ('admin', 'admin@printerhub.local', '\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 1);
    ";
    
    $db->exec($sql);
    error_log("Schema básico creado exitosamente");
}

// ==================== RESPUESTAS JSON ====================

/**
 * Enviar respuesta JSON estándar
 */
function jsonResponse($success, $message, $data = [], $httpCode = 200) {
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message,
        'timestamp' => time()
    ], $data));
    exit;
}

// ==================== CORS ====================

/**
 * Configurar headers CORS
 */
function setCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    if (in_array($origin, ALLOWED_ORIGINS)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Session-Token');
    header('Access-Control-Allow-Credentials: true');
    
    // Responder a preflight requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// ==================== AUTENTICACIÓN ====================

/**
 * Obtener token de sesión del header o cookie
 */
function getSessionToken() {
    // Buscar en header
    $headers = getallheaders();
    if (isset($headers['X-Session-Token'])) {
        return $headers['X-Session-Token'];
    }
    
    // Buscar en cookie
    if (isset($_COOKIE['session_token'])) {
        return $_COOKIE['session_token'];
    }
    
    return null;
}

/**
 * Validar sesión y obtener usuario actual
 */
function getCurrentUser() {
    $token = getSessionToken();
    
    if (!$token) {
        return null;
    }
    
    $db = getDB();
    
    // Buscar sesión válida
    $stmt = $db->prepare('
        SELECT u.*, s.token, s.expires_at
        FROM users u
        INNER JOIN sessions s ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ? AND u.is_blocked = 0
    ');
    $stmt->execute([$token, time()]);
    $user = $stmt->fetch();
    
    return $user ?: null;
}

/**
 * Verificar si el usuario actual es admin
 */
function requireAdmin() {
    $user = getCurrentUser();
    
    if (!$user || $user['role'] !== 'admin') {
        jsonResponse(false, 'Acceso denegado - Se requiere rol de administrador', [], 403);
    }
    
    return $user;
}

/**
 * Requerir autenticación (usuario o admin)
 */
function requireAuth() {
    $user = getCurrentUser();
    
    if (!$user) {
        jsonResponse(false, 'No autenticado - Sesión inválida o expirada', [], 401);
    }
    
    return $user;
}

/**
 * Verificar si usuario puede acceder a una impresora
 */
function canAccessPrinter($userId, $printerId, $requireControl = false) {
    $db = getDB();
    
    // Admin puede acceder a todo
    $stmt = $db->prepare('SELECT role FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if ($user && $user['role'] === 'admin') {
        return true;
    }
    
    // Verificar asignación específica
    $stmt = $db->prepare('
        SELECT can_control, can_view_details
        FROM printer_assignments
        WHERE user_id = ? AND printer_id = ?
    ');
    $stmt->execute([$userId, $printerId]);
    $assignment = $stmt->fetch();
    
    if (!$assignment) {
        return false;
    }
    
    if ($requireControl && !$assignment['can_control']) {
        return false;
    }
    
    return true;
}

// ==================== LOGGING Y AUDITORÍA ====================

/**
 * Registrar acción en el log de auditoría
 */
function logAction($userId, $actionType, $targetType = null, $targetId = null, $description = '', $metadata = []) {
    $db = getDB();
    
    $stmt = $db->prepare('
        INSERT INTO action_logs (user_id, action_type, target_type, target_id, description, ip_address, user_agent, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([
        $userId,
        $actionType,
        $targetType,
        $targetId,
        $description,
        $_SERVER['REMOTE_ADDR'] ?? null,
        $_SERVER['HTTP_USER_AGENT'] ?? null,
        json_encode($metadata)
    ]);
}

// ==================== VALIDACIONES ====================

/**
 * Validar email
 */
function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validar username (alfanumérico, guiones y guiones bajos)
 */
function isValidUsername($username) {
    return preg_match('/^[a-zA-Z0-9_-]{3,30}$/', $username);
}

/**
 * Validar comando gcode (básico - evitar comandos peligrosos)
 */
function isValidGcode($gcode) {
    // Lista negra de comandos peligrosos
    $blacklist = ['M112', 'M999', 'M502']; // Emergency stop, reset, factory reset
    
    $lines = explode("\n", strtoupper($gcode));
    
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        
        foreach ($blacklist as $dangerous) {
            if (strpos($line, $dangerous) === 0) {
                return false;
            }
        }
    }
    
    return true;
}

// ==================== UTILIDADES ====================

/**
 * Generar token aleatorio seguro
 */
function generateSecureToken($length = 64) {
    return bin2hex(random_bytes($length / 2));
}

/**
 * Formatear tamaño de archivo
 */
function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= (1 << (10 * $pow));
    
    return round($bytes, 2) . ' ' . $units[$pow];
}

/**
 * Obtener datos POST como JSON o form-data
 */
function getRequestData() {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (strpos($contentType, 'application/json') !== false) {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
    
    return $_POST;
}

// ==================== INICIALIZACIÓN ====================

// Configurar CORS en todas las peticiones
setCorsHeaders();

// Configurar timezone
date_default_timezone_set('America/Santiago');

// Reportar solo errores críticos
error_reporting(E_ERROR | E_PARSE);
