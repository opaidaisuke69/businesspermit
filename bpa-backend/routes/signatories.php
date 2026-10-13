<?php
// ============================================================
// Document Signatories Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /signatories — any authenticated user (needed by permit/receipt generators)
if ($method === 'GET' && $uri === '/signatories') {
    requireAuth();
    $stmt = $db->query('SELECT * FROM document_signatories ORDER BY id');
    jsonResponse(['data' => $stmt->fetchAll()]);
}

// PUT /signatories — bulk update, admin only
if ($method === 'PUT' && $uri === '/signatories') {
    $admin = requireAdmin();
    $body  = getBody();

    if (!isset($body['signatories']) || !is_array($body['signatories']))
        jsonResponse(['error' => 'signatories array is required'], 422);

    $stmt = $db->prepare('UPDATE document_signatories SET person_name=?, credentials=?, signature_url=?, updated_by=? WHERE role_key=?');
    foreach ($body['signatories'] as $s) {
        if (empty($s['role_key'])) continue;
        $stmt->execute([
            sanitize($s['person_name'] ?? ''),
            sanitize($s['credentials'] ?? ''),
            !empty($s['signature_url']) ? $s['signature_url'] : null,
            $admin['sub'],
            sanitize($s['role_key']),
        ]);
    }

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,details) VALUES (?,?,?,?)')
       ->execute([$admin['sub'], 'update_signatories', 'document_signatories', json_encode(array_map(fn($s) => ['role_key' => $s['role_key'] ?? ''], $body['signatories']))]);

    jsonResponse(['message' => 'Signatories updated']);
}
