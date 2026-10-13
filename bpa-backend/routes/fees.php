<?php
// ============================================================
// Permit Fees Routes — Admin configurable fee settings
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /fees — public (used by mobile to show fee breakdown)
if ($method === 'GET' && $uri === '/fees') {
    requireAuth();
    $stmt = $db->query('SELECT * FROM permit_fees ORDER BY id');
    $fees = $stmt->fetchAll();
    jsonResponse(['data' => $fees]);
}

// PUT /fees/{key} — admin only
if ($method === 'PUT' && preg_match('#^/fees/([a-z_]+)$#', $uri, $m)) {
    $admin = requireAdmin();
    $key   = $m[1];
    $body  = getBody();

    if (!isset($body['amount'])) jsonResponse(['error' => 'amount is required'], 422);
    $amount = max(0, (float)$body['amount']);

    $stmt = $db->prepare('UPDATE permit_fees SET amount = ?, updated_by = ? WHERE fee_key = ?');
    $stmt->execute([$amount, $admin['sub'], $key]);

    if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Fee key not found'], 404);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,details) VALUES (?,?,?,?)')
       ->execute([$admin['sub'], 'update_fee', 'permit_fees', json_encode(['key' => $key, 'amount' => $amount])]);

    jsonResponse(['message' => 'Fee updated', 'fee_key' => $key, 'amount' => $amount]);
}

// PUT /fees — bulk update (admin only)
if ($method === 'PUT' && $uri === '/fees') {
    $admin = requireAdmin();
    $body  = getBody();

    if (!isset($body['fees']) || !is_array($body['fees']))
        jsonResponse(['error' => 'fees array is required'], 422);

    $stmt = $db->prepare('UPDATE permit_fees SET amount = ?, updated_by = ? WHERE fee_key = ?');
    foreach ($body['fees'] as $key => $amount) {
        $stmt->execute([max(0, (float)$amount), $admin['sub'], sanitize($key)]);
    }

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,details) VALUES (?,?,?,?)')
       ->execute([$admin['sub'], 'bulk_update_fees', 'permit_fees', json_encode($body['fees'])]);

    jsonResponse(['message' => 'Fees updated']);
}
