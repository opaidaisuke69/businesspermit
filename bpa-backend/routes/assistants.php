<?php
// ============================================================
// Assistants Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /assistants
if ($method === 'GET' && $uri === '/assistants') {
    $payload = requireAuth();
    $uid = in_array($payload['role'], ['admin','super_admin'])
        ? (int)($_GET['user_id'] ?? 0)
        : (int)$payload['sub'];

    $stmt = $db->prepare('SELECT * FROM user_assistants WHERE user_id = ? ORDER BY created_at');
    $stmt->execute([$uid]);
    $assistants = $stmt->fetchAll();

    // Get employee limit from user profile
    $userStmt = $db->prepare('SELECT num_employees FROM users WHERE id = ?');
    $userStmt->execute([$uid]);
    $user = $userStmt->fetch();
    $numEmployees = $user ? (int)($user['num_employees'] ?? 1) : 1;
    $maxAssistants = $numEmployees > 0 ? $numEmployees - 1 : 0;

    jsonResponse([
        'data' => $assistants,
        'num_employees' => $numEmployees,
        'max_assistants' => $maxAssistants,
        'current_count' => count($assistants),
        'can_add_more' => count($assistants) < $numEmployees,
    ]);
}

// POST /assistants
if ($method === 'POST' && $uri === '/assistants') {
    $payload = requireAuth();
    if (!in_array($payload['role'], ['user'])) jsonResponse(['error' => 'Forbidden'], 403);
    $uid  = (int)$payload['sub'];
    $body = getBody();

    $err = validateRequired($body, ['first_name','last_name']);
    if ($err) jsonResponse(['error' => $err], 422);

    // Check employee limit from the user's profile
    $userStmt = $db->prepare('SELECT num_employees FROM users WHERE id = ?');
    $userStmt->execute([$uid]);
    $user = $userStmt->fetch();
    
    if ($user) {
        $numEmployees = (int)($user['num_employees'] ?? 1);
        
        // Count current assistants
        $countStmt = $db->prepare('SELECT COUNT(*) FROM user_assistants WHERE user_id = ?');
        $countStmt->execute([$uid]);
        $currentCount = (int)$countStmt->fetchColumn();
        
        // Validate: assistants count must be less than num_employees
        // If num_employees = 1, can't add any assistants (0 < 1)
        // If num_employees = 2, can add 1 assistant (1 < 2)
        if ($currentCount >= $numEmployees) {
            $maxAllowed = $numEmployees > 0 ? ($numEmployees - 1) : 0;
            jsonResponse([
                'error' => "You cannot add more assistants. Your employee count is $numEmployees, which means you can add up to $maxAllowed assistant(s). You currently have $currentCount."
            ], 422);
        }
    }

    $stmt = $db->prepare('INSERT INTO user_assistants (user_id,first_name,last_name,relationship,phone,address,photo_url) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([
        $uid,
        sanitize($body['first_name']),
        sanitize($body['last_name']),
        sanitize($body['relationship'] ?? ''),
        sanitize($body['phone'] ?? ''),
        sanitize($body['address'] ?? ''),
        sanitize($body['photo_url'] ?? ''),
    ]);

    // Recalculate onboarding step
    require_once __DIR__ . '/verification.php';
    _updateOnboardingStep($db, $uid);

    jsonResponse(['message' => 'Assistant added', 'id' => $db->lastInsertId()], 201);
}

// PUT /assistants/{id}
if ($method === 'PUT' && preg_match('#^/assistants/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $uid = (int)$payload['sub'];
    $id  = (int)$m[1];

    $stmt = $db->prepare('SELECT user_id FROM user_assistants WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || ($payload['role'] === 'user' && $row['user_id'] != $uid))
        jsonResponse(['error' => 'Not found'], 404);

    $body    = getBody();
    $allowed = ['first_name','last_name','relationship','phone','address','photo_url'];
    $sets = []; $binds = [];
    foreach ($allowed as $f) {
        if (isset($body[$f])) { $sets[] = "$f = ?"; $binds[] = sanitize((string)$body[$f]); }
    }
    if (empty($sets)) jsonResponse(['error' => 'Nothing to update'], 422);
    $binds[] = $id;
    $db->prepare('UPDATE user_assistants SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($binds);
    jsonResponse(['message' => 'Assistant updated']);
}

// DELETE /assistants/{id}
if ($method === 'DELETE' && preg_match('#^/assistants/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $uid = (int)$payload['sub'];
    $id  = (int)$m[1];

    $stmt = $db->prepare('SELECT user_id FROM user_assistants WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || ($payload['role'] === 'user' && $row['user_id'] != $uid))
        jsonResponse(['error' => 'Not found'], 404);

    $db->prepare('DELETE FROM user_assistants WHERE id = ?')->execute([$id]);

    require_once __DIR__ . '/verification.php';
    _updateOnboardingStep($db, $uid);

    jsonResponse(['message' => 'Assistant removed']);
}
