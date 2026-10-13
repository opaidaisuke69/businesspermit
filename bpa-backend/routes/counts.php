<?php
// ============================================================
// Pending Counts Route
// ============================================================

requireAdmin();
$db = getDB();

// GET /counts/pending
if ($method === 'GET' && $uri === '/counts/pending') {
    $payload = requireAuth();
    $adminId = $payload['sub'];
    
    $stmt = $db->prepare("SELECT COUNT(*) FROM notifications WHERE admin_id=? AND is_read=0");
    $stmt->execute([$adminId]);
    $unreadNotifs = (int)$stmt->fetchColumn();
    
    $counts = [
        'pending_users'        => (int)$db->query("SELECT COUNT(*) FROM users WHERE verification_status='pending'")->fetchColumn(),
        'pending_applications' => (int)$db->query("SELECT COUNT(*) FROM applications WHERE status='pending'")->fetchColumn(),
        'pending_payments'     => (int)$db->query("SELECT COUNT(*) FROM payments WHERE status='pending'")->fetchColumn(),
        'unread_notifications' => $unreadNotifs,
    ];
    
    jsonResponse($counts);
}
