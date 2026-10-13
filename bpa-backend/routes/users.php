<?php
// ============================================================
// Users Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$params = $GLOBALS['route_params'];
$db     = getDB();

// GET /users — admin only
if ($method === 'GET' && $uri === '/users') {
    requireAdmin();
    $status = $_GET['status'] ?? null;
    $search = $_GET['search'] ?? null;
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $where = ['1=1'];
    $binds = [];
    if ($status) { $where[] = 'verification_status = ?'; $binds[] = $status; }
    if ($search) { $where[] = '(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; $s = "%$search%"; $binds = array_merge($binds, [$s,$s,$s]); }

    $sql   = 'SELECT id,first_name,last_name,email,phone,address,verification_status,is_active,onboarding_step,onboarding_completed,created_at FROM users WHERE ' . implode(' AND ', $where) . " ORDER BY created_at DESC LIMIT $limit OFFSET $offset";
    $stmt  = $db->prepare($sql);
    $stmt->execute($binds);
    $users = $stmt->fetchAll();

    $countStmt = $db->prepare('SELECT COUNT(*) FROM users WHERE ' . implode(' AND ', $where));
    $countStmt->execute($binds);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $users, 'total' => $total, 'page' => $page, 'limit' => $limit]);
}

// GET /users/{id}
if ($method === 'GET' && preg_match('#^/users/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $id = (int)$m[1];
    if ($payload['role'] === 'user' && $payload['sub'] != $id)
        jsonResponse(['error' => 'Forbidden'], 403);

    $stmt = $db->prepare('SELECT id,first_name,middle_name,last_name,email,phone,address,age,gender,civil_status,ctc_number,num_employees,id_type,id_number,id_photo_url,selfie_url,verification_status,onboarding_step,onboarding_completed,created_at FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found'], 404);
    jsonResponse($user);
}

// PUT /users/{id}
if ($method === 'PUT' && preg_match('#^/users/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $id   = (int)$m[1];
    if ($payload['role'] === 'user' && $payload['sub'] != $id)
        jsonResponse(['error' => 'Forbidden'], 403);

    $body = getBody();
    $allowed = ['first_name','middle_name','last_name','phone','address','age','gender','civil_status','ctc_number','num_employees','id_type','id_number','id_photo_url','selfie_url'];
    $sets = []; $binds = [];
    foreach ($allowed as $f) {
        if (isset($body[$f])) {
            // Special handling for num_employees to ensure it's a positive integer
            if ($f === 'num_employees') {
                $sets[] = "$f = ?";
                $binds[] = max(1, (int)$body[$f]);
            } elseif ($f === 'gender') {
                $valid = ['male','female','other'];
                $sets[] = "$f = ?";
                $binds[] = in_array(strtolower($body[$f]), $valid) ? strtolower($body[$f]) : null;
            } else {
                $sets[] = "$f = ?";
                $binds[] = sanitize((string)$body[$f]);
            }
        }
    }
    if (empty($sets)) jsonResponse(['error' => 'Nothing to update'], 422);
    $binds[] = $id;
    $db->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($binds);
    jsonResponse(['message' => 'Profile updated']);
}

// POST /users/{id}/verify — admin only
if ($method === 'POST' && preg_match('#^/users/(\d+)/verify$#', $uri, $m)) {
    $admin = requireAdmin();
    $id    = (int)$m[1];
    $db->prepare('UPDATE users SET verification_status="verified", verified_by=?, verified_at=NOW() WHERE id=?')
       ->execute([$admin['sub'], $id]);

    // Notify user
    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,"Account Verified","Your account has been verified. You may now apply for a business permit.","system")')
       ->execute([$id]);

    // Audit log
    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'verify_user', 'users', $id, json_encode(['status' => 'verified'])]);

    jsonResponse(['message' => 'User verified']);
}

// POST /users/{id}/reject — admin only
if ($method === 'POST' && preg_match('#^/users/(\d+)/reject$#', $uri, $m)) {
    $admin  = requireAdmin();
    $id     = (int)$m[1];
    $body   = getBody();
    $reason = sanitize($body['reason'] ?? 'Verification rejected by admin.');

    $db->prepare('UPDATE users SET verification_status="rejected", verified_by=?, verified_at=NOW(), rejection_reason=? WHERE id=?')
       ->execute([$admin['sub'], $reason, $id]);

    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"system")')
       ->execute([$id, 'Account Verification Rejected', $reason]);

    jsonResponse(['message' => 'User rejected']);
}

// POST /users/{id}/deactivate — admin only
if ($method === 'POST' && preg_match('#^/users/(\d+)/deactivate$#', $uri, $m)) {
    $admin  = requireAdmin();
    $id     = (int)$m[1];
    $body   = getBody();
    $reason = sanitize($body['reason'] ?? 'Account deactivated by admin.');

    $stmt = $db->prepare('SELECT id, is_active FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found'], 404);
    if (!$user['is_active']) jsonResponse(['error' => 'Account is already deactivated.'], 422);

    $db->prepare('UPDATE users SET is_active=0 WHERE id=?')->execute([$id]);

    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"system")')
       ->execute([$id, 'Account Deactivated', "Your account has been deactivated. Reason: $reason. Please contact the admin for assistance."]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'deactivate_user', 'users', $id, json_encode(['reason' => $reason])]);

    jsonResponse(['message' => 'Account deactivated.']);
}

// POST /users/{id}/activate — admin only
if ($method === 'POST' && preg_match('#^/users/(\d+)/activate$#', $uri, $m)) {
    $admin = requireAdmin();
    $id    = (int)$m[1];

    $stmt = $db->prepare('SELECT id, is_active FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found'], 404);
    if ($user['is_active']) jsonResponse(['error' => 'Account is already active.'], 422);

    $db->prepare('UPDATE users SET is_active=1 WHERE id=?')->execute([$id]);

    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"system")')
       ->execute([$id, 'Account Reactivated', 'Your account has been reactivated. You can now log in again.']);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'activate_user', 'users', $id, json_encode(['reactivated' => true])]);

    jsonResponse(['message' => 'Account reactivated.']);
}
