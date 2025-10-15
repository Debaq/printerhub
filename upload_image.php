<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Directorio para almacenar imágenes
define('IMAGES_DIR', 'printer_images');

// Crear directorio si no existe
if (!file_exists(IMAGES_DIR)) {
    mkdir(IMAGES_DIR, 0755, true);
}

// Verificar que se recibió un archivo
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    response(false, 'No se recibió imagen válida');
}

// Verificar token
$token = $_POST['token'] ?? '';
if (empty($token)) {
    response(false, 'Token requerido');
}

// Limpiar token para nombre de archivo
$safe_token = preg_replace('/[^a-zA-Z0-9_-]/', '', $token);

// Nombre del archivo
$filename = $safe_token . '.jpg';
$filepath = IMAGES_DIR . '/' . $filename;

// Mover archivo subido
if (move_uploaded_file($_FILES['image']['tmp_name'], $filepath)) {
    // URL de la imagen
    $image_url = 'printer_images/' . $filename . '?t=' . time();
    
    response(true, 'Imagen guardada', [
        'image_url' => $image_url
    ]);
} else {
    response(false, 'Error guardando imagen');
}

function response($success, $message, $data = []) {
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}
?>