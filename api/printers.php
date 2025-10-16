<?php
/**
 * PrinterHub - Printers API
 * Visualización y control de impresoras
 */

require_once __DIR__ . '/config.php';

$db = getDB();
$action = $_GET['action'] ?? getRequestData()['action'] ?? '';

switch ($action) {
    case 'list':
        listPrinters();
        break;
    case 'get':
        getPrinter();
        break;
    case 'create':
        createPrinter();
        break;
    case 'update':
        updatePrinter();
        break;
    case 'delete':
        deletePrinter();
        break;
    case 'block':
        blockPrinter();
        break;
    case 'unblock':
        unblockPrinter();
        break;
    case 'update_notes':
        updateNotes();
        break;
    case 'update_tags':
        updateTags();
        break;
    case 'set_privacy':
        setPrinterPrivacy();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== LISTAR IMPRESORAS ====================

function listPrinters() {
    global $db;
    
    $user = getCurrentUser();
    $status = $_GET['status'] ?? '';
    $search = $_GET['search'] ?? '';
    
    // Query base
    $sql = '
        SELECT 
            p.*,
            ps.status as current_status,
            ps.progress,
            ps.current_file,
            ps.temp_hotend,
            ps.temp_bed,
            ps.temp_hotend_target,
            ps.temp_bed_target,
            ps.print_speed,
            ps.fan_speed,
            ps.time_remaining,
            ps.image,
            ps.uptime,
            ps.bed_status,
            ps.filament,
            ps.tags,
            ps.updated_at as state_updated_at
        FROM printers p
        LEFT JOIN printer_states ps ON p.id = ps.printer_id
        WHERE 1=1
    ';
    $params = [];
    
    // Usuario público: solo impresoras públicas
    if (!$user) {
        $sql .= ' AND p.is_public = 1 AND p.is_blocked = 0';
    }
    // Usuario registrado: sus impresoras asignadas
    elseif ($user['role'] !== 'admin') {
        $sql .= ' AND p.id IN (
            SELECT printer_id FROM printer_assignments WHERE user_id = ?
        ) AND p.is_blocked = 0';
        $params[] = $user['id'];
    }
    // Admin: todas las impresoras
    
    // Filtros adicionales
    if (!empty($status)) {
        $sql .= ' AND ps.status = ?';
        $params[] = $status;
    }
    
    if (!empty($search)) {
        $sql .= ' AND (p.name LIKE ? OR p.token LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    
    $sql .= ' ORDER BY p.name';
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $printers = $stmt->fetchAll();
    
    // Procesar datos según permisos
    foreach ($printers as &$printer) {
        processPrinterData($printer, $user);
    }
    
    jsonResponse(true, 'OK', ['printers' => $printers]);
}

// ==================== OBTENER IMPRESORA ====================

function getPrinter() {
    global $db;
    
    $printerId = $_GET['id'] ?? 0;
    $user = getCurrentUser();
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    // Query básica
    $stmt = $db->prepare('
        SELECT 
            p.*,
            ps.*,
            p.id as printer_id
        FROM printers p
        LEFT JOIN printer_states ps ON p.id = ps.printer_id
        WHERE p.id = ?
    ');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Impresora no encontrada', [], 404);
    }
    
    // Verificar permisos
    if (!$user) {
        // Usuario público: solo impresoras públicas
        if (!$printer['is_public'] || $printer['is_blocked']) {
            jsonResponse(false, 'Acceso denegado', [], 403);
        }
    } elseif ($user['role'] !== 'admin') {
        // Usuario registrado: verificar asignación
        if (!canAccessPrinter($user['id'], $printerId)) {
            jsonResponse(false, 'Acceso denegado', [], 403);
        }
    }
    
    // Procesar datos según permisos
    processPrinterData($printer, $user);
    
    // Obtener trabajo actual si existe
    $stmt = $db->prepare('
        SELECT * FROM jobs 
        WHERE printer_id = ? AND status = "in_progress"
        ORDER BY started_at DESC LIMIT 1
    ');
    $stmt->execute([$printerId]);
    $currentJob = $stmt->fetch();
    
    if ($currentJob) {
        // Verificar si es privado
        if ($currentJob['is_private']) {
            // Solo el dueño o admin ve detalles
            if ($user && ($user['role'] === 'admin' || $currentJob['user_id'] == $user['id'])) {
                $printer['current_job'] = $currentJob;
            } else {
                $printer['current_job'] = [
                    'is_private' => true,
                    'status' => $currentJob['status']
                ];
            }
        } else {
            $printer['current_job'] = $currentJob;
        }
    }
    
    // Log de acceso (solo si es usuario registrado)
    if ($user) {
        logAction($user['id'], 'view_printer', 'printer', $printerId, "Visualizó impresora {$printer['name']}");
    }
    
    jsonResponse(true, 'OK', ['printer' => $printer]);
}

// ==================== CREAR IMPRESORA (Admin) ====================

function createPrinter() {
    $admin = requireAdmin();
    global $db;
    
    $data = getRequestData();
    $token = trim($data['token'] ?? '');
    $name = trim($data['name'] ?? '');
    $isPublic = (int)($data['is_public'] ?? 1);
    
    if (empty($token) || empty($name)) {
        jsonResponse(false, 'Token y nombre requeridos', [], 400);
    }
    
    // Verificar si token ya existe
    $stmt = $db->prepare('SELECT id FROM printers WHERE token = ?');
    $stmt->execute([$token]);
    
    if ($stmt->fetch()) {
        jsonResponse(false, 'Token ya existe', [], 409);
    }
    
    // Crear impresora
    $stmt = $db->prepare('
        INSERT INTO printers (token, name, is_public)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$token, $name, $isPublic]);
    $printerId = $db->lastInsertId();
    
    // Log
    logAction($admin['id'], 'printer_created', 'printer', $printerId, "Impresora $name creada");
    
    jsonResponse(true, 'Impresora creada exitosamente', [
        'printer' => [
            'id' => $printerId,
            'token' => $token,
            'name' => $name
        ]
    ], 201);
}

// ==================== ACTUALIZAR IMPRESORA (Admin) ====================

function updatePrinter() {
    $admin = requireAdmin();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT name FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Impresora no encontrada', [], 404);
    }
    
    // Campos actualizables
    $updates = [];
    $params = [];
    
    if (isset($data['name'])) {
        $updates[] = 'name = ?';
        $params[] = trim($data['name']);
    }
    
    if (isset($data['is_public'])) {
        $updates[] = 'is_public = ?';
        $params[] = (int)$data['is_public'];
    }
    
    if (empty($updates)) {
        jsonResponse(false, 'No hay campos para actualizar', [], 400);
    }
    
    $params[] = $printerId;
    
    $sql = 'UPDATE printers SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    // Log
    logAction($admin['id'], 'printer_updated', 'printer', $printerId, "Impresora {$printer['name']} actualizada");
    
    jsonResponse(true, 'Impresora actualizada exitosamente');
}

// ==================== ELIMINAR IMPRESORA (Admin) ====================

function deletePrinter() {
    $admin = requireAdmin();
    global $db;
    
    $printerId = $_GET['id'] ?? getRequestData()['id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT name FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    $printer = $stmt->fetch();
    
    if (!$printer) {
        jsonResponse(false, 'Impresora no encontrada', [], 404);
    }
    
    // Eliminar impresora (cascada elimina estados, comandos, etc)
    $stmt = $db->prepare('DELETE FROM printers WHERE id = ?');
    $stmt->execute([$printerId]);
    
    // Log
    logAction($admin['id'], 'printer_deleted', 'printer', $printerId, "Impresora {$printer['name']} eliminada");
    
    jsonResponse(true, 'Impresora eliminada exitosamente');
}

// ==================== BLOQUEAR/DESBLOQUEAR IMPRESORA ====================

function blockPrinter() {
    $admin = requireAdmin();
    global $db;
    
    $printerId = getRequestData()['id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    $stmt = $db->prepare('UPDATE printers SET is_blocked = 1 WHERE id = ?');
    $stmt->execute([$printerId]);
    
    logAction($admin['id'], 'printer_blocked', 'printer', $printerId, "Impresora bloqueada");
    
    jsonResponse(true, 'Impresora bloqueada exitosamente');
}

function unblockPrinter() {
    $admin = requireAdmin();
    global $db;
    
    $printerId = getRequestData()['id'] ?? 0;
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    $stmt = $db->prepare('UPDATE printers SET is_blocked = 0 WHERE id = ?');
    $stmt->execute([$printerId]);
    
    logAction($admin['id'], 'printer_unblocked', 'printer', $printerId, "Impresora desbloqueada");
    
    jsonResponse(true, 'Impresora desbloqueada exitosamente');
}

// ==================== ACTUALIZAR NOTAS ====================

function updateNotes() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $notes = $data['notes'] ?? '';
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    // Verificar acceso (admin o usuario asignado)
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    // Actualizar en tabla printer_states
    $stmt = $db->prepare('
        UPDATE printer_states 
        SET raw_data = json_set(COALESCE(raw_data, "{}"), "$.notes", ?)
        WHERE printer_id = ?
    ');
    $stmt->execute([$notes, $printerId]);
    
    logAction($user['id'], 'notes_updated', 'printer', $printerId, "Notas actualizadas");
    
    jsonResponse(true, 'Notas actualizadas exitosamente');
}

// ==================== ACTUALIZAR TAGS ====================

function updateTags() {
    $user = requireAuth();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $tags = $data['tags'] ?? [];
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    $stmt = $db->prepare('UPDATE printer_states SET tags = ? WHERE printer_id = ?');
    $stmt->execute([json_encode($tags), $printerId]);
    
    logAction($user['id'], 'tags_updated', 'printer', $printerId, "Tags actualizados");
    
    jsonResponse(true, 'Tags actualizados exitosamente');
}

// ==================== ESTABLECER PRIVACIDAD (Admin) ====================

function setPrinterPrivacy() {
    $admin = requireAdmin();
    global $db;
    
    $data = getRequestData();
    $printerId = $data['printer_id'] ?? 0;
    $isPublic = (int)($data['is_public'] ?? 1);
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    $stmt = $db->prepare('UPDATE printers SET is_public = ? WHERE id = ?');
    $stmt->execute([$isPublic, $printerId]);
    
    $visibility = $isPublic ? 'pública' : 'privada';
    logAction($admin['id'], 'printer_privacy_changed', 'printer', $printerId, "Impresora configurada como $visibility");
    
    jsonResponse(true, 'Privacidad actualizada exitosamente');
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Procesar datos de impresora según permisos del usuario
 */
function processPrinterData(&$printer, $user) {
    // Determinar offline
    $currentTime = time();
    $lastSeen = $printer['last_seen'] ?? 0;
    
    if ($currentTime - $lastSeen > PRINTER_OFFLINE_TIMEOUT) {
        $printer['current_status'] = 'offline';
    }
    
    // Parsear JSON
    if (isset($printer['filament'])) {
        $printer['filament'] = json_decode($printer['filament'], true);
    }
    if (isset($printer['tags'])) {
        $printer['tags'] = json_decode($printer['tags'], true);
    }
    
    // Usuario público o sin permisos de ver detalles
    $canViewDetails = true;
    
    if (!$user) {
        // Usuario público: solo datos básicos
        $canViewDetails = false;
    } elseif ($user['role'] !== 'admin') {
        // Verificar permisos específicos
        global $db;
        $stmt = $db->prepare('
            SELECT can_view_details FROM printer_assignments 
            WHERE user_id = ? AND printer_id = ?
        ');
        $stmt->execute([$user['id'], $printer['id']]);
        $assignment = $stmt->fetch();
        
        if ($assignment) {
            $canViewDetails = (bool)$assignment['can_view_details'];
        }
    }
    
    // Si no puede ver detalles, ocultar información sensible
    if (!$canViewDetails) {
        unset($printer['token']);
        // Si hay impresión privada, ocultar detalles
        if (isset($printer['current_file'])) {
            $printer['current_file'] = '[Privado]';
        }
        if (isset($printer['image'])) {
            $printer['image'] = null;
        }
    }
}
