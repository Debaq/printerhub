<?php
/**
 * PrinterHub - Auth API
 * Autenticación: login, registro, logout, validación de sesiones
 */

require_once __DIR__ . '/config.php';

$db = getDB();
$action = $_GET['action'] ?? getRequestData()['action'] ?? '';

switch ($action) {
    case 'register':
        registerUser();
        break;
    case 'login':
        loginUser();
        break;
    case 'logout':
        logoutUser();
        break;
    case 'check_session':
        checkSession();
        break;
    case 'change_password':
        changePassword();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== REGISTRO ====================

function registerUser() {
    $data = getRequestData();
    $username = trim($data['username'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    // Validaciones
    if (empty($username) || empty($email) || empty($password)) {
        jsonResponse(false, 'Todos los campos son requeridos', [], 400);
    }
    
    if (!isValidUsername($username)) {
        jsonResponse(false, 'Username inválido (3-30 caracteres alfanuméricos)', [], 400);
    }
    
    if (!isValidEmail($email)) {
        jsonResponse(false, 'Email inválido', [], 400);
    }
    
    if (strlen($password) < 6) {
        jsonResponse(false, 'La contraseña debe tener al menos 6 caracteres', [], 400);
    }
    
    $db = getDB();
    
    // Verificar si username o email ya existen
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $email]);
    
    if ($stmt->fetch()) {
        jsonResponse(false, 'Username o email ya están en uso', [], 409);
    }
    
    // Hash de contraseña
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]);
    
    // Crear usuario
    $stmt = $db->prepare('
        INSERT INTO users (username, email, password_hash, role, can_print_private)
        VALUES (?, ?, ?, "user", 0)
    ');
    
    try {
        $stmt->execute([$username, $email, $passwordHash]);
        $userId = $db->lastInsertId();
        
        // Log
        logAction($userId, 'user_registered', 'user', $userId, "Usuario $username registrado");
        
        jsonResponse(true, 'Usuario registrado exitosamente', [
            'user' => [
                'id' => $userId,
                'username' => $username,
                'email' => $email
            ]
        ], 201);
        
    } catch (PDOException $e) {
        error_log("Error registrando usuario: " . $e->getMessage());
        jsonResponse(false, 'Error al registrar usuario', [], 500);
    }
}

// ==================== LOGIN ====================

function loginUser() {
    $data = getRequestData();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $rememberMe = ($data['remember_me'] ?? false) === true;
    
    if (empty($username) || empty($password)) {
        jsonResponse(false, 'Username y contraseña requeridos', [], 400);
    }
    
    $db = getDB();
    
    // Buscar usuario por username o email
    $stmt = $db->prepare('
        SELECT * FROM users 
        WHERE (username = ? OR email = ?) AND is_blocked = 0
    ');
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();
    
    if (!$user) {
        logAction(null, 'login_failed', null, null, "Intento de login fallido: $username");
        jsonResponse(false, 'Credenciales inválidas', [], 401);
    }
    
    // Verificar contraseña
    if (!password_verify($password, $user['password_hash'])) {
        logAction($user['id'], 'login_failed', 'user', $user['id'], "Contraseña incorrecta");
        jsonResponse(false, 'Credenciales inválidas', [], 401);
    }
    
    // Crear sesión
    $token = generateSecureToken(SESSION_TOKEN_LENGTH);
    $expiresAt = time() + ($rememberMe ? SESSION_DURATION * 7 : SESSION_DURATION); // 7 días si remember me
    
    $stmt = $db->prepare('
        INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([
        $user['id'],
        $token,
        $expiresAt,
        $_SERVER['REMOTE_ADDR'] ?? null,
        $_SERVER['HTTP_USER_AGENT'] ?? null
    ]);
    
    // Actualizar last_login
    $stmt = $db->prepare('UPDATE users SET last_login = ?, last_ip = ? WHERE id = ?');
    $stmt->execute([time(), $_SERVER['REMOTE_ADDR'] ?? null, $user['id']]);
    
    // Log
    logAction($user['id'], 'login', 'user', $user['id'], "Login exitoso");
    
    // Limpiar datos sensibles
    unset($user['password_hash']);
    
    jsonResponse(true, 'Login exitoso', [
        'session' => [
            'token' => $token,
            'expires_at' => $expiresAt
        ],
        'user' => $user
    ]);
}

// ==================== LOGOUT ====================

function logoutUser() {
    $user = requireAuth();
    $token = getSessionToken();
    
    $db = getDB();
    
    // Eliminar sesión
    $stmt = $db->prepare('DELETE FROM sessions WHERE token = ?');
    $stmt->execute([$token]);
    
    // Log
    logAction($user['id'], 'logout', 'user', $user['id'], "Logout");
    
    jsonResponse(true, 'Logout exitoso');
}

// ==================== CHECK SESSION ====================

function checkSession() {
    $user = getCurrentUser();
    
    if (!$user) {
        jsonResponse(false, 'Sesión inválida o expirada', [], 401);
    }
    
    // Limpiar datos sensibles
    unset($user['password_hash']);
    unset($user['token']);
    unset($user['expires_at']);
    
    jsonResponse(true, 'Sesión válida', [
        'user' => $user
    ]);
}

// ==================== CAMBIAR CONTRASEÑA ====================

function changePassword() {
    $user = requireAuth();
    $data = getRequestData();
    
    $currentPassword = $data['current_password'] ?? '';
    $newPassword = $data['new_password'] ?? '';
    
    if (empty($currentPassword) || empty($newPassword)) {
        jsonResponse(false, 'Contraseña actual y nueva requeridas', [], 400);
    }
    
    if (strlen($newPassword) < 6) {
        jsonResponse(false, 'La nueva contraseña debe tener al menos 6 caracteres', [], 400);
    }
    
    $db = getDB();
    
    // Verificar contraseña actual
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $userData = $stmt->fetch();
    
    if (!password_verify($currentPassword, $userData['password_hash'])) {
        jsonResponse(false, 'Contraseña actual incorrecta', [], 401);
    }
    
    // Actualizar contraseña
    $newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]);
    
    $stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute([$newPasswordHash, $user['id']]);
    
    // Invalidar todas las sesiones excepto la actual
    $currentToken = getSessionToken();
    $stmt = $db->prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?');
    $stmt->execute([$user['id'], $currentToken]);
    
    // Log
    logAction($user['id'], 'password_changed', 'user', $user['id'], 'Contraseña cambiada');
    
    jsonResponse(true, 'Contraseña actualizada exitosamente');
}
