<?php
// ============================================================
// Dashboard Stats Route
// ============================================================

requireAdmin();
$db = getDB();

$stats = [];

// Totals
$stats['total_users']        = $db->query('SELECT COUNT(*) FROM users')->fetchColumn();
$stats['verified_users']     = $db->query("SELECT COUNT(*) FROM users WHERE verification_status='verified'")->fetchColumn();
$stats['pending_users']      = $db->query("SELECT COUNT(*) FROM users WHERE verification_status='pending'")->fetchColumn();
$stats['total_applications'] = $db->query('SELECT COUNT(*) FROM applications')->fetchColumn();
$stats['pending_apps']       = $db->query("SELECT COUNT(*) FROM applications WHERE status='pending'")->fetchColumn();
$stats['approved_apps']      = $db->query("SELECT COUNT(*) FROM applications WHERE status='approved'")->fetchColumn();
$stats['total_permits']      = $db->query("SELECT COUNT(*) FROM permits WHERE status='active'")->fetchColumn();
$stats['total_revenue']      = $db->query("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN ('paid','verified')")->fetchColumn();
$stats['pending_payments']   = $db->query("SELECT COUNT(*) FROM payments WHERE status='pending'")->fetchColumn();
$stats['total_locations']    = $db->query("SELECT COUNT(*) FROM vendor_locations WHERE status != 'inactive'")->fetchColumn();
$stats['available_slots']    = $db->query("SELECT COUNT(*) FROM vendor_locations WHERE status='available'")->fetchColumn();
$stats['occupied_slots']     = $db->query("SELECT COUNT(*) FROM vendor_locations WHERE status='occupied'")->fetchColumn();

// Monthly revenue (last 6 months)
$stmt = $db->query("SELECT DATE_FORMAT(COALESCE(paid_at, created_at),'%Y-%m') AS month, SUM(amount) AS revenue
    FROM payments 
    WHERE status IN ('paid','verified') 
      AND COALESCE(paid_at, created_at) >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month 
    ORDER BY month");
$stats['monthly_revenue'] = $stmt->fetchAll();

// Recent applications
$stmt = $db->query("SELECT a.application_number, a.status, a.created_at, CONCAT(u.first_name,' ',u.last_name) AS name
    FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 5");
$stats['recent_applications'] = $stmt->fetchAll();

// Application status breakdown
$stmt = $db->query("SELECT status, COUNT(*) AS count FROM applications GROUP BY status");
$stats['application_breakdown'] = $stmt->fetchAll();

// Recent activity logs (last 15) - from notifications
$stmt = $db->query("
    SELECT n.id, n.title, n.message, n.type, n.created_at,
           a.name AS admin_name,
           CONCAT(u.first_name, ' ', u.last_name) AS user_name
    FROM notifications n
    LEFT JOIN admins a ON a.id = n.admin_id
    LEFT JOIN users u ON u.id = n.user_id
    ORDER BY n.created_at DESC
    LIMIT 15
");
$stats['activity_logs'] = $stmt->fetchAll();

jsonResponse($stats);
