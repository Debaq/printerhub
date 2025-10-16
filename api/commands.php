<?php
/**
 * PrinterHub - Commands API
 * Envío y gestión de comandos a impresoras
 */

require_once __DIR__ . '/config.php';

$db = getDB();
$action = $_GET['action'] ?? getRequestData()['action'] ?? '';

switch ($action) {
    case 'send':
        sendCommand();
        break;
    case 'pause':
        pausePrint();
        break;
    case 'resume':
        resumePrint();
        break;
    case 'cancel':
        cancelPrint();
        break;
    case 'emergency_stop':
        emergencyStop();
        break;
    case 'home':
        homeAxes();
        break;
    case 'heat':
        setTemperature();
        break;
    case 'set_speed':
        setSpeed();
        break;
    case 'custom_gcode':
        sendCustomGcode();
        break;
    case 'history':
        getCommandHistory();
        break;
    case 'pending':
        getPendingCommands();
        break;
    case 'actions_log':
        getActionsLog();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== ENVIAR COMANDO GENÉRICO ====================

function sendCommand() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $type = $data['type'] ?? 'basic';
    $command = $data['command'] ?? '';
    $priority = $data['priority'] ?? 5;
    
    if (!$printerId || empty($command)) {
        jsonResponse(false, 'Printer ID y comando requeridos', [], 400);
    }
    
    // Verificar acceso
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
        jsonResponse(false, 'No tienes permisos para controlar esta impresora', [], 403);
    }
    
    // Verificar que la impresora existe y no está bloqueada
    $stmt = $db->prepare('SELECT name, is_blocked FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Impresora no encontrada', [], 404);
    }
    
    if ($printer['is_blocked']) {
        jsonResponse(false, 'Impresora bloqueada', [], 403);
    }
    
    // Validar gcode si es tipo gcode
    if ($type === 'gcode' && !isValidGcode($command)) {
        jsonResponse(false, 'Comando gcode contiene instrucciones peligrosas', [], 400);
    }
    
    // Insertar comando
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, ?, ?, ?, "pending")
    ');
    $stmt->execute([$printerId, $type, $command, $priority]);
    $commandId = $db->lastInsertId();
    
    // Registrar en historial
    $stmt = $db->prepare('
        INSERT INTO command_history (command_id, printer_id, user_id, result)
        VALUES (?, ?, ?, "sent")
    ');
    $stmt->execute([$commandId, $printerId, $user['id']]);
    
    // Log de auditoría
    logAction(
        $user['id'], 
        'command_sent', 
        'printer', 
        $printerId, 
        "Comando enviado a {$printer['name']}: $command",
        ['command_id' => $commandId, 'type' => $type]
    );
    
    jsonResponse(true, 'Comando enviado exitosamente', [
        'command_id' => $commandId
    ]);
}

// ==================== PAUSAR IMPRESIÓN ====================

function pausePrint() {
    $user = requireAuth();
    global $db;
    
    $printerId = getRequestData()['printer_id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    // TODOS los usuarios registrados pueden pausar cualquier impresión
    
    // Verificar impresora
    $stmt = $db->prepare('SELECT name, is_blocked FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer || $printer['is_blocked']) {
        jsonResponse(false, 'Impresora no disponible', [], 403);
    }
    
    // Enviar comando de pausa
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "basic", "PAUSE", 1, "pending")
    ');
    $stmt->execute([$printerId]);
    $commandId = $db->lastInsertId();
    
    // Historial
    $stmt = $db->prepare('
        INSERT INTO command_history (command_id, printer_id, user_id, result)
        VALUES (?, ?, ?, "sent")
    ');
    $stmt->execute([$commandId, $printerId, $user['id']]);
    
    // Log detallado
    logAction(
        $user['id'], 
        'print_paused', 
        'printer', 
        $printerId, 
        "{$user['username']} pausó la impresión en {$printer['name']}",
        ['command_id' => $commandId]
    );
    
    jsonResponse(true, 'Impresión pausada', ['command_id' => $commandId]);
}

// ==================== REANUDAR IMPRESIÓN ====================

function resumePrint() {
    $user = requireAuth();
    global $db;
    
    $printerId = getRequestData()['printer_id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT name, is_blocked FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer || $printer['is_blocked']) {
        jsonResponse(false, 'Impresora no disponible', [], 403);
    }
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "basic", "RESUME", 1, "pending")
    ');
    $stmt->execute([$printerId]);
    $commandId = $db->lastInsertId();
    
    $stmt = $db->prepare('
        INSERT INTO command_history (command_id, printer_id, user_id, result)
        VALUES (?, ?, ?, "sent")
    ');
    $stmt->execute([$commandId, $printerId, $user['id']]);
    
    logAction(
        $user['id'], 
        'print_resumed', 
        'printer', 
        $printerId, 
        "{$user['username']} reanudó la impresión en {$printer['name']}"
    );
    
    jsonResponse(true, 'Impresión reanudada', ['command_id' => $commandId]);
}

// ==================== CANCELAR IMPRESIÓN ====================

function cancelPrint() {
    $user = requireAuth();
    global $db;
    
    $printerId = getRequestData()['printer_id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    // TODOS los usuarios registrados pueden cancelar
    
    $stmt = $db->prepare('SELECT name, is_blocked FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer || $printer['is_blocked']) {
        jsonResponse(false, 'Impresora no disponible', [], 403);
    }
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "basic", "CANCEL", 1, "pending")
    ');
    $stmt->execute([$printerId]);
    $commandId = $db->lastInsertId();
    
    $stmt = $db->prepare('
        INSERT INTO command_history (command_id, printer_id, user_id, result)
        VALUES (?, ?, ?, "sent")
    ');
    $stmt->execute([$commandId, $printerId, $user['id']]);
    
    logAction(
        $user['id'], 
        'print_cancelled', 
        'printer', 
        $printerId, 
        "{$user['username']} canceló la impresión en {$printer['name']}",
        ['severity' => 'warning']
    );
    
    jsonResponse(true, 'Impresión cancelada', ['command_id' => $commandId]);
}

// ==================== PARADA DE EMERGENCIA ====================

function emergencyStop() {
    $user = requireAuth();
    global $db;
    
    $printerId = getRequestData()['printer_id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT name, is_blocked FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Impresora no encontrada', [], 404);
    }
    
    // Emergency stop tiene máxima prioridad
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "basic", "EMERGENCY_STOP", 0, "pending")
    ');
    $stmt->execute([$printerId]);
    $commandId = $db->lastInsertId();
    
    $stmt = $db->prepare('
        INSERT INTO command_history (command_id, printer_id, user_id, result)
        VALUES (?, ?, ?, "sent")
    ');
    $stmt->execute([$commandId, $printerId, $user['id']]);
    
    logAction(
        $user['id'], 
        'emergency_stop', 
        'printer', 
        $printerId, 
        "🚨 {$user['username']} activó PARADA DE EMERGENCIA en {$printer['name']}",
        ['severity' => 'critical']
    );
    
    jsonResponse(true, 'Parada de emergencia activada', ['command_id' => $commandId]);
}

// ==================== HOME ====================

function homeAxes() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $axes = $data['axes'] ?? 'XYZ'; // X, Y, Z, XYZ
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    $gcode = "G28 $axes";
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "gcode", ?, 2, "pending")
    ');
    $stmt->execute([$printerId, $gcode]);
    $commandId = $db->lastInsertId();
    
    logAction($user['id'], 'home_axes', 'printer', $printerId, "Home $axes");
    
    jsonResponse(true, "Home $axes enviado", ['command_id' => $commandId]);
}

// ==================== ESTABLECER TEMPERATURA ====================

function setTemperature() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $hotend = $data['hotend'] ?? null;
    $bed = $data['bed'] ?? null;
    
    if (!$printerId || ($hotend === null && $bed === null)) {
        jsonResponse(false, 'Printer ID y al menos una temperatura requeridos', [], 400);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    $commands = [];
    
    if ($hotend !== null) {
        $commands[] = "M104 S$hotend";
    }
    
    if ($bed !== null) {
        $commands[] = "M140 S$bed";
    }
    
    $gcode = implode("\n", $commands);
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "gcode", ?, 3, "pending")
    ');
    $stmt->execute([$printerId, $gcode]);
    $commandId = $db->lastInsertId();
    
    logAction($user['id'], 'set_temperature', 'printer', $printerId, "Temperaturas configuradas");
    
    jsonResponse(true, 'Temperaturas configuradas', ['command_id' => $commandId]);
}

// ==================== ESTABLECER VELOCIDAD ====================

function setSpeed() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $speed = $data['speed'] ?? 100;
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    if ($speed < 10 || $speed > 200) {
        jsonResponse(false, 'Velocidad debe estar entre 10% y 200%', [], 400);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    $gcode = "M220 S$speed";
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "gcode", ?, 4, "pending")
    ');
    $stmt->execute([$printerId, $gcode]);
    $commandId = $db->lastInsertId();
    
    logAction($user['id'], 'set_speed', 'printer', $printerId, "Velocidad configurada a {$speed}%");
    
    jsonResponse(true, "Velocidad configurada a {$speed}%", ['command_id' => $commandId]);
}

// ==================== GCODE PERSONALIZADO ====================

function sendCustomGcode() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $gcode = trim($data['gcode'] ?? '');
    
    if (!$printerId || empty($gcode)) {
        jsonResponse(false, 'Printer ID y gcode requeridos', [], 400);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId, true)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    if (!isValidGcode($gcode)) {
        jsonResponse(false, 'Gcode contiene comandos peligrosos', [], 400);
    }
    
    $stmt = $db->prepare('
        INSERT INTO commands (printer_id, type, command, priority, status)
        VALUES (?, "gcode", ?, 5, "pending")
    ');
    $stmt->execute([$printerId, $gcode]);
    $commandId = $db->lastInsertId();
    
    logAction($user['id'], 'custom_gcode', 'printer', $printerId, "Gcode personalizado enviado");
    
    jsonResponse(true, 'Gcode enviado', ['command_id' => $commandId]);
}

// ==================== HISTORIAL DE COMANDOS ====================

function getCommandHistory() {
    global $db;
    
    $printerId = $_GET['printer_id'] ?? 0;
    $limit = min((int)($_GET['limit'] ?? 50), 200);
    $user = getCurrentUser();
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    // Verificar acceso (usuario público no puede ver historial)
    if (!$user) {
        jsonResponse(false, 'Autenticación requerida', [], 401);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    $stmt = $db->prepare('
        SELECT 
            ch.*,
            c.type,
            c.command,
            u.username
        FROM command_history ch
        INNER JOIN commands c ON ch.command_id = c.id
        LEFT JOIN users u ON ch.user_id = u.id
        WHERE ch.printer_id = ?
        ORDER BY ch.executed_at DESC
        LIMIT ?
    ');
    $stmt->execute([$printerId, $limit]);
    $history = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['history' => $history]);
}

// ==================== COMANDOS PENDIENTES ====================

function getPendingCommands() {
    $user = requireAuth();
    global $db;
    
    $printerId = $_GET['printer_id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'Printer ID requerido', [], 400);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    $stmt = $db->prepare('
        SELECT * FROM commands
        WHERE printer_id = ? AND status = "pending"
        ORDER BY priority, created_at
    ');
    $stmt->execute([$printerId]);
    $commands = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['commands' => $commands]);
}

// ==================== LOG DE ACCIONES (AUDITORÍA) ====================

function getActionsLog() {
    global $db;
    
    $user = getCurrentUser();
    $printerId = $_GET['printer_id'] ?? null;
    $actionType = $_GET['action_type'] ?? '';
    $limit = min((int)($_GET['limit'] ?? 100), 500);
    
    // Solo usuarios autenticados pueden ver el log
    if (!$user) {
        jsonResponse(false, 'Autenticación requerida', [], 401);
    }
    
    $sql = '
        SELECT 
            al.*,
            u.username,
            p.name as printer_name
        FROM action_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN printers p ON al.target_id = p.id AND al.target_type = "printer"
        WHERE 1=1
    ';
    $params = [];
    
    if ($printerId) {
        // Verificar acceso a la impresora
        if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId)) {
            jsonResponse(false, 'Acceso denegado', [], 403);
        }
        $sql .= ' AND al.target_id = ? AND al.target_type = "printer"';
        $params[] = $printerId;
    }
    
    if (!empty($actionType)) {
        $sql .= ' AND al.action_type = ?';
        $params[] = $actionType;
    }
    
    $sql .= ' ORDER BY al.created_at DESC LIMIT ?';
    $params[] = $limit;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();
    
    // Parsear metadata
    foreach ($logs as &$log) {
        if (!empty($log['metadata'])) {
            $log['metadata'] = json_decode($log['metadata'], true);
        }
    }
    
    jsonResponse(true, 'OK', ['logs' => $logs]);
}
