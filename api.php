<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Archivos de datos
define('PRINTERS_FILE', 'printers.json');
define('COMMANDS_FILE', 'commands.json');
define('OFFLINE_TIMEOUT', 60);

// Inicializar archivos si no existen
if (!file_exists(PRINTERS_FILE)) {
    file_put_contents(PRINTERS_FILE, json_encode([]));
}
if (!file_exists(COMMANDS_FILE)) {
    file_put_contents(COMMANDS_FILE, json_encode([]));
}

// Obtener método de petición
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
        case 'get_printers':
            getPrinters();
            break;
        case 'get_commands':
            getCommands();
            break;
        case 'get_printer_by_token':
            getPrinterByToken();
            break;
        default:
            response(false, 'Acción no válida');
    }
}

// Manejar peticiones POST
function handlePost() {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    switch ($action) {
        case 'update_printer':
            updatePrinter($data);
            break;
        case 'home':
        case 'heat':
        case 'pause':
        case 'resume':
        case 'emergency_stop':
        case 'reboot':
        case 'toggle_fan':
            sendCommand($data);
            break;
        case 'set_speed':
            setSpeed($data);
            break;
        case 'print':
            startPrint($data);
            break;
        case 'print_local':
            startPrintLocal($data);
            break;
        case 'save_notes':
            saveNotes($data);
            break;
        case 'update_bed_status':
            updateBedStatus($data);
            break;
        case 'add_tag':
            addTag($data);
            break;
        case 'remove_tag':
            removeTag($data);
            break;
        default:
            response(false, 'Acción no válida');
    }
}

// Obtener lista de impresoras
function getPrinters() {
    $printers = loadJson(PRINTERS_FILE);
    $currentTime = time();

    // Marcar impresoras offline si no han enviado datos recientemente
    foreach ($printers as &$printer) {
        $lastSeen = $printer['last_seen'] ?? 0;
        if ($currentTime - $lastSeen > OFFLINE_TIMEOUT) {
            $printer['status'] = 'offline';
        }
    }

    // Ordenar por token para mantener orden consistente
    usort($printers, function($a, $b) {
        return strcmp($a['token'], $b['token']);
    });

    response(true, 'OK', ['printers' => $printers]);
}

// Obtener impresora por token
function getPrinterByToken() {
    $token = $_GET['token'] ?? '';

    if (empty($token)) {
        response(false, 'Token requerido');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);

    foreach ($printers as $printer) {
        if ($printer['token'] === $token) {
            response(true, 'OK', ['printer' => $printer]);
            return;
        }
    }

    response(false, 'Impresora no encontrada');
}

// Obtener comandos pendientes para una impresora
function getCommands() {
    $token = $_GET['token'] ?? '';

    if (empty($token)) {
        response(false, 'Token requerido');
        return;
    }

    $commands = loadJson(COMMANDS_FILE);
    $pending = [];
    $remaining = [];

    // Separar comandos para esta impresora
    foreach ($commands as $cmd) {
        if ($cmd['token'] === $token) {
            $pending[] = $cmd;
        } else {
            $remaining[] = $cmd;
        }
    }

    // Guardar comandos restantes (eliminar los que se devolvieron)
    saveJson(COMMANDS_FILE, $remaining);

    response(true, 'OK', ['commands' => $pending]);
}

// Actualizar datos de impresora
function updatePrinter($data) {
    $token = $data['token'] ?? '';
    $name = $data['name'] ?? 'Impresora Sin Nombre';
    $status = $data['status'] ?? 'idle';
    $progress = $data['progress'] ?? 0;
    $currentFile = $data['current_file'] ?? '';
    $tempHotend = $data['temp_hotend'] ?? 0;
    $tempBed = $data['temp_bed'] ?? 0;
    $image = $data['image'] ?? '';
    $timeRemaining = $data['time_remaining'] ?? null;
    $printSpeed = $data['print_speed'] ?? 100;
    $lastCompleted = $data['last_completed'] ?? null;
    $uptime = $data['uptime'] ?? null;
    $bedStatus = $data['bed_status'] ?? null;
    $filament = $data['filament'] ?? null;
    $tags = $data['tags'] ?? [];
    $files = $data['files'] ?? []; // NUEVO: Lista de archivos locales

    if (empty($token)) {
        response(false, 'Token requerido');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $found = false;
    $printerId = null;

    // Buscar si la impresora ya existe
    foreach ($printers as &$printer) {
        if ($printer['token'] === $token) {
            $printer['name'] = $name;
            $printer['status'] = $status;
            $printer['progress'] = $progress;
            $printer['current_file'] = $currentFile;
            $printer['temp_hotend'] = $tempHotend;
            $printer['temp_bed'] = $tempBed;

            // Solo actualizar imagen si se envió una nueva
            if (!empty($image)) {
                $printer['image'] = $image;
            }

            $printer['time_remaining'] = $timeRemaining;
            $printer['print_speed'] = $printSpeed;
            $printer['last_completed'] = $lastCompleted;
            $printer['uptime'] = $uptime;
            $printer['bed_status'] = $bedStatus;
            $printer['filament'] = $filament;
            $printer['files'] = $files; // NUEVO: Guardar lista de archivos locales
            $printer['last_seen'] = time();

            // Mantener tags si no se enviaron nuevos
            if (!empty($tags)) {
                $printer['tags'] = $tags;
            }

            $found = true;
            $printerId = $printer['id'];
            break;
        }
    }

    // Si no existe, crear nueva
    if (!$found) {
        $printerId = uniqid('printer_');
        $printers[] = [
            'id' => $printerId,
            'token' => $token,
            'name' => $name,
            'status' => $status,
            'progress' => $progress,
            'current_file' => $currentFile,
            'temp_hotend' => $tempHotend,
            'temp_bed' => $tempBed,
            'image' => $image,
            'time_remaining' => $timeRemaining,
            'print_speed' => $printSpeed,
            'last_completed' => $lastCompleted,
            'uptime' => $uptime,
            'bed_status' => $bedStatus,
            'filament' => $filament,
            'files' => $files, // NUEVO
            'last_seen' => time(),
            'tags' => $tags,
            'notes' => ''
        ];
    }

    saveJson(PRINTERS_FILE, $printers);
    response(true, 'Impresora actualizada', ['printer_id' => $printerId]);
}

// Enviar comando a impresora
function sendCommand($data) {
    $printerId = $data['printer_id'] ?? '';
    $action = $data['action'] ?? '';

    if (empty($printerId) || empty($action)) {
        response(false, 'Datos incompletos');
        return;
    }

    // Buscar token de la impresora
    $printers = loadJson(PRINTERS_FILE);
    $token = null;

    foreach ($printers as $printer) {
        if ($printer['id'] === $printerId) {
            $token = $printer['token'];
            break;
        }
    }

    if (!$token) {
        response(false, 'Impresora no encontrada');
        return;
    }

    // Agregar comando a la cola
    $commands = loadJson(COMMANDS_FILE);
    $commands[] = [
        'id' => uniqid('cmd_'),
        'token' => $token,
        'action' => $action,
        'timestamp' => time()
    ];

    saveJson(COMMANDS_FILE, $commands);
    response(true, 'Comando enviado');
}

// Establecer velocidad de impresión
function setSpeed($data) {
    $printerId = $data['printer_id'] ?? '';
    $speed = $data['speed'] ?? 100;

    if (empty($printerId)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $token = null;

    foreach ($printers as $printer) {
        if ($printer['id'] === $printerId) {
            $token = $printer['token'];
            break;
        }
    }

    if (!$token) {
        response(false, 'Impresora no encontrada');
        return;
    }

    $commands = loadJson(COMMANDS_FILE);
    $commands[] = [
        'id' => uniqid('cmd_'),
        'token' => $token,
        'action' => 'set_speed',
        'speed' => $speed,
        'timestamp' => time()
    ];

    saveJson(COMMANDS_FILE, $commands);
    response(true, 'Velocidad actualizada');
}

// Iniciar impresión desde servidor (descarga archivo)
function startPrint($data) {
    $printerId = $data['printer_id'] ?? '';
    $file = $data['file'] ?? '';

    if (empty($printerId) || empty($file)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $token = null;

    foreach ($printers as $printer) {
        if ($printer['id'] === $printerId) {
            $token = $printer['token'];
            break;
        }
    }

    if (!$token) {
        response(false, 'Impresora no encontrada');
        return;
    }

    // Agregar comando de impresión (descargará desde servidor)
    $commands = loadJson(COMMANDS_FILE);
    $commands[] = [
        'id' => uniqid('cmd_'),
        'token' => $token,
        'action' => 'print',
        'file' => $file,
        'timestamp' => time()
    ];

    saveJson(COMMANDS_FILE, $commands);
    response(true, 'Impresión iniciada (descargando archivo)');
}

// Iniciar impresión desde archivo local
function startPrintLocal($data) {
    $printerId = $data['printer_id'] ?? '';
    $file = $data['file'] ?? '';

    if (empty($printerId) || empty($file)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $token = null;

    foreach ($printers as $printer) {
        if ($printer['id'] === $printerId) {
            $token = $printer['token'];
            break;
        }
    }

    if (!$token) {
        response(false, 'Impresora no encontrada');
        return;
    }

    // Agregar comando de impresión local
    $commands = loadJson(COMMANDS_FILE);
    $commands[] = [
        'id' => uniqid('cmd_'),
        'token' => $token,
        'action' => 'print_local',
        'file' => $file,
        'timestamp' => time()
    ];

    saveJson(COMMANDS_FILE, $commands);
    response(true, 'Impresión iniciada (archivo local)');
}

// Guardar notas de impresora
function saveNotes($data) {
    $printerId = $data['printer_id'] ?? '';
    $notes = $data['notes'] ?? '';

    if (empty($printerId)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $found = false;

    foreach ($printers as &$printer) {
        if ($printer['id'] === $printerId) {
            $printer['notes'] = $notes;
            $found = true;
            break;
        }
    }

    if (!$found) {
        response(false, 'Impresora no encontrada');
        return;
    }

    saveJson(PRINTERS_FILE, $printers);
    response(true, 'Notas guardadas');
}

// Actualizar estado de la cama
function updateBedStatus($data) {
    $printerId = $data['printer_id'] ?? '';
    $bedStatus = $data['bed_status'] ?? '';

    if (empty($printerId) || empty($bedStatus)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $found = false;

    foreach ($printers as &$printer) {
        if ($printer['id'] === $printerId) {
            $printer['bed_status'] = $bedStatus;
            $found = true;
            break;
        }
    }

    if (!$found) {
        response(false, 'Impresora no encontrada');
        return;
    }

    saveJson(PRINTERS_FILE, $printers);
    response(true, 'Estado de cama actualizado');
}

// Agregar tag a impresora
function addTag($data) {
    $printerId = $data['printer_id'] ?? '';
    $tag = $data['tag'] ?? '';

    if (empty($printerId) || empty($tag)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $found = false;

    foreach ($printers as &$printer) {
        if ($printer['id'] === $printerId) {
            if (!isset($printer['tags'])) {
                $printer['tags'] = [];
            }
            if (!in_array($tag, $printer['tags'])) {
                $printer['tags'][] = $tag;
            }
            $found = true;
            break;
        }
    }

    if (!$found) {
        response(false, 'Impresora no encontrada');
        return;
    }

    saveJson(PRINTERS_FILE, $printers);
    response(true, 'Tag agregado');
}

// Remover tag de impresora
function removeTag($data) {
    $printerId = $data['printer_id'] ?? '';
    $tag = $data['tag'] ?? '';

    if (empty($printerId) || empty($tag)) {
        response(false, 'Datos incompletos');
        return;
    }

    $printers = loadJson(PRINTERS_FILE);
    $found = false;

    foreach ($printers as &$printer) {
        if ($printer['id'] === $printerId) {
            if (isset($printer['tags'])) {
                $printer['tags'] = array_values(array_filter($printer['tags'], function($t) use ($tag) {
                    return $t !== $tag;
                }));
            }
            $found = true;
            break;
        }
    }

    if (!$found) {
        response(false, 'Impresora no encontrada');
        return;
    }

    saveJson(PRINTERS_FILE, $printers);
    response(true, 'Tag removido');
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
