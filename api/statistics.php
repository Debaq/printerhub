<?php
/**
 * PrinterHub - Statistics API
 * Estadísticas y reportes del sistema
 */

require_once __DIR__ . '/config.php';

$db = getDB();
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'overview':
        getOverview();
        break;
    case 'printer_stats':
        getPrinterStats();
        break;
    case 'user_stats':
        getUserStats();
        break;
    case 'usage_report':
        getUsageReport();
        break;
    case 'jobs_history':
        getJobsHistory();
        break;
    case 'filament_usage':
        getFilamentUsage();
        break;
    case 'top_users':
        getTopUsers();
        break;
    default:
        jsonResponse(false, 'Acción no válida', [], 400);
}

// ==================== RESUMEN GENERAL ====================

function getOverview() {
    global $db;
    $user = getCurrentUser();
    
    // Usuario público: datos limitados
    if (!$user) {
        getPublicOverview();
        return;
    }
    
    $stats = [];
    
    // Total impresoras
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT COUNT(*) as count FROM printers WHERE is_blocked = 0');
    } else {
        $stmt = $db->prepare('
            SELECT COUNT(DISTINCT printer_id) as count 
            FROM printer_assignments 
            WHERE user_id = ?
        ');
        $stmt->execute([$user['id']]);
    }
    $stats['total_printers'] = $stmt->fetch()['count'];
    
    // Impresoras activas (imprimiendo)
    if ($user['role'] === 'admin') {
        $stmt = $db->query('
            SELECT COUNT(*) as count 
            FROM printer_states 
            WHERE status = "printing"
        ');
    } else {
        $stmt = $db->prepare('
            SELECT COUNT(*) as count
            FROM printer_states ps
            INNER JOIN printer_assignments pa ON ps.printer_id = pa.printer_id
            WHERE ps.status = "printing" AND pa.user_id = ?
        ');
        $stmt->execute([$user['id']]);
    }
    $stats['active_printers'] = $stmt->fetch()['count'];
    
    // Total de trabajos
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT COUNT(*) as count FROM jobs');
    } else {
        $stmt = $db->prepare('SELECT COUNT(*) as count FROM jobs WHERE user_id = ?');
        $stmt->execute([$user['id']]);
    }
    $stats['total_jobs'] = $stmt->fetch()['count'];
    
    // Trabajos completados
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT COUNT(*) as count FROM jobs WHERE status = "completed"');
    } else {
        $stmt = $db->prepare('
            SELECT COUNT(*) as count FROM jobs 
            WHERE status = "completed" AND user_id = ?
        ');
        $stmt->execute([$user['id']]);
    }
    $stats['completed_jobs'] = $stmt->fetch()['count'];
    
    // Trabajos fallidos
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT COUNT(*) as count FROM jobs WHERE status = "failed"');
    } else {
        $stmt = $db->prepare('
            SELECT COUNT(*) as count FROM jobs 
            WHERE status = "failed" AND user_id = ?
        ');
        $stmt->execute([$user['id']]);
    }
    $stats['failed_jobs'] = $stmt->fetch()['count'];
    
    // Tiempo total de impresión (horas)
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT SUM(duration) as total FROM jobs WHERE status = "completed"');
    } else {
        $stmt = $db->prepare('
            SELECT SUM(duration) as total FROM jobs 
            WHERE status = "completed" AND user_id = ?
        ');
        $stmt->execute([$user['id']]);
    }
    $totalSeconds = $stmt->fetch()['total'] ?? 0;
    $stats['total_print_time_hours'] = round($totalSeconds / 3600, 2);
    
    // Filamento usado total (kg)
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT SUM(filament_used) as total FROM jobs WHERE status = "completed"');
    } else {
        $stmt = $db->prepare('
            SELECT SUM(filament_used) as total FROM jobs 
            WHERE status = "completed" AND user_id = ?
        ');
        $stmt->execute([$user['id']]);
    }
    $totalGrams = $stmt->fetch()['total'] ?? 0;
    $stats['total_filament_kg'] = round($totalGrams / 1000, 2);
    
    // Total archivos subidos
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT COUNT(*) as count FROM files');
    } else {
        $stmt = $db->prepare('SELECT COUNT(*) as count FROM files WHERE uploaded_by_user_id = ?');
        $stmt->execute([$user['id']]);
    }
    $stats['total_files'] = $stmt->fetch()['count'];
    
    // Usuarios (solo admin)
    if ($user['role'] === 'admin') {
        $stmt = $db->query('SELECT COUNT(*) as count FROM users WHERE is_blocked = 0');
        $stats['total_users'] = $stmt->fetch()['count'];
    }
    
    jsonResponse(true, 'OK', ['stats' => $stats]);
}

// ==================== RESUMEN PÚBLICO ====================

function getPublicOverview() {
    global $db;
    
    $stats = [];
    
    // Solo impresoras públicas
    $stmt = $db->query('SELECT COUNT(*) as count FROM printers WHERE is_public = 1 AND is_blocked = 0');
    $stats['total_printers'] = $stmt->fetch()['count'];
    
    // Impresoras activas públicas
    $stmt = $db->query('
        SELECT COUNT(*) as count 
        FROM printer_states ps
        INNER JOIN printers p ON ps.printer_id = p.id
        WHERE ps.status = "printing" AND p.is_public = 1 AND p.is_blocked = 0
    ');
    $stats['active_printers'] = $stmt->fetch()['count'];
    
    // Trabajos públicos completados
    $stmt = $db->query('SELECT COUNT(*) as count FROM jobs WHERE is_private = 0 AND status = "completed"');
    $stats['completed_jobs'] = $stmt->fetch()['count'];
    
    jsonResponse(true, 'OK', ['stats' => $stats]);
}

// ==================== ESTADÍSTICAS POR IMPRESORA ====================

function getPrinterStats() {
    $user = requireAuth();
    global $db;
    
    $printerId = $_GET['id'] ?? 0;
    $period = $_GET['period'] ?? '30d'; // 7d, 30d, 90d, all
    
    if (!$printerId) {
        jsonResponse(false, 'ID de impresora requerido', [], 400);
    }
    
    // Verificar acceso
    if ($user['role'] !== 'admin' && !canAccessPrinter($user['id'], $printerId)) {
        jsonResponse(false, 'Acceso denegado', [], 403);
    }
    
    // Calcular timestamp de inicio según período
    $startTime = match($period) {
        '7d' => time() - (7 * 24 * 60 * 60),
        '30d' => time() - (30 * 24 * 60 * 60),
        '90d' => time() - (90 * 24 * 60 * 60),
        default => 0
    };
    
    $stats = [];
    
    // Total trabajos
    $stmt = $db->prepare('
        SELECT COUNT(*) as count FROM jobs 
        WHERE printer_id = ? AND started_at >= ?
    ');
    $stmt->execute([$printerId, $startTime]);
    $stats['total_jobs'] = $stmt->fetch()['count'];
    
    // Trabajos completados
    $stmt = $db->prepare('
        SELECT COUNT(*) as count FROM jobs 
        WHERE printer_id = ? AND status = "completed" AND started_at >= ?
    ');
    $stmt->execute([$printerId, $startTime]);
    $stats['completed_jobs'] = $stmt->fetch()['count'];
    
    // Trabajos fallidos
    $stmt = $db->prepare('
        SELECT COUNT(*) as count FROM jobs 
        WHERE printer_id = ? AND status = "failed" AND started_at >= ?
    ');
    $stmt->execute([$printerId, $startTime]);
    $stats['failed_jobs'] = $stmt->fetch()['count'];
    
    // Tiempo total de impresión
    $stmt = $db->prepare('
        SELECT SUM(duration) as total FROM jobs 
        WHERE printer_id = ? AND status = "completed" AND started_at >= ?
    ');
    $stmt->execute([$printerId, $startTime]);
    $totalSeconds = $stmt->fetch()['total'] ?? 0;
    $stats['total_print_time_hours'] = round($totalSeconds / 3600, 2);
    
    // Filamento usado
    $stmt = $db->prepare('
        SELECT SUM(filament_used) as total FROM jobs 
        WHERE printer_id = ? AND status = "completed" AND started_at >= ?
    ');
    $stmt->execute([$printerId, $startTime]);
    $totalGrams = $stmt->fetch()['total'] ?? 0;
    $stats['filament_used_kg'] = round($totalGrams / 1000, 2);
    
    // Tasa de éxito
    if ($stats['total_jobs'] > 0) {
        $stats['success_rate'] = round(($stats['completed_jobs'] / $stats['total_jobs']) * 100, 2);
    } else {
        $stats['success_rate'] = 0;
    }
    
    // Trabajo más largo
    $stmt = $db->prepare('
        SELECT duration, f.original_name 
        FROM jobs j
        LEFT JOIN files f ON j.file_id = f.id
        WHERE j.printer_id = ? AND j.status = "completed" AND j.started_at >= ?
        ORDER BY j.duration DESC LIMIT 1
    ');
    $stmt->execute([$printerId, $startTime]);
    $longestJob = $stmt->fetch();
    
    if ($longestJob) {
        $stats['longest_job'] = [
            'duration_hours' => round($longestJob['duration'] / 3600, 2),
            'file_name' => $longestJob['original_name']
        ];
    }
    
    // Últimos trabajos
    $stmt = $db->prepare('
        SELECT 
            j.*,
            f.original_name,
            u.username
        FROM jobs j
        LEFT JOIN files f ON j.file_id = f.id
        LEFT JOIN users u ON j.user_id = u.id
        WHERE j.printer_id = ? AND j.started_at >= ?
        ORDER BY j.started_at DESC
        LIMIT 10
    ');
    $stmt->execute([$printerId, $startTime]);
    $recentJobs = $stmt->fetchAll();
    
    foreach ($recentJobs as &$job) {
        if ($job['is_private'] && $user['role'] !== 'admin' && $job['user_id'] != $user['id']) {
            $job['original_name'] = '[Privado]';
        }
    }
    
    $stats['recent_jobs'] = $recentJobs;
    
    jsonResponse(true, 'OK', ['stats' => $stats]);
}

// ==================== ESTADÍSTICAS POR USUARIO ====================

function getUserStats() {
    $admin = requireAdmin();
    global $db;
    
    $userId = $_GET['id'] ?? 0;
    
    if (!$userId) {
        jsonResponse(false, 'ID de usuario requerido', [], 400);
    }
    
    $stats = [];
    
    // Total trabajos
    $stmt = $db->prepare('SELECT COUNT(*) as count FROM jobs WHERE user_id = ?');
    $stmt->execute([$userId]);
    $stats['total_jobs'] = $stmt->fetch()['count'];
    
    // Trabajos completados
    $stmt = $db->prepare('SELECT COUNT(*) as count FROM jobs WHERE user_id = ? AND status = "completed"');
    $stmt->execute([$userId]);
    $stats['completed_jobs'] = $stmt->fetch()['count'];
    
    // Archivos subidos
    $stmt = $db->prepare('SELECT COUNT(*) as count FROM files WHERE uploaded_by_user_id = ?');
    $stmt->execute([$userId]);
    $stats['files_uploaded'] = $stmt->fetch()['count'];
    
    // Tiempo total
    $stmt = $db->prepare('SELECT SUM(duration) as total FROM jobs WHERE user_id = ? AND status = "completed"');
    $stmt->execute([$userId]);
    $totalSeconds = $stmt->fetch()['total'] ?? 0;
    $stats['total_print_time_hours'] = round($totalSeconds / 3600, 2);
    
    // Filamento usado
    $stmt = $db->prepare('SELECT SUM(filament_used) as total FROM jobs WHERE user_id = ? AND status = "completed"');
    $stmt->execute([$userId]);
    $totalGrams = $stmt->fetch()['total'] ?? 0;
    $stats['filament_used_kg'] = round($totalGrams / 1000, 2);
    
    jsonResponse(true, 'OK', ['stats' => $stats]);
}

// ==================== REPORTE DE USO ====================

function getUsageReport() {
    $user = requireAuth();
    global $db;
    
    $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $_GET['end_date'] ?? date('Y-m-d');
    
    $startTime = strtotime($startDate . ' 00:00:00');
    $endTime = strtotime($endDate . ' 23:59:59');
    
    $report = [];
    
    // Trabajos por día
    if ($user['role'] === 'admin') {
        $stmt = $db->prepare('
            SELECT 
                DATE(started_at, "unixepoch") as date,
                COUNT(*) as count,
                SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed
            FROM jobs
            WHERE started_at >= ? AND started_at <= ?
            GROUP BY date
            ORDER BY date
        ');
    } else {
        $stmt = $db->prepare('
            SELECT 
                DATE(started_at, "unixepoch") as date,
                COUNT(*) as count,
                SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed
            FROM jobs
            WHERE started_at >= ? AND started_at <= ? AND user_id = ?
            GROUP BY date
            ORDER BY date
        ');
        $stmt->execute([$startTime, $endTime, $user['id']]);
    }
    
    if ($user['role'] === 'admin') {
        $stmt->execute([$startTime, $endTime]);
    }
    
    $report['jobs_by_day'] = $stmt->fetchAll();
    
    // Impresoras más usadas
    if ($user['role'] === 'admin') {
        $stmt = $db->prepare('
            SELECT 
                p.name,
                COUNT(j.id) as jobs_count,
                SUM(CASE WHEN j.status = "completed" THEN 1 ELSE 0 END) as completed
            FROM jobs j
            INNER JOIN printers p ON j.printer_id = p.id
            WHERE j.started_at >= ? AND j.started_at <= ?
            GROUP BY p.id
            ORDER BY jobs_count DESC
            LIMIT 10
        ');
    } else {
        $stmt = $db->prepare('
            SELECT 
                p.name,
                COUNT(j.id) as jobs_count,
                SUM(CASE WHEN j.status = "completed" THEN 1 ELSE 0 END) as completed
            FROM jobs j
            INNER JOIN printers p ON j.printer_id = p.id
            WHERE j.started_at >= ? AND j.started_at <= ? AND j.user_id = ?
            GROUP BY p.id
            ORDER BY jobs_count DESC
            LIMIT 10
        ');
        $stmt->execute([$startTime, $endTime, $user['id']]);
    }
    
    if ($user['role'] === 'admin') {
        $stmt->execute([$startTime, $endTime]);
    }
    
    $report['top_printers'] = $stmt->fetchAll();
    
    jsonResponse(true, 'OK', ['report' => $report]);
}

// ==================== HISTORIAL DE TRABAJOS ====================

function getJobsHistory() {
    global $db;
    
    $user = getCurrentUser();
    $printerId = $_GET['printer_id'] ?? null;
    $userId = $_GET['user_id'] ?? null;
    $status = $_GET['status'] ?? '';
    $limit = min((int)($_GET['limit'] ?? 50), 200);
    
    // Usuario público no puede ver historial
    if (!$user) {
        jsonResponse(false, 'Autenticación requerida', [], 401);
    }
    
    $sql = '
        SELECT 
            j.*,
            p.name as printer_name,
            f.original_name,
            u.username
        FROM jobs j
        INNER JOIN printers p ON j.printer_id = p.id
        LEFT JOIN files f ON j.file_id = f.id
        LEFT JOIN users u ON j.user_id = u.id
        WHERE 1=1
    ';
    $params = [];
    
    // Usuario no admin: solo sus trabajos o trabajos públicos
    if ($user['role'] !== 'admin') {
        $sql .= ' AND (j.user_id = ? OR j.is_private = 0)';
        $params[] = $user['id'];
    }
    
    if ($printerId) {
        $sql .= ' AND j.printer_id = ?';
        $params[] = $printerId;
    }
    
    if ($userId && $user['role'] === 'admin') {
        $sql .= ' AND j.user_id = ?';
        $params[] = $userId;
    }
    
    if (!empty($status)) {
        $sql .= ' AND j.status = ?';
        $params[] = $status;
    }
    
    $sql .= ' ORDER BY j.started_at DESC LIMIT ?';
    $params[] = $limit;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $jobs = $stmt->fetchAll();
    
    // Ocultar detalles de trabajos privados
    foreach ($jobs as &$job) {
        if ($job['is_private'] && $user['role'] !== 'admin' && $job['user_id'] != $user['id']) {
            $job['original_name'] = '[Privado]';
            $job['username'] = '[Privado]';
        }
        
        if ($job['duration']) {
            $job['duration_formatted'] = gmdate('H:i:s', $job['duration']);
        }
    }
    
    jsonResponse(true, 'OK', ['jobs' => $jobs]);
}

// ==================== USO DE FILAMENTO ====================

function getFilamentUsage() {
    $user = requireAuth();
    global $db;
    
    $period = $_GET['period'] ?? '30d';
    
    $startTime = match($period) {
        '7d' => time() - (7 * 24 * 60 * 60),
        '30d' => time() - (30 * 24 * 60 * 60),
        '90d' => time() - (90 * 24 * 60 * 60),
        default => 0
    };
    
    // Por impresora
    if ($user['role'] === 'admin') {
        $stmt = $db->prepare('
            SELECT 
                p.name,
                SUM(j.filament_used) as total_grams,
                COUNT(j.id) as jobs_count
            FROM jobs j
            INNER JOIN printers p ON j.printer_id = p.id
            WHERE j.status = "completed" AND j.started_at >= ?
            GROUP BY p.id
            ORDER BY total_grams DESC
        ');
        $stmt->execute([$startTime]);
    } else {
        $stmt = $db->prepare('
            SELECT 
                p.name,
                SUM(j.filament_used) as total_grams,
                COUNT(j.id) as jobs_count
            FROM jobs j
            INNER JOIN printers p ON j.printer_id = p.id
            WHERE j.status = "completed" AND j.started_at >= ? AND j.user_id = ?
            GROUP BY p.id
            ORDER BY total_grams DESC
        ');
        $stmt->execute([$startTime, $user['id']]);
    }
    
    $usage = $stmt->fetchAll();
    
    foreach ($usage as &$item) {
        $item['total_kg'] = round($item['total_grams'] / 1000, 2);
    }
    
    jsonResponse(true, 'OK', ['usage' => $usage]);
}

// ==================== TOP USUARIOS (Admin) ====================

function getTopUsers() {
    $admin = requireAdmin();
    global $db;
    
    $period = $_GET['period'] ?? '30d';
    $limit = min((int)($_GET['limit'] ?? 10), 50);
    
    $startTime = match($period) {
        '7d' => time() - (7 * 24 * 60 * 60),
        '30d' => time() - (30 * 24 * 60 * 60),
        '90d' => time() - (90 * 24 * 60 * 60),
        default => 0
    };
    
    $stmt = $db->prepare('
        SELECT 
            u.username,
            u.email,
            COUNT(j.id) as jobs_count,
            SUM(CASE WHEN j.status = "completed" THEN 1 ELSE 0 END) as completed,
            SUM(j.duration) as total_time,
            SUM(j.filament_used) as total_filament
        FROM users u
        LEFT JOIN jobs j ON u.id = j.user_id AND j.started_at >= ?
        WHERE u.is_blocked = 0
        GROUP BY u.id
        ORDER BY jobs_count DESC
        LIMIT ?
    ');
    $stmt->execute([$startTime, $limit]);
    $topUsers = $stmt->fetchAll();
    
    foreach ($topUsers as &$user) {
        $user['total_time_hours'] = round(($user['total_time'] ?? 0) / 3600, 2);
        $user['total_filament_kg'] = round(($user['total_filament'] ?? 0) / 1000, 2);
    }
    
    jsonResponse(true, 'OK', ['users' => $topUsers]);
}
