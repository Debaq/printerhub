<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Directorios
define('UPLOAD_DIR', 'uploads/');
define('FILES_FILE', 'files.json');

// Crear directorio si no existe
if (!file_exists(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0777, true);
}

if (!file_exists(FILES_FILE)) {
    file_put_contents(FILES_FILE, json_encode([]));
}

// Obtener método y acción
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleGet();
} elseif ($method === 'POST') {
    handlePost();
}

// Manejar peticiones GET
function handleGet() {
    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'list_files':
            listFiles();
            break;
        case 'download_file':
            downloadFile();
            break;
        case 'get_file_info':
            getFileInfo();
            break;
        default:
            response(false, 'Acción no válida');
    }
}

// Manejar peticiones POST
function handlePost() {
    $action = $_POST['action'] ?? $_GET['action'] ?? '';

    switch ($action) {
        case 'upload_file':
            uploadFile();
            break;
        case 'delete_file':
            deleteFile();
            break;
        case 'mark_downloaded':
            markDownloaded();
            break;
        default:
            response(false, 'Acción no válida');
    }
}

// Listar archivos del servidor (filtrados por impresora si se proporciona token)
function listFiles() {
    $printerToken = $_GET['printer_token'] ?? '';
    $files = loadJson(FILES_FILE);

    // Filtrar por impresora si se proporciona token
    if (!empty($printerToken)) {
        $files = array_filter($files, function($file) use ($printerToken) {
            return ($file['printer_token'] ?? '') === $printerToken;
        });
        $files = array_values($files); // Reindexar
    }

    // Agregar información adicional de cada archivo
    foreach ($files as &$file) {
        $filePath = UPLOAD_DIR . $file['name'];
        if (file_exists($filePath)) {
            $file['exists'] = true;
            $file['real_size'] = filesize($filePath);
        } else {
            $file['exists'] = false;
        }

        // Verificar si ya fue descargado
        $file['downloaded'] = $file['downloaded'] ?? false;
    }

    response(true, 'OK', ['files' => $files]);
}

// Subir archivo al servidor
function uploadFile() {
    if (!isset($_FILES['file'])) {
        response(false, 'No se recibió archivo');
        return;
    }

    $file = $_FILES['file'];
    $fileName = basename($file['name']);
    $printerToken = $_POST['printer_token'] ?? '';

    // Validar token de impresora
    if (empty($printerToken)) {
        response(false, 'Token de impresora requerido');
        return;
    }

    // Validar extensión
    if (!preg_match('/\.gcode$/i', $fileName)) {
        response(false, 'Solo archivos .gcode permitidos');
        return;
    }

    // Validar tamaño (máximo 100MB)
    $maxSize = 100 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        response(false, 'Archivo demasiado grande (máximo 100MB)');
        return;
    }

    $targetPath = UPLOAD_DIR . $fileName;

    // Si el archivo ya existe, agregar timestamp
    if (file_exists($targetPath)) {
        $pathInfo = pathinfo($fileName);
        $fileName = $pathInfo['filename'] . '_' . time() . '.' . $pathInfo['extension'];
        $targetPath = UPLOAD_DIR . $fileName;
    }

    // Mover archivo
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        // Agregar a lista de archivos
        $files = loadJson(FILES_FILE);

        $newFile = [
            'name' => $fileName,
            'original_name' => $file['name'],
            'size' => formatBytes($file['size']),
            'size_bytes' => $file['size'],
            'path' => $targetPath,
            'uploaded' => date('Y-m-d H:i:s'),
            'uploaded_by' => $_POST['uploaded_by'] ?? 'admin',
            'printer_token' => $printerToken,
            'md5' => md5_file($targetPath),
            'downloaded' => false
        ];

        $files[] = $newFile;
        saveJson(FILES_FILE, $files);

        response(true, 'Archivo subido exitosamente', [
            'file' => $newFile
        ]);
    } else {
        response(false, 'Error al guardar archivo');
    }
}

// Descargar archivo
function downloadFile() {
    $fileName = $_GET['file'] ?? '';
    $printerToken = $_GET['printer_token'] ?? '';

    if (empty($fileName)) {
        response(false, 'Nombre de archivo requerido');
        return;
    }

    // Sanitizar nombre de archivo
    $fileName = basename($fileName);
    $filePath = UPLOAD_DIR . $fileName;

    if (!file_exists($filePath)) {
        response(false, 'Archivo no encontrado');
        return;
    }

    // Verificar que el archivo pertenece a esta impresora
    if (!empty($printerToken)) {
        $files = loadJson(FILES_FILE);
        $authorized = false;

        foreach ($files as $file) {
            if ($file['name'] === $fileName && $file['printer_token'] === $printerToken) {
                $authorized = true;
                break;
            }
        }

        if (!$authorized) {
            response(false, 'No autorizado para descargar este archivo');
            return;
        }
    }

    // Registrar descarga
    logDownload($fileName, $printerToken);

    // Enviar archivo
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $fileName . '"');
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');

    readfile($filePath);
    exit;
}

// Marcar archivo como descargado y eliminarlo del servidor
function markDownloaded() {
    $data = json_decode(file_get_contents('php://input'), true);
    $fileName = $data['file'] ?? '';
    $printerToken = $data['printer_token'] ?? '';

    if (empty($fileName) || empty($printerToken)) {
        response(false, 'Datos incompletos');
        return;
    }

    $fileName = basename($fileName);
    $filePath = UPLOAD_DIR . $fileName;

    $files = loadJson(FILES_FILE);
    $found = false;

    // Buscar el archivo y verificar token
    foreach ($files as $key => $file) {
        if ($file['name'] === $fileName && $file['printer_token'] === $printerToken) {
            $found = true;

            // Eliminar archivo físico
            if (file_exists($filePath)) {
                unlink($filePath);
            }

            // Eliminar de la lista
            unset($files[$key]);
            break;
        }
    }

    if (!$found) {
        response(false, 'Archivo no encontrado o no autorizado');
        return;
    }

    // Reindexar y guardar
    $files = array_values($files);
    saveJson(FILES_FILE, $files);

    response(true, 'Archivo marcado como descargado y eliminado del servidor');
}

// Obtener información detallada de un archivo
function getFileInfo() {
    $fileName = $_GET['file'] ?? '';

    if (empty($fileName)) {
        response(false, 'Nombre de archivo requerido');
        return;
    }

    $files = loadJson(FILES_FILE);

    foreach ($files as $file) {
        if ($file['name'] === $fileName) {
            $filePath = UPLOAD_DIR . $fileName;

            if (file_exists($filePath)) {
                $file['exists'] = true;
                $file['real_size'] = filesize($filePath);
                $file['modified'] = date('Y-m-d H:i:s', filemtime($filePath));
            } else {
                $file['exists'] = false;
            }

            response(true, 'OK', ['file' => $file]);
            return;
        }
    }

    response(false, 'Archivo no encontrado en la base de datos');
}

// Eliminar archivo manualmente
function deleteFile() {
    $data = json_decode(file_get_contents('php://input'), true);
    $fileName = $data['file'] ?? '';

    if (empty($fileName)) {
        response(false, 'Nombre de archivo requerido');
        return;
    }

    $fileName = basename($fileName);
    $filePath = UPLOAD_DIR . $fileName;

    // Eliminar archivo físico
    if (file_exists($filePath)) {
        unlink($filePath);
    }

    // Eliminar de la lista
    $files = loadJson(FILES_FILE);
    $files = array_filter($files, function($file) use ($fileName) {
        return $file['name'] !== $fileName;
    });
    $files = array_values($files);

    saveJson(FILES_FILE, $files);

    response(true, 'Archivo eliminado exitosamente');
}

// Registrar descarga
function logDownload($fileName, $printerToken) {
    $logFile = 'download_log.json';

    if (!file_exists($logFile)) {
        file_put_contents($logFile, json_encode([]));
    }

    $logs = json_decode(file_get_contents($logFile), true) ?: [];

    $logs[] = [
        'file' => $fileName,
        'printer_token' => $printerToken,
        'timestamp' => date('Y-m-d H:i:s'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ];

    // Mantener solo los últimos 1000 registros
    if (count($logs) > 1000) {
        $logs = array_slice($logs, -1000);
    }

    file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT));
}

// Formatear bytes
function formatBytes($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $i = 0;
    while ($bytes >= 1024 && $i < 3) {
        $bytes /= 1024;
        $i++;
    }
    return round($bytes, 2) . ' ' . $units[$i];
}

// Cargar JSON
function loadJson($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = file_get_contents($file);
    return json_decode($content, true) ?: [];
}

// Guardar JSON
function saveJson($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

// Respuesta JSON
function response($success, $message, $data = []) {
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}
?>
