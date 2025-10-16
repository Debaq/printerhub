<?php
/**
 * PrinterHub - Printer API: Update Endpoint
 * Recibe actualizaciones de estado desde el cliente Python
 * 
 * El cliente envía POST cada 5 segundos con el estado completo
 */

require_once __DIR__ . '/config.php';

// Solo permitir POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Método no permitido');
}

// Obtener datos del cliente
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    jsonResponse(false, 'Datos inválidos');
}

// Validar campos requeridos
$token = $data['token'] ?? '';
$name = $data['name'] ?? '';
$status = $data['status'] ?? 'unknown';

if (empty($token)) {
    jsonResponse(false, 'Token requerido');
}

// Obtener o crear impresora
$printer = getOrCreatePrinter($token, $name);
$printerId = $printer['id'];

$db = getDB();
$now = time();

try {
    // Iniciar transacción
    $db->beginTransaction();
    
    // Actualizar última vez vista
    $stmt = $db->prepare('
        UPDATE printers 
        SET last_seen = ?, status = ?
        WHERE id = ?
    ');
    $stmt->execute([$now, $status, $printerId]);
    
    // Preparar datos del estado
    $progress = $data['progress'] ?? 0;
    $currentFile = $data['current_file'] ?? '';
    $tempHotend = $data['temp_hotend'] ?? 0;
    $tempBed = $data['temp_bed'] ?? 0;
    $tempHotendTarget = $data['temp_hotend_target'] ?? 0;
    $tempBedTarget = $data['temp_bed_target'] ?? 0;
    $printSpeed = $data['print_speed'] ?? 100;
    $fanSpeed = $data['fan_speed'] ?? 0;
    $timeRemaining = $data['time_remaining'] ?? null;
    $image = $data['image'] ?? '';
    $uptime = $data['uptime'] ?? '';
    $bedStatus = $data['bed_status'] ?? '';
    
    // JSON fields
    $filament = isset($data['filament']) ? json_encode($data['filament']) : null;
    $tags = isset($data['tags']) ? json_encode($data['tags']) : '[]';
    $files = isset($data['files']) ? json_encode($data['files']) : '[]';
    $rawData = json_encode($data);
    
    // Verificar si ya existe un estado para esta impresora
    $stmt = $db->prepare('SELECT printer_id FROM printer_states WHERE printer_id = ?');
    $stmt->execute([$printerId]);
    $existingState = $stmt->fetch();
    
    if ($existingState) {
        // Actualizar estado existente
        $stmt = $db->prepare('
            UPDATE printer_states SET
                status = ?,
                progress = ?,
                current_file = ?,
                temp_hotend = ?,
                temp_bed = ?,
                temp_hotend_target = ?,
                temp_bed_target = ?,
                print_speed = ?,
                fan_speed = ?,
                time_remaining = ?,
                image = ?,
                uptime = ?,
                bed_status = ?,
                filament = ?,
                tags = ?,
                files = ?,
                raw_data = ?,
                updated_at = ?
            WHERE printer_id = ?
        ');
        
        $stmt->execute([
            $status,
            $progress,
            $currentFile,
            $tempHotend,
            $tempBed,
            $tempHotendTarget,
            $tempBedTarget,
            $printSpeed,
            $fanSpeed,
            $timeRemaining,
            $image,
            $uptime,
            $bedStatus,
            $filament,
            $tags,
            $files,
            $rawData,
            $now,
            $printerId
        ]);
    } else {
        // Insertar nuevo estado
        $stmt = $db->prepare('
            INSERT INTO printer_states (
                printer_id, status, progress, current_file,
                temp_hotend, temp_bed, temp_hotend_target, temp_bed_target,
                print_speed, fan_speed, time_remaining, image, uptime,
                bed_status, filament, tags, files, raw_data, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        
        $stmt->execute([
            $printerId,
            $status,
            $progress,
            $currentFile,
            $tempHotend,
            $tempBed,
            $tempHotendTarget,
            $tempBedTarget,
            $printSpeed,
            $fanSpeed,
            $timeRemaining,
            $image,
            $uptime,
            $bedStatus,
            $filament,
            $tags,
            $files,
            $rawData,
            $now
        ]);
    }
    
    // Commit transacción
    $db->commit();
    
    jsonResponse(true, 'Estado actualizado', [
        'printer_id' => $printerId,
        'timestamp' => $now
    ]);
    
} catch (Exception $e) {
    $db->rollBack();
    error_log("Error actualizando estado: " . $e->getMessage());
    jsonResponse(false, 'Error actualizando estado: ' . $e->getMessage());
}
