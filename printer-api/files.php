<?php
/**
 * PrinterHub - Printer API: Files Endpoint
 * Gestión de archivos gcode para descarga a impresoras
 * 
 * Endpoints:
 * - GET ?action=list_files&printer_token=XXX  - Lista archivos disponibles
 * - GET ?action=download_file&file=XXX&printer_token=XXX - Descarga archivo
 * - POST action=mark_downloaded - Marca archivo como descargado
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleGet();
} elseif ($method === 'POST') {
    handlePost();
} else {
    jsonResponse(false, 'Método no permitido');
}

/**
 * Manejar peticiones GET
 */
function handleGet() {
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'list_files':
            listFiles();
            break;
        case 'download_file':
            downloadFile();
            break;
        default:
            jsonResponse(false, 'Acción no válida');
    }
}

/**
 * Manejar peticiones POST
 */
function handlePost() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    $action = $data['action'] ?? '';
    
    switch ($action) {
        case 'mark_downloaded':
            markDownloaded($data);
            break;
        default:
            jsonResponse(false, 'Acción no válida');
    }
}

/**
 * Listar archivos disponibles para una impresora
 */
function listFiles() {
    $printerToken = $_GET['printer_token'] ?? '';
    
    if (empty($printerToken)) {
        jsonResponse(false, 'Token requerido');
    }
    
    // Validar impresora
    $printer = validatePrinterToken($printerToken);
    $printerId = $printer['id'];
    
    $db = getDB();
    
    try {
        // Obtener archivos: propios de la impresora O sin impresora asignada (disponibles para todas)
        $stmt = $db->prepare('
            SELECT 
                id,
                filename,
                original_name,
                size_bytes,
                checksum_md5,
                uploaded_at,
                downloaded
            FROM files
            WHERE printer_id = ? OR printer_id IS NULL
            ORDER BY uploaded_at DESC
        ');
        $stmt->execute([$printerId]);
        $files = $stmt->fetchAll();
        
        // Verificar existencia física y agregar información adicional
        $formattedFiles = [];
        foreach ($files as $file) {
            $filePath = UPLOAD_DIR . $file['filename'];
            $exists = file_exists($filePath);
            
            $formattedFiles[] = [
                'name' => $file['filename'],
                'original_name' => $file['original_name'] ?? $file['filename'],
                'size' => formatBytes($file['size_bytes']),
                'size_bytes' => (int)$file['size_bytes'],
                'md5' => $file['checksum_md5'],
                'uploaded' => date('Y-m-d H:i:s', $file['uploaded_at']),
                'downloaded' => (bool)$file['downloaded'],
                'exists' => $exists
            ];
        }
        
        jsonResponse(true, 'OK', [
            'files' => $formattedFiles
        ]);
        
    } catch (Exception $e) {
        error_log("Error listando archivos: " . $e->getMessage());
        jsonResponse(false, 'Error listando archivos');
    }
}

/**
 * Descargar archivo
 */
function downloadFile() {
    $fileName = $_GET['file'] ?? '';
    $printerToken = $_GET['printer_token'] ?? '';
    
    if (empty($fileName) || empty($printerToken)) {
        jsonResponse(false, 'Parámetros incompletos');
    }
    
    // Validar impresora
    $printer = validatePrinterToken($printerToken);
    $printerId = $printer['id'];
    
    // Sanitizar nombre de archivo
    $fileName = basename($fileName);
    $filePath = UPLOAD_DIR . $fileName;
    
    if (!file_exists($filePath)) {
        jsonResponse(false, 'Archivo no encontrado');
    }
    
    $db = getDB();
    
    try {
        // Verificar que el archivo pertenece a esta impresora o es global
        $stmt = $db->prepare('
            SELECT * FROM files
            WHERE filename = ? AND (printer_id = ? OR printer_id IS NULL)
        ');
        $stmt->execute([$fileName, $printerId]);
        $file = $stmt->fetch();
        
        if (!$file) {
            jsonResponse(false, 'No autorizado para descargar este archivo');
        }
        
        // Enviar archivo
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: 0');
        
        readfile($filePath);
        exit;
        
    } catch (Exception $e) {
        error_log("Error descargando archivo: " . $e->getMessage());
        jsonResponse(false, 'Error descargando archivo');
    }
}

/**
 * Marcar archivo como descargado
 */
function markDownloaded($data) {
    $fileName = $data['file'] ?? '';
    $printerToken = $data['printer_token'] ?? '';
    
    if (empty($fileName) || empty($printerToken)) {
        jsonResponse(false, 'Datos incompletos');
    }
    
    // Validar impresora
    $printer = validatePrinterToken($printerToken);
    $printerId = $printer['id'];
    
    $fileName = basename($fileName);
    
    $db = getDB();
    
    try {
        // Marcar como descargado
        $stmt = $db->prepare('
            UPDATE files
            SET downloaded = 1
            WHERE filename = ? AND (printer_id = ? OR printer_id IS NULL)
        ');
        $stmt->execute([$fileName, $printerId]);
        
        if ($stmt->rowCount() === 0) {
            jsonResponse(false, 'Archivo no encontrado o no autorizado');
        }
        
        jsonResponse(true, 'Archivo marcado como descargado');
        
    } catch (Exception $e) {
        error_log("Error marcando archivo: " . $e->getMessage());
        jsonResponse(false, 'Error actualizando archivo');
    }
}

/**
 * Formatear bytes a formato legible
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}
