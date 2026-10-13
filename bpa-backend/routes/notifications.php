<?php
// ============================================================
// Notifications Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /notifications
if ($method === 'GET' && $uri === '/notifications') {
    $payload = requireAuth();
    $isAdmin = in_array($payload['role'], ['admin','super_admin']);

    if ($isAdmin) {
        $stmt = $db->prepare('SELECT * FROM notifications WHERE admin_id = ? ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([$payload['sub']]);
    } else {
        $stmt = $db->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([$payload['sub']]);
    }

    $notifs = $stmt->fetchAll();
    $unread = array_filter($notifs, fn($n) => !$n['is_read']);
    jsonResponse(['data' => $notifs, 'unread_count' => count($unread)]);
}

// POST /notifications/{id}/read
if ($method === 'POST' && preg_match('#^/notifications/(\d+)/read$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];
    $db->prepare('UPDATE notifications SET is_read=1 WHERE id=?')->execute([$id]);
    jsonResponse(['message' => 'Marked as read']);
}
