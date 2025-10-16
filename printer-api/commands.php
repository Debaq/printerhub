<?php
/**
 * PrinterHub - Printer API: Commands Endpoint
 * Entrega comandos pendientes al cliente Python
 * 
 * El cliente hace GET cada 3 segundos pidiendo comandos pendientes
 */

require_once __DIR__ . '/config.php';

// Solo permitir GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, 'Método no permitido');
}

// Obtener token de la impresora
$token = $_GET['token'] ?? '';

if (empty($token)) {
    jsonResponse(false, 'Token requerido');
}

// Validar impresora
$printer = validatePrinterToken($token);
$printerId = $printer['id'];

$db = getDB();

try {
    // Obtener comandos pendientes ordenados por prioridad
    $stmt = $db->prepare('
        SELECT id, type, command, priority
        FROM commands
        WHERE printer_id = ? AND status = "pending"
        ORDER BY priority ASC, created_at ASC
        LIMIT 10
    ');
    $stmt->execute([$printerId]);
    $commands = $stmt->fetchAll();
    
    // Si hay comandos, marcarlos como "sent"
    if (!empty($commands)) {
        $commandIds = array_column($commands, 'id');
        $placeholders = str_repeat('?,', count($commandIds) - 1) . '?';
        
        $stmt = $db->prepare("
            UPDATE commands 
            SET status = 'sent', sent_at = ?
            WHERE id IN ($placeholders)
        ");
        
        $params = array_merge([time()], $commandIds);
        $stmt->execute($params);
    }
    
    // Formatear comandos para el cliente
    $formattedCommands = array_map(function($cmd) {
        return [
            'id' => $cmd['id'],
            'type' => $cmd['type'],
            'command' => $cmd['command'],
            'priority' => (int)$cmd['priority']
        ];
    }, $commands);
    
    jsonResponse(true, 'OK', [
        'commands' => $formattedCommands
    ]);
    
} catch (Exception $e) {
    error_log("Error obteniendo comandos: " . $e->getMessage());
    jsonResponse(false, 'Error obteniendo comandos');
}
