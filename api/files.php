<?php
/**
 * PrinterHub - Files API
 * Gestión de archivos gcode
 */

require_once __DIR__ . '/config.php';

$db = getDB();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'upload':
        uploadFile();
        break;
    case 'list':
        listFiles();
        break;
    case 'get':
        getFile();
        break;
    case 'delete':
        deleteFile();
        break;
    case 'send_to_printer':
        sendToPrinter();
        break;
    case 'set_privacy':
        setFilePrivacy();
        break;
    case 'download':
        downloadFile();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== SUBIR ARCHIVO ====================

function uploadFile() {
    $user = requireAuth();
    global $db;
    
    if (!isset($_FILES['file'])) {
        jsonResponse(false, 'No se recibió ningún archivo', [], 400);
    }
    
    $file = $_FILES['file'];
    $printerId = $_POST['printer_id'] ?? null;
    $isPrivate = (int)($_POST['is_private'] ?? 0);
    
    // Validar tamaño
    if ($file['size'] > MAX_UPLOAD_SIZE) {
        jsonResponse(false, 'Archivo demasiado grande (máx ' . formatFileSize(MAX_UPLOAD_SIZE) . ')', [], 400);
    }
    
    // Validar extensión
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if ($extension !== 'gcode') {
        jsonResponse(false, 'Solo se permiten archivos .gcode', [], 400);
    }
    
    // Verificar permisos de privacidad
    if ($isPrivate && !$user['can_print_private'] && $user['role'] !== 'admin') {
        jsonResponse(false, 'No tienes permisos para archivos privados', [], 403);
    }
    
    // Si se especifica impresora, verificar acceso
    if ($printerId) {
        $stmt = $db->prepare('SELECT name FROM printers WHERE id = ?');
        $stmt->execute([$printerId]);
        $printer = $stmt->fetch();
        
        if (!$printer) {
            jsonResponse(false, 'Impresora no encontrada', [], 404);
        }
        
        if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
            jsonResponse(false, 'No tienes acceso a esta impresora', [], 403);
        }
    }
    
    // Generar nombre único
    $originalName = $file['name'];
    $timestamp = time();
    $randomId = substr(md5(uniqid()), 0, 8);
    $filename = $timestamp . '_' . $randomId . '.gcode';
    $filepath = UPLOAD_DIR . $filename;
    
    // Crear directorio si no existe
    if (!is_dir(UPLOAD_DIR)) {
        mkdir(UPLOAD_DIR, 0777, true);
    }
    
    // Mover archivo
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        jsonResponse(false, 'Error al guardar archivo', [], 500);
    }
    
    // Calcular MD5
    $md5 = md5_file($filepath);
    
    // Guardar en BD
    $stmt = $db->prepare('
        INSERT INTO files (filename, original_name, size_bytes, checksum_md5, printer_id, uploaded_by_user_id, is_private)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $filename,
        $originalName,
        $file['size'],
        $md5,
        $printerId,
        $user['id'],
        $isPrivate
    ]);
    $fileId = $db->lastInsertId();
    
    // Log
    $privacyText = $isPrivate ? 'privado' : 'público';
    logAction(
        $user['id'],
        'file_uploaded',
        'file',
        $fileId,
        "Archivo $privacyText subido: $originalName",
        ['size' => $file['size'], 'printer_id' => $printerId]
    );
    
    jsonResponse(true, 'Archivo subido exitosamente', [
        'file' => [
            'id' => $fileId,
            'filename' => $filename,
            'original_name' => $originalName,
            'size' => formatFileSize($file['size']),
            'size_bytes' => $file['size'],
            'is_private' => $isPrivate
        ]
    ], 201);
}

// ==================== LISTAR ARCHIVOS ====================

function listFiles() {
    global $db;
    
    $user = getCurrentUser();
    $printerId = $_GET['printer_id'] ?? null;
    $search = $_GET['search'] ?? '';
    
    $sql = '
        SELECT 
            f.*,
            u.username as uploaded_by_username,
            p.name as printer_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by_user_id = u.id
        LEFT JOIN printers p ON f.printer_id = p.id
        WHERE 1=1
    ';
    $params = [];
    
    // Usuario público: solo archivos públicos
    if (!$user) {
        $sql .= ' AND f.is_private = 0';
    }
    // Usuario registrado no admin: sus archivos + públicos + archivos de sus impresoras
    elseif ($user['role'] !== 'admin') {
        $sql .= ' AND (
            f.is_private = 0 
            OR f.uploaded_by_user_id = ?
            OR f.printer_id IN (
                SELECT printer_id FROM printer_assignments WHERE user_id = ?
            )
        )';
        $params[] = $user['id'];
        $params[] = $user['id'];
    }
    // Admin: todos los archivos
    
    if ($printerId) {
        $sql .= ' AND (f.printer_id = ? OR f.printer_id IS NULL)';
        $params[] = $printerId;
    }
    
    if (!empty($search)) {
        $sql .= ' AND f.original_name LIKE ?';
        $params[] = "%$search%";
    }
    
    $sql .= ' ORDER BY f.uploaded_at DESC';
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $files = $stmt->fetchAll();
    
    // Formatear respuesta
    foreach ($files as &$file) {
        $file['size'] = formatFileSize($file['size_bytes']);
        $file['uploaded_at_formatted'] = date('Y-m-d H:i:s', $file['uploaded_at']);
        
        // Verificar si archivo existe físicamente
        $file['exists'] = file_exists(UPLOAD_DIR . $file['filename']);
    }
    
    jsonResponse(true, 'OK', ['files' => $files]);
}

// ==================== OBTENER ARCHIVO ====================

function getFile() {
    global $db;
    
    $fileId = $_GET['id'] ?? 0;
    $user = getCurrentUser();
    
    if (!$fileId) {
        jsonResponse(false, 'ID de archivo requerido', [], 400);
    }
    
    $stmt = $db->prepare('
        SELECT 
            f.*,
            u.username as uploaded_by_username
        FROM files f
        LEFT JOIN users u ON f.uploaded_by_user_id = u.id
        WHERE f.id = ?
    ');
    $stmt->execute([$fileId]);
    $file = $stmt->fetch();
    
    if (!$file) {
        jsonResponse(false, 'Archivo no encontrado', [], 404);
    }
    
    // Verificar permisos
    $canView = false;
    
    if (!$file['is_private']) {
        $canView = true;
    } elseif ($user) {
        if ($user['role'] === 'admin' || $file['uploaded_by_user_id'] == $user['id']) {
            $canView = true;
        }
    }
    
    if (!$canView) {
        jsonResponse(false, 'Archivo privado', [], 403);
    }
    
    $file['size'] = formatFileSize($file['size_bytes']);
    $file['exists'] = file_exists(UPLOAD_DIR . $file['filename']);
    
    jsonResponse(true, 'OK', ['file' => $file]);
}

// ==================== ELIMINAR ARCHIVO ====================

function deleteFile() {
    $user = requireAuth();
    global $db;
    
    $fileId = $_GET['id'] ?? getRequestData()['id'] ?? 0;
    
    if (!$fileId) {
        jsonResponse(false, 'ID de archivo requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT * FROM files WHERE id = ?');
    $stmt->execute([$fileId]);
    $file = $stmt->fetch();
    
    if (!$file) {
        jsonResponse(false, 'Archivo no encontrado', [], 404);
    }
    
    // Solo admin o el dueño pueden eliminar
    if ($user['role'] !== 'admin' && $file['uploaded_by_user_id'] != $user['id']) {
        jsonResponse(false, 'No tienes permisos para eliminar este archivo', [], 403);
    }
    
    // Eliminar archivo físico
    $filepath = UPLOAD_DIR . $file['filename'];
    if (file_exists($filepath)) {
        unlink($filepath);
    }
    
    // Eliminar de BD
    $stmt = $db->prepare('DELETE FROM files WHERE id = ?');
    $stmt->execute([$fileId]);
    
    // Log
    logAction(
        $user['id'],
        'file_deleted',
        'file',
        $fileId,
        "Archivo eliminado: {$file['original_name']}"
    );
    
    jsonResponse(true, 'Archivo eliminado exitosamente');
}

// ==================== ENVIAR ARCHIVO A IMPRESORA ====================

function sendToPrinter() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $fileId = $data['file_id'] ?? 0;
    $printerId = $data['printer_id'] ?? 0;
    $isPrivate = (int)($data['is_private'] ?? 0);
    
    if (!$fileId || !$printerId) {
        jsonResponse(false, 'File ID y Printer ID requeridos', [], 400);
    }
    
    // Verificar archivo
    $stmt = $db->prepare('SELECT * FROM files WHERE id = ?');
    $stmt->execute([$fileId]);
    $file = $stmt->fetch();
    
    if (!$file) {
        jsonResponse(false, 'Archivo no encontrado', [], 404);
    }
    
    // Verificar que el archivo existe físicamente
    $filepath = UPLOAD_DIR . $file['filename'];
    if (!file_exists($filepath)) {
        jsonResponse(false, 'Archivo no encontrado en el servidor', [], 404);
    }
    
    // Verificar acceso a archivo privado
    if ($file['is_private'] && $user['role'] !== 'admin' && $file['uploaded_by_user_id'] != $user['id']) {
        jsonResponse(false, 'No tienes acceso a este archivo', [], 403);
    }
    
    // Verificar impresora
    $stmt = $db->prepare('SELECT name, is_blocked FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Impresora no encontrada', [], 404);
    }
    
    if ($printer['is_blocked']) {
        jsonResponse(false, 'Impresora bloqueada', [], 403);
    }
    
    // Verificar permisos de control
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
        jsonResponse(false, 'No tienes permisos para controlar esta impresora', [], 403);
    }
    
    // Verificar permisos de privacidad
    if ($isPrivate && !$user['can_print_private'] && $user['role'] !== 'admin') {
        jsonResponse(false, 'No tienes permisos para impresiones privadas', [], 403);
    }
    
    // Crear comando para imprimir archivo
    $command = "PRINT_FILE:{$file['filename']}";
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "basic", ?, 1, "pending")
    ');
    $stmt->execute([$printerId, $command]);
    $commandId = $db->lastInsertId();
    
    // Crear registro de trabajo
    $stmt = $db->prepare('
        INSERT INTO jobs (printer_id, file_id, user_id, started_at, status, is_private)
        VALUES (?, ?, ?, ?, "in_progress", ?)
    ');
    $stmt->execute([$printerId, $fileId, $user['id'], time(), $isPrivate]);
    $jobId = $db->lastInsertId();
    
    // Log
    $privacyText = $isPrivate ? 'privada' : 'pública';
    logAction(
        $user['id'],
        'print_started',
        'printer',
        $printerId,
        "Impresión $privacyText iniciada: {$file['original_name']} en {$printer['name']}",
        ['file_id' => $fileId, 'job_id' => $jobId, 'command_id' => $commandId]
    );
    
    jsonResponse(true, 'Archivo enviado a la impresora', [
        'job_id' => $jobId,
        'command_id' => $commandId
    ]);
}

// ==================== ESTABLECER PRIVACIDAD ====================

function setFilePrivacy() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $fileId = $data['file_id'] ?? 0;
    $isPrivate = (int)($data['is_private'] ?? 0);
    
    if (!$fileId) {
        jsonResponse(false, 'File ID requerido', [], 400);
    }
    
    // Verificar permisos para hacer privado
    if ($isPrivate && !$user['can_print_private'] && $user['role'] !== 'admin') {
        jsonResponse(false, 'No tienes permisos para archivos privados', [], 403);
    }
    
    $stmt = $db->prepare('SELECT * FROM files WHERE id = ?');
    $stmt->execute([$fileId]);
    $file = $stmt->fetch();
    
    if (!$file) {
        jsonResponse(false, 'Archivo no encontrado', [], 404);
    }
    
    // Solo admin o el dueño pueden cambiar privacidad
    if ($user['role'] !== 'admin' && $file['uploaded_by_user_id'] != $user['id']) {
        jsonResponse(false, 'No tienes permisos para modificar este archivo', [], 403);
    }
    
    $stmt = $db->prepare('UPDATE files SET is_private = ? WHERE id = ?');
    $stmt->execute([$isPrivate, $fileId]);
    
    $privacyText = $isPrivate ? 'privado' : 'público';
    logAction(
        $user['id'],
        'file_privacy_changed',
        'file',
        $fileId,
        "Archivo configurado como $privacyText: {$file['original_name']}"
    );
    
    jsonResponse(true, "Archivo configurado como $privacyText");
}

// ==================== DESCARGAR ARCHIVO ====================

function downloadFile() {
    global $db;
    
    $fileId = $_GET['id'] ?? 0;
    $user = getCurrentUser();
    
    if (!$fileId) {
        http_response_code(400);
        die('ID de archivo requerido');
    }
    
    $stmt = $db->prepare('SELECT * FROM files WHERE id = ?');
    $stmt->execute([$fileId]);
    $file = $stmt->fetch();
    
    if (!$file) {
        http_response_code(404);
        die('Archivo no encontrado');
    }
    
    // Verificar permisos
    $canDownload = false;
    
    if (!$file['is_private']) {
        $canDownload = true;
    } elseif ($user) {
        if ($user['role'] === 'admin' || $file['uploaded_by_user_id'] == $user['id']) {
            $canDownload = true;
        }
    }
    
    if (!$canDownload) {
        http_response_code(403);
        die('Acceso denegado');
    }
    
    $filepath = UPLOAD_DIR . $file['filename'];
    
    if (!file_exists($filepath)) {
        http_response_code(404);
        die('Archivo no encontrado en el servidor');
    }
    
    // Log
    if ($user) {
        logAction($user['id'], 'file_downloaded', 'file', $fileId, "Descargó: {$file['original_name']}");
    }
    
    // Enviar archivo
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $file['original_name'] . '"');
    header('Content-Length: ' . filesize($filepath));
    readfile($filepath);
    exit;
}
