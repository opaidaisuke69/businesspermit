<?php
// ============================================================
// Applications Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /applications
if ($method === 'GET' && $uri === '/applications') {
    $payload = requireAuth();
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $limit   = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset  = ($page - 1) * $limit;
    $status  = $_GET['status'] ?? null;
    $search  = $_GET['search'] ?? null;

    $where = ['1=1']; $binds = [];

    if ($payload['role'] === 'user') {
        $where[] = 'a.user_id = ?'; $binds[] = $payload['sub'];
    }
    if ($status) { $where[] = 'a.status = ?'; $binds[] = $status; }
    if ($search) {
        $where[] = '(a.application_number LIKE ? OR a.business_name LIKE ? OR CONCAT(u.first_name," ",u.last_name) LIKE ?)';
        $s = "%$search%"; $binds = array_merge($binds, [$s,$s,$s]);
    }

    $sql = "SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS applicant_name, u.email AS applicant_email,
            vl.name AS location_name,
            p.status AS payment_status, p.amount AS payment_amount, p.id AS payment_id
            FROM applications a
            JOIN users u ON u.id = a.user_id
            LEFT JOIN vendor_locations vl ON vl.id = a.preferred_location_id
            LEFT JOIN payments p ON p.application_id = a.id
            WHERE " . implode(' AND ', $where) . " ORDER BY a.created_at DESC LIMIT $limit OFFSET $offset";
    $stmt = $db->prepare($sql);
    $stmt->execute($binds);
    $apps = $stmt->fetchAll();

    $countStmt = $db->prepare('SELECT COUNT(*) FROM applications a JOIN users u ON u.id=a.user_id WHERE ' . implode(' AND ', $where));
    $countStmt->execute($binds);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $apps, 'total' => $total, 'page' => $page, 'limit' => $limit]);
}

// POST /applications
if ($method === 'POST' && $uri === '/applications') {
    $payload = requireAuth();
    if ($payload['role'] !== 'user') jsonResponse(['error' => 'Forbidden'], 403);

    // Must be verified
    $stmt = $db->prepare('SELECT verification_status FROM users WHERE id = ?');
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();
    if (!$user || $user['verification_status'] !== 'verified')
        jsonResponse(['error' => 'Your account must be verified before applying.'], 403);

    // Check for active application (pending/under_review/approved but not yet paid)
    $stmt = $db->prepare("SELECT id FROM applications WHERE user_id = ? AND status IN ('pending','under_review','approved')");
    $stmt->execute([$payload['sub']]);
    if ($stmt->fetch()) jsonResponse(['error' => 'You already have an active application.'], 409);

    $body = getBody();
    $err  = validateRequired($body, ['business_name','type']);
    if ($err) jsonResponse(['error' => $err], 422);

    $appNum = generateAppNumber();
    $stmt = $db->prepare('INSERT INTO applications (user_id,application_number,type,business_name,business_type,products_sold,num_employees,num_papag,preferred_location_id) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $payload['sub'],
        $appNum,
        $body['type'] === 'renewal' ? 'renewal' : 'new',
        sanitize($body['business_name']),
        sanitize($body['business_type'] ?? ''),
        sanitize($body['products_sold'] ?? ''),
        isset($body['num_employees']) ? max(0, (int)$body['num_employees']) : 0,
        isset($body['num_papag'])     ? max(0, (int)$body['num_papag'])     : 0,
        !empty($body['preferred_location_id']) ? (int)$body['preferred_location_id'] : null,
    ]);
    $appId = $db->lastInsertId();

    // Notify admins
    $db->prepare('INSERT INTO notifications (admin_id,title,message,type) SELECT id,?,?,? FROM admins WHERE is_active=1')
       ->execute(["New Application Submitted", "Application $appNum has been submitted for review.", "application"]);

    jsonResponse(['message' => 'Application submitted', 'application_id' => $appId, 'application_number' => $appNum], 201);
}

// GET /applications/{id}
if ($method === 'GET' && preg_match('#^/applications/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];

    $stmt = $db->prepare("SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS applicant_name, u.email AS applicant_email,
        vl.name AS location_name,
        p.status AS payment_status, p.amount AS payment_amount, p.id AS payment_id,
        p.payment_method_type, p.rejection_reason AS payment_rejection_reason,
        pm.permit_number
        FROM applications a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN vendor_locations vl ON vl.id = a.preferred_location_id
        LEFT JOIN payments p ON p.application_id = a.id
        LEFT JOIN permits pm ON pm.application_id = a.id AND pm.permit_type = 'mayors_permit'
        WHERE a.id = ?");
    $stmt->execute([$id]);
    $app = $stmt->fetch();
    if (!$app) jsonResponse(['error' => 'Not found'], 404);

    if ($payload['role'] === 'user' && $app['user_id'] != $payload['sub'])
        jsonResponse(['error' => 'Forbidden'], 403);

    $docStmt = $db->prepare('SELECT * FROM application_documents WHERE application_id = ?');
    $docStmt->execute([$id]);
    $app['documents'] = $docStmt->fetchAll();

    jsonResponse($app);
}

// POST /applications/{id}/approve — admin only
// Approves the application; peddler is then notified to submit payment
if ($method === 'POST' && preg_match('#^/applications/(\d+)/approve$#', $uri, $m)) {
    $admin = requireAdmin();
    $id    = (int)$m[1];

    $stmt = $db->prepare('SELECT * FROM applications WHERE id = ?');
    $stmt->execute([$id]);
    $app = $stmt->fetch();
    if (!$app) jsonResponse(['error' => 'Not found'], 404);

    if (!in_array($app['status'], ['pending','under_review']))
        jsonResponse(['error' => 'Application is not in a reviewable state.'], 422);

    $db->prepare("UPDATE applications SET status='approved', reviewed_by=?, reviewed_at=NOW() WHERE id=?")
       ->execute([$admin['sub'], $id]);

    // Notify user to proceed with payment
    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"application")')
       ->execute([
           $app['user_id'],
           'Application Approved — Please Pay',
           "Your application {$app['application_number']} has been approved! Please submit your payment to receive your permits.",
       ]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'approve_application', 'applications', $id, json_encode(['status' => 'approved'])]);

    jsonResponse(['message' => 'Application approved. Peddler notified to submit payment.']);
}

// POST /applications/{id}/reject — admin only
if ($method === 'POST' && preg_match('#^/applications/(\d+)/reject$#', $uri, $m)) {
    $admin  = requireAdmin();
    $id     = (int)$m[1];
    $body   = getBody();
    $reason = sanitize($body['reason'] ?? 'Application rejected by admin.');

    $stmt = $db->prepare('SELECT * FROM applications WHERE id = ?');
    $stmt->execute([$id]);
    $app = $stmt->fetch();
    if (!$app) jsonResponse(['error' => 'Not found'], 404);

    $db->prepare("UPDATE applications SET status='rejected', reviewed_by=?, reviewed_at=NOW(), rejection_reason=? WHERE id=?")
       ->execute([$admin['sub'], $reason, $id]);

    // Notify user — they can resubmit
    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"application")')
       ->execute([
           $app['user_id'],
           'Application Rejected',
           "Your application {$app['application_number']} was rejected. Reason: $reason. You may submit a new application.",
       ]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'reject_application', 'applications', $id, json_encode(['reason' => $reason])]);

    jsonResponse(['message' => 'Application rejected. Peddler notified.']);
}
