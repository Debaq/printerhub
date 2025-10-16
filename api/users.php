<?php
/**
 * PrinterHub - Users API
 * Gestión de usuarios - Solo administradores
 */

require_once __DIR__ . '/config.php';

$admin = requireAdmin();
$db = getDB();
$action = $_GET['action'] ?? getRequestData()['action'] ?? '';

switch ($action) {
    case 'list':
        listUsers();
        break;
    case 'get':
        getUser();
        break;
    case 'create':
        createUser();
        break;
    case 'update':
        updateUser();
        break;
    case 'delete':
        deleteUser();
        break;
    case 'block':
        blockUser();
        break;
    case 'unblock':
        unblockUser();
        break;
    case 'assign_printers':
        assignPrinters();
        break;
    case 'get_printers':
        getUserPrinters();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== LISTAR USUARIOS ====================

function listUsers() {
    global $admin, $db;
    
    $search = $_GET['search'] ?? '';
    $role = $_GET['role'] ?? '';
    $blocked = $_GET['blocked'] ?? '';
    
    $sql = 'SELECT id, username, email, role, can_print_private, is_blocked, created_at, last_login FROM users WHERE 1=1';
    $params = [];
    
    if (!empty($search)) {
        $sql .= ' AND (username LIKE ? OR email LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    
    if ($role !== '') {
        $sql .= ' AND role = ?';
        $params[] = $role;
    }
    
    if ($blocked !== '') {
        $sql .= ' AND is_blocked = ?';
        $params[] = (int)$blocked;
    }
    
    $sql .= ' ORDER BY created_at DESC';
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll();
    
    // Contar impresoras asignadas a cada usuario
    foreach ($users as &$user) {
        $stmt = $db->prepare('SELECT COUNT(*) as count FROM printer_assignments WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $user['printers_count'] = $stmt->fetch()['count'];
    }
    
    jsonResponse(true, 'OK', ['users' => $users]);
}

// ==================== OBTENER USUARIO ====================

function getUser() {
    global $admin, $db;
    
    $userId = $_GET['id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    $stmt = $db->prepare('
        SELECT id, username, email, role, can_print_private, is_blocked, created_at, last_login, last_ip
        FROM users WHERE id = ?
    ');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse(false, 'Usuario no encontrado', [], 404);
    }
    
    // Obtener impresoras asignadas
    $stmt = $db->prepare('
        SELECT p.id, p.name, p.token, pa.can_control, pa.can_view_details
        FROM printers p
        INNER JOIN printer_assignments pa ON p.id = pa.printer_id
        WHERE pa.user_id = ?
    ');
    $stmt->execute([$userId]);
    $user['printers'] = $stmt->fetchAll();
    
    // Obtener grupos
    $stmt = $db->prepare('
        SELECT g.id, g.name, g.description
        FROM groups g
        INNER JOIN user_groups ug ON g.id = ug.group_id
        WHERE ug.user_id = ?
    ');
    $stmt->execute([$userId]);
    $user['groups'] = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['user' => $user]);
}

// ==================== CREAR USUARIO ====================

function createUser() {
    global $admin, $db;
    
    $data = getRequestData();
    $username = trim($data['username'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $role = $data['role'] ?? 'user';
    $canPrintPrivate = (int)($data['can_print_private'] ?? 0);
    
    // Validaciones
    if (empty($username) || empty($email) || empty($password)) {
        jsonResponse(false, 'Username, email y contraseña requeridos', [], 400);
    }
    
    if (!isValidUsername($username)) {
        jsonResponse(false, 'Username inválido', [], 400);
    }
    
    if (!isValidEmail($email)) {
        jsonResponse(false, 'Email inválido', [], 400);
    }
    
    if (!in_array($role, ['admin', 'user'])) {
        jsonResponse(false, 'Rol inválido', [], 400);
    }
    
    // Verificar si ya existe
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $email]);
    
    if ($stmt->fetch()) {
        jsonResponse(false, 'Username o email ya existen', [], 409);
    }
    
    // Crear usuario
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]);
    
    $stmt = $db->prepare('
        INSERT INTO users (username, email, password_hash, role, can_print_private)
        VALUES (?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([$username, $email, $passwordHash, $role, $canPrintPrivate]);
    $userId = $db->lastInsertId();
    
    // Log
    logAction($admin['id'], 'user_created', 'user', $userId, "Usuario $username creado por admin");
    
    jsonResponse(true, 'Usuario creado exitosamente', [
        'user' => [
            'id' => $userId,
            'username' => $username,
            'email' => $email,
            'role' => $role
        ]
    ], 201);
}

// ==================== ACTUALIZAR USUARIO ====================

function updateUser() {
    global $admin, $db;
    
    $data = getRequestData();
    $userId = $data['id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    // Verificar que el usuario existe
    $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse(false, 'Usuario no encontrado', [], 404);
    }
    
    // No permitir que un admin se quite a sí mismo el rol admin
    if ($userId == $admin['id'] && isset($data['role']) && $data['role'] !== 'admin') {
        jsonResponse(false, 'No puedes cambiar tu propio rol de admin', [], 403);
    }
    
    // Campos actualizables
    $updates = [];
    $params = [];
    
    if (isset($data['email'])) {
        if (!isValidEmail($data['email'])) {
            jsonResponse(false, 'Email inválido', [], 400);
        }
        $updates[] = 'email = ?';
        $params[] = trim($data['email']);
    }
    
    if (isset($data['role']) && in_array($data['role'], ['admin', 'user'])) {
        $updates[] = 'role = ?';
        $params[] = $data['role'];
    }
    
    if (isset($data['can_print_private'])) {
        $updates[] = 'can_print_private = ?';
        $params[] = (int)$data['can_print_private'];
    }
    
    if (isset($data['password']) && !empty($data['password'])) {
        $updates[] = 'password_hash = ?';
        $params[] = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]);
    }
    
    if (empty($updates)) {
        jsonResponse(false, 'No hay campos para actualizar', [], 400);
    }
    
    $params[] = $userId;
    
    $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    // Log
    logAction($admin['id'], 'user_updated', 'user', $userId, "Usuario {$user['username']} actualizado");
    
    jsonResponse(true, 'Usuario actualizado exitosamente');
}

// ==================== ELIMINAR USUARIO ====================

function deleteUser() {
    global $admin, $db;
    
    $userId = $_GET['id'] ?? getRequestData()['id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    // No permitir eliminar el propio usuario
    if ($userId == $admin['id']) {
        jsonResponse(false, 'No puedes eliminar tu propia cuenta', [], 403);
    }
    
    $stmt = $db->prepare('SELECT username FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse(false, 'Usuario no encontrado', [], 404);
    }
    
    // Eliminar usuario (las FKs en cascada eliminan sesiones, asignaciones, etc)
    $stmt = $db->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    
    // Log
    logAction($admin['id'], 'user_deleted', 'user', $userId, "Usuario {$user['username']} eliminado");
    
    jsonResponse(true, 'Usuario eliminado exitosamente');
}

// ==================== BLOQUEAR USUARIO ====================

function blockUser() {
    global $admin, $db;
    
    $userId = getRequestData()['id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    if ($userId == $admin['id']) {
        jsonResponse(false, 'No puedes bloquearte a ti mismo', [], 403);
    }
    
    $stmt = $db->prepare('UPDATE users SET is_blocked = 1 WHERE id = ?');
    $stmt->execute([$userId]);
    
    // Invalidar todas las sesiones del usuario
    $stmt = $db->prepare('DELETE FROM sessions WHERE user_id = ?');
    $stmt->execute([$userId]);
    
    // Log
    logAction($admin['id'], 'user_blocked', 'user', $userId, "Usuario bloqueado");
    
    jsonResponse(true, 'Usuario bloqueado exitosamente');
}

// ==================== DESBLOQUEAR USUARIO ====================

function unblockUser() {
    global $admin, $db;
    
    $userId = getRequestData()['id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    $stmt = $db->prepare('UPDATE users SET is_blocked = 0 WHERE id = ?');
    $stmt->execute([$userId]);
    
    // Log
    logAction($admin['id'], 'user_unblocked', 'user', $userId, "Usuario desbloqueado");
    
    jsonResponse(true, 'Usuario desbloqueado exitosamente');
}

// ==================== ASIGNAR IMPRESORAS ====================

function assignPrinters() {
    global $admin, $db;
    
    $data = getRequestData();
    $userId = $data['user_id'] ?? 0;
    $printers = $data['printers'] ?? []; // Array de {printer_id, can_control, can_view_details}
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    // Verificar usuario
    $stmt = $db->prepare('SELECT username FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse(false, 'Usuario no encontrado', [], 404);
    }
    
    // Eliminar asignaciones actuales
    $stmt = $db->prepare('DELETE FROM printer_assignments WHERE user_id = ?');
    $stmt->execute([$userId]);
    
    // Agregar nuevas asignaciones
    $stmt = $db->prepare('
        INSERT INTO printer_assignments (user_id, printer_id, can_control, can_view_details)
        VALUES (?, ?, ?, ?)
    ');
    
    foreach ($printers as $printer) {
        $printerId = $printer['printer_id'] ?? 0;
        $canControl = (int)($printer['can_control'] ?? 1);
        $canViewDetails = (int)($printer['can_view_details'] ?? 1);
        
        if ($printerId) {
            $stmt->execute([$userId, $printerId, $canControl, $canViewDetails]);
        }
    }
    
    // Log
    logAction($admin['id'], 'printers_assigned', 'user', $userId, "Impresoras asignadas a {$user['username']}");
    
    jsonResponse(true, 'Impresoras asignadas exitosamente');
}

// ==================== OBTENER IMPRESORAS DE USUARIO ====================

function getUserPrinters() {
    global $admin, $db;
    
    $userId = $_GET['user_id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    $stmt = $db->prepare('
        SELECT p.id, p.name, p.token, p.status, pa.can_control, pa.can_view_details
        FROM printers p
        INNER JOIN printer_assignments pa ON p.id = pa.printer_id
        WHERE pa.user_id = ?
        ORDER BY p.name
    ');
    $stmt->execute([$userId]);
    $printers = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['printers' => $printers]);
}
