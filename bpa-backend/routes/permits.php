<?php
// ============================================================
// Permits Routes + PDF Generation
// ============================================================

require_once __DIR__ . '/../helpers/permit_html.php';

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();
if ($method === 'GET' && $uri === '/permits') {
    $payload = requireAuth();
    $where = ['1=1']; $binds = [];
    if ($payload['role'] === 'user') { 
        $where[] = 'pm.user_id = ?'; 
        $binds[] = $payload['sub'];
        // Only show active permits to users
        $where[] = "pm.status = 'active'";
    }

    $sql = "SELECT pm.*, CONCAT(u.first_name,' ',u.last_name) AS holder_name, u.email,
            a.business_name, a.application_number
            FROM permits pm
            JOIN users u ON u.id = pm.user_id
            JOIN applications a ON a.id = pm.application_id
            WHERE " . implode(' AND ', $where) . " ORDER BY pm.created_at DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($binds);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

// GET /permits/{id}
if ($method === 'GET' && preg_match('#^/permits/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];

    $stmt = $db->prepare("SELECT pm.*, CONCAT(u.first_name,' ',u.last_name) AS holder_name,
        u.email, u.phone, u.address, a.business_name, a.business_type, a.products_sold, a.application_number
        FROM permits pm
        JOIN users u ON u.id = pm.user_id
        JOIN applications a ON a.id = pm.application_id
        WHERE pm.id = ?");
    $stmt->execute([$id]);
    $permit = $stmt->fetch();
    if (!$permit) jsonResponse(['error' => 'Not found'], 404);

    if ($payload['role'] === 'user' && $permit['user_id'] != $payload['sub'])
        jsonResponse(['error' => 'Forbidden'], 403);

    jsonResponse($permit);
}

// GET /permits/{id}/download — generate PDF (both permits)
if ($method === 'GET' && preg_match('#^/permits/(\d+)/download$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];

    $stmt = $db->prepare("SELECT pm.*, CONCAT(u.first_name,' ',u.last_name) AS holder_name,
        u.email, u.phone, u.address, a.business_name, a.business_type, a.products_sold, a.application_number,
        a.preferred_location_id, vl.name AS location_name, vl.description AS location_description
        FROM permits pm
        JOIN users u ON u.id = pm.user_id
        JOIN applications a ON a.id = pm.application_id
        LEFT JOIN vendor_locations vl ON vl.id = a.preferred_location_id
        WHERE pm.id = ?");
    $stmt->execute([$id]);
    $permit = $stmt->fetch();
    if (!$permit) jsonResponse(['error' => 'Not found'], 404);

    if ($payload['role'] === 'user' && $permit['user_id'] != $payload['sub'])
        jsonResponse(['error' => 'Forbidden'], 403);
    
    // Prevent downloading revoked permits
    if ($permit['status'] === 'revoked')
        jsonResponse(['error' => 'This permit has been revoked and cannot be downloaded.'], 403);

    header('Content-Type: text/html; charset=utf-8');
    echo generatePermitHTML($permit);
    exit;
}

// GET /permits/{id}/download/mpp — Market Peddlers Permit only
if ($method === 'GET' && preg_match('#^/permits/(\d+)/download/mpp$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];

    $stmt = $db->prepare("SELECT pm.*, CONCAT(u.first_name,' ',u.last_name) AS holder_name,
        u.email, u.phone, u.address, a.business_name, a.business_type, a.products_sold, a.application_number,
        a.preferred_location_id, vl.name AS location_name, vl.description AS location_description
        FROM permits pm
        JOIN users u ON u.id = pm.user_id
        JOIN applications a ON a.id = pm.application_id
        LEFT JOIN vendor_locations vl ON vl.id = a.preferred_location_id
        WHERE pm.id = ?");
    $stmt->execute([$id]);
    $permit = $stmt->fetch();
    if (!$permit) jsonResponse(['error' => 'Not found'], 404);

    if ($payload['role'] === 'user' && $permit['user_id'] != $payload['sub'])
        jsonResponse(['error' => 'Forbidden'], 403);
    
    // Prevent downloading revoked permits
    if ($permit['status'] === 'revoked')
        jsonResponse(['error' => 'This permit has been revoked and cannot be downloaded.'], 403);

    header('Content-Type: text/html; charset=utf-8');
    echo generateMPPHTML($permit);
    exit;
}

// GET /permits/{id}/download/sp — Sanitary Permit only
if ($method === 'GET' && preg_match('#^/permits/(\d+)/download/sp$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];

    $stmt = $db->prepare("SELECT pm.*, CONCAT(u.first_name,' ',u.last_name) AS holder_name,
        u.email, u.phone, u.address, a.business_name, a.business_type, a.products_sold, a.application_number,
        a.preferred_location_id, vl.name AS location_name, vl.description AS location_description
        FROM permits pm
        JOIN users u ON u.id = pm.user_id
        JOIN applications a ON a.id = pm.application_id
        LEFT JOIN vendor_locations vl ON vl.id = a.preferred_location_id
        WHERE pm.id = ?");
    $stmt->execute([$id]);
    $permit = $stmt->fetch();
    if (!$permit) jsonResponse(['error' => 'Not found'], 404);

    if ($payload['role'] === 'user' && $permit['user_id'] != $payload['sub'])
        jsonResponse(['error' => 'Forbidden'], 403);
    
    // Prevent downloading revoked permits
    if ($permit['status'] === 'revoked')
        jsonResponse(['error' => 'This permit has been revoked and cannot be downloaded.'], 403);

    header('Content-Type: text/html; charset=utf-8');
    echo generateSPHTML($permit);
    exit;
}

// POST /permits/{id}/revoke — admin revokes permit
if ($method === 'POST' && preg_match('#^/permits/(\d+)/revoke$#', $uri, $m)) {
    $admin  = requireAdmin();
    $id     = (int)$m[1];
    $body   = getBody();
    $reason = sanitize($body['reason'] ?? 'Permit revoked by admin.');

    $stmt = $db->prepare('SELECT pm.*, a.preferred_location_id FROM permits pm JOIN applications a ON a.id=pm.application_id WHERE pm.id = ?');
    $stmt->execute([$id]);
    $permit = $stmt->fetch();
    if (!$permit) jsonResponse(['error' => 'Not found'], 404);

    if ($permit['status'] === 'revoked') jsonResponse(['error' => 'Permit is already revoked.'], 422);

    // Revoke permit
    $db->prepare("UPDATE permits SET status='revoked' WHERE id=?")
       ->execute([$id]);

    // Update application status to cancelled
    $db->prepare("UPDATE applications SET status='cancelled' WHERE id=?")
       ->execute([$permit['application_id']]);

    // Free up the location if assigned
    if ($permit['preferred_location_id']) {
        $db->prepare("UPDATE vendor_locations SET status='available' WHERE id=?")
           ->execute([$permit['preferred_location_id']]);
    }

    // Notify user
    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"permit")')
       ->execute([
           $permit['user_id'],
           'Permit Revoked',
           "Your permit {$permit['permit_number']} has been revoked. Reason: $reason. You may apply for a new permit.",
       ]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'revoke_permit', 'permits', $id, json_encode(['reason' => $reason])]);

    jsonResponse(['message' => 'Permit revoked. Application cancelled, location freed, and peddler notified.']);
}

require_once __DIR__ . '/../helpers/permit_html.php';


