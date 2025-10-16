<?php
/**
 * PrinterHub - Printer API Configuration
 * Configuración de conexión a SQLite y constantes
 */

// Rutas
define('DB_PATH', __DIR__ . '/../data/printerhub.db');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');

// Timeouts
define('OFFLINE_TIMEOUT', 60); // Segundos sin recibir datos para marcar offline

// Conexión global a la base de datos
$db = null;

/**
 * Obtener conexión a la base de datos SQLite
 */
function getDB() {
    global $db;
    
    if ($db !== null) {
        return $db;
    }
    
    try {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $db;
    } catch (PDOException $e) {
        error_log("Error conectando a la base de datos: " . $e->getMessage());
        http_response_code(500);
        die(json_encode([
            'success' => false,
            'error' => 'Database connection failed'
        ]));
    }
}

/**
 * Respuesta JSON estándar
 */
function jsonResponse($success, $message, $data = []) {
    header('Content-Type: application/json');
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}

/**
 * Validar token de impresora
 */
function validatePrinterToken($token) {
    if (empty($token)) {
        jsonResponse(false, 'Token requerido');
    }
    
    $db = getDB();
    $stmt = $db->prepare('SELECT id, name FROM printers WHERE token = ?');
    $stmt->execute([$token]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Token inválido');
    }
    
    return $printer;
}

/**
 * Obtener o crear impresora por token
 */
function getOrCreatePrinter($token, $name = null) {
    $db = getDB();
    
    // Buscar impresora existente
    $stmt = $db->prepare('SELECT * FROM printers WHERE token = ?');
    $stmt->execute([$token]);
    $printer = $stmt->fetch();
    
    if ($printer) {
        // Actualizar nombre si se proporciona uno nuevo
        if ($name && $name !== $printer['name']) {
            $stmt = $db->prepare('UPDATE printers SET name = ? WHERE id = ?');
            $stmt->execute([$name, $printer['id']]);
            $printer['name'] = $name;
        }
        return $printer;
    }
    
    // Crear nueva impresora
    $printerName = $name ?? 'Impresora ' . substr($token, -4);
    $stmt = $db->prepare('
        INSERT INTO printers (token, name, status, last_seen, created_at)
        VALUES (?, ?, "offline", ?, ?)
    ');
    $now = time();
    $stmt->execute([$token, $printerName, $now, $now]);
    
    $printerId = $db->lastInsertId();
    
    return [
        'id' => $printerId,
        'token' => $token,
        'name' => $printerName,
        'status' => 'offline',
        'last_seen' => $now,
        'created_at' => $now
    ];
}

/**
 * Headers CORS
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
