<?php
/**
 * PrinterHub - Groups API
 * Gestión de grupos con permisos personalizados
 */

require_once __DIR__ . '/config.php';

$admin = requireAdmin();
$db = getDB();
$action = $_GET['action'] ?? getRequestData()['action'] ?? '';

switch ($action) {
    case 'list':
        listGroups();
        break;
    case 'get':
        getGroup();
        break;
    case 'create':
        createGroup();
        break;
    case 'update':
        updateGroup();
        break;
    case 'delete':
        deleteGroup();
        break;
    case 'add_users':
        addUsersToGroup();
        break;
    case 'remove_user':
        removeUserFromGroup();
        break;
    case 'get_members':
        getGroupMembers();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== LISTAR GRUPOS ====================

function listGroups() {
    global $admin, $db;
    
    $stmt = $db->query('
        SELECT 
            g.*,
            COUNT(ug.user_id) as members_count
        FROM groups g
        LEFT JOIN user_groups ug ON g.id = ug.group_id
        GROUP BY g.id
        ORDER BY g.name
    ');
    $groups = $stmt->fetchAll();
    
    // Parsear permisos JSON
    foreach ($groups as &$group) {
        $group['permissions'] = json_decode($group['permissions'], true);
    }
    
    jsonResponse(true, 'OK', ['groups' => $groups]);
}

// ==================== OBTENER GRUPO ====================

function getGroup() {
    global $admin, $db;
    
    $groupId = $_GET['id'] ?? 0;
    
    if (!$groupId) {
        jsonResponse(false, 'ID de grupo requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT * FROM groups WHERE id = ?');
    $stmt->execute([$groupId]);
    $group = $stmt->fetch();
    
    if (!$group) {
        jsonResponse(false, 'Grupo no encontrado', [], 404);
    }
    
    $group['permissions'] = json_decode($group['permissions'], true);
    
    // Obtener miembros
    $stmt = $db->prepare('
        SELECT u.id, u.username, u.email, ug.assigned_at
        FROM users u
        INNER JOIN user_groups ug ON u.id = ug.user_id
        WHERE ug.group_id = ?
        ORDER BY u.username
    ');
    $stmt->execute([$groupId]);
    $group['members'] = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['group' => $group]);
}

// ==================== CREAR GRUPO ====================

function createGroup() {
    global $admin, $db;
    
    $data = getRequestData();
    $name = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');
    $permissions = $data['permissions'] ?? [];
    
    if (empty($name)) {
        jsonResponse(false, 'Nombre de grupo requerido', [], 400);
    }
    
    // Validar permisos
    $validPermissions = validatePermissions($permissions);
    
    // Verificar si el nombre ya existe
    $stmt = $db->prepare('SELECT id FROM groups WHERE name = ?');
    $stmt->execute([$name]);
    
    if ($stmt->fetch()) {
        jsonResponse(false, 'Ya existe un grupo con ese nombre', [], 409);
    }
    
    // Crear grupo
    $stmt = $db->prepare('
        INSERT INTO groups (name, description, permissions)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$name, $description, json_encode($validPermissions)]);
    $groupId = $db->lastInsertId();
    
    // Log
    logAction($admin['id'], 'group_created', 'group', $groupId, "Grupo creado: $name");
    
    jsonResponse(true, 'Grupo creado exitosamente', [
        'group' => [
            'id' => $groupId,
            'name' => $name,
            'permissions' => $validPermissions
        ]
    ], 201);
}

// ==================== ACTUALIZAR GRUPO ====================

function updateGroup() {
    global $admin, $db;
    
    $data = getRequestData();
    $groupId = $data['id'] ?? 0;
    
    if (!$groupId) {
        jsonResponse(false, 'ID de grupo requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT name FROM groups WHERE id = ?');
    $stmt->execute([$groupId]);
    $group = $stmt->fetch();
    
    if (!$group) {
        jsonResponse(false, 'Grupo no encontrado', [], 404);
    }
    
    // Campos actualizables
    $updates = [];
    $params = [];
    
    if (isset($data['name']) && !empty($data['name'])) {
        $updates[] = 'name = ?';
        $params[] = trim($data['name']);
    }
    
    if (isset($data['description'])) {
        $updates[] = 'description = ?';
        $params[] = trim($data['description']);
    }
    
    if (isset($data['permissions'])) {
        $validPermissions = validatePermissions($data['permissions']);
        $updates[] = 'permissions = ?';
        $params[] = json_encode($validPermissions);
    }
    
    if (empty($updates)) {
        jsonResponse(false, 'No hay campos para actualizar', [], 400);
    }
    
    $params[] = $groupId;
    
    $sql = 'UPDATE groups SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    // Log
    logAction($admin['id'], 'group_updated', 'group', $groupId, "Grupo actualizado: {$group['name']}");
    
    jsonResponse(true, 'Grupo actualizado exitosamente');
}

// ==================== ELIMINAR GRUPO ====================

function deleteGroup() {
    global $admin, $db;
    
    $groupId = $_GET['id'] ?? getRequestData()['id'] ?? 0;
    
    if (!$groupId) {
        jsonResponse(false, 'ID de grupo requerido', [], 400);
    }
    
    $stmt = $db->prepare('SELECT name FROM groups WHERE id = ?');
    $stmt->execute([$groupId]);
    $group = $stmt->fetch();
    
    if (!$group) {
        jsonResponse(false, 'Grupo no encontrado', [], 404);
    }
    
    // Eliminar grupo (cascada elimina relaciones user_groups)
    $stmt = $db->prepare('DELETE FROM groups WHERE id = ?');
    $stmt->execute([$groupId]);
    
    // Log
    logAction($admin['id'], 'group_deleted', 'group', $groupId, "Grupo eliminado: {$group['name']}");
    
    jsonResponse(true, 'Grupo eliminado exitosamente');
}

// ==================== AGREGAR USUARIOS AL GRUPO ====================

function addUsersToGroup() {
    global $admin, $db;
    
    $data = getRequestData();
    $groupId = $data['group_id'] ?? 0;
    $userIds = $data['user_ids'] ?? [];
    
    if (!$groupId || empty($userIds)) {
        jsonResponse(false, 'Group ID y lista de usuarios requeridos', [], 400);
    }
    
    // Verificar grupo
    $stmt = $db->prepare('SELECT name FROM groups WHERE id = ?');
    $stmt->execute([$groupId]);
    $group = $stmt->fetch();
    
    if (!$group) {
        jsonResponse(false, 'Grupo no encontrado', [], 404);
    }
    
    // Agregar usuarios
    $stmt = $db->prepare('
        INSERT OR IGNORE INTO user_groups (user_id, group_id)
        VALUES (?, ?)
    ');
    
    $added = 0;
    foreach ($userIds as $userId) {
        $stmt->execute([$userId, $groupId]);
        if ($stmt->rowCount() > 0) {
            $added++;
        }
    }
    
    // Log
    logAction($admin['id'], 'users_added_to_group', 'group', $groupId, "$added usuarios agregados al grupo {$group['name']}");
    
    jsonResponse(true, "$added usuario(s) agregado(s) al grupo");
}

// ==================== REMOVER USUARIO DEL GRUPO ====================

function removeUserFromGroup() {
    global $admin, $db;
    
    $data = getRequestData();
    $groupId = $data['group_id'] ?? 0;
    $userId = $data['user_id'] ?? 0;
    
    if (!$groupId || !$userId) {
        jsonResponse(false, 'Group ID y User ID requeridos', [], 400);
    }
    
    $stmt = $db->prepare('DELETE FROM user_groups WHERE user_id = ? AND group_id = ?');
    $stmt->execute([$userId, $groupId]);
    
    if ($stmt->rowCount() === 0) {
        jsonResponse(false, 'Usuario no está en el grupo', [], 404);
    }
    
    // Log
    logAction($admin['id'], 'user_removed_from_group', 'group', $groupId, "Usuario removido del grupo");
    
    jsonResponse(true, 'Usuario removido del grupo exitosamente');
}

// ==================== OBTENER MIEMBROS DEL GRUPO ====================

function getGroupMembers() {
    global $admin, $db;
    
    $groupId = $_GET['group_id'] ?? 0;
    
    if (!$groupId) {
        jsonResponse(false, 'Group ID requerido', [], 400);
    }
    
    $stmt = $db->prepare('
        SELECT 
            u.id,
            u.username,
            u.email,
            u.role,
            ug.assigned_at
        FROM users u
        INNER JOIN user_groups ug ON u.id = ug.user_id
        WHERE ug.group_id = ?
        ORDER BY u.username
    ');
    $stmt->execute([$groupId]);
    $members = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['members' => $members]);
}

// ==================== VALIDAR PERMISOS ====================

function validatePermissions($permissions) {
    // Permisos disponibles
    $availablePermissions = [
        'can_view_printers' => false,
        'can_control_printers' => false,
        'can_upload_files' => false,
        'can_print_private' => false,
        'can_delete_files' => false,
        'can_view_all_jobs' => false,
        'can_manage_printers' => false
    ];
    
    // Validar y aplicar permisos
    $validPermissions = [];
    foreach ($availablePermissions as $permission => $default) {
        $validPermissions[$permission] = isset($permissions[$permission]) ? (bool)$permissions[$permission] : $default;
    }
    
    return $validPermissions;
}
