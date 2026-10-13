<?php
// ============================================================
// Auth Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// POST /auth/register — now just an alias for pre-register (kept for backward compat)
if ($method === 'POST' && $uri === '/auth/register') {
    // Redirect to pre-register logic
    $GLOBALS['route_uri'] = '/auth/pre-register';
    require __DIR__ . '/email.php';
    exit;
}

// POST /auth/login (user)
if ($method === 'POST' && $uri === '/auth/login') {
    $body = getBody();
    $err  = validateRequired($body, ['email','password']);
    if ($err) jsonResponse(['error' => $err], 422);

    // Fetch user regardless of is_active to distinguish deactivated vs wrong credentials
    $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([strtolower(trim($body['email']))]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($body['password'], $user['password_hash']))
        jsonResponse(['error' => 'Invalid credentials'], 401);

    // Block login if account is deactivated
    if (!$user['is_active']) {
        jsonResponse([
            'error'               => 'Your account has been deactivated. Please contact the admin for assistance.',
            'account_deactivated' => true,
        ], 403);
    }

    // Block login if email not verified
    if (!$user['email_verified']) {
        jsonResponse([
            'error'            => 'Email not verified',
            'email_unverified' => true,
            'email'            => $user['email'],
        ], 403);
    }

    $token = jwtEncode([
        'sub'    => $user['id'],
        'email'  => $user['email'],
        'role'   => 'user',
        'status' => $user['verification_status'],
    ]);

    unset($user['password_hash']);
    // Convert numeric fields to proper types for JavaScript
    $user['onboarding_completed'] = (int)$user['onboarding_completed'];
    $user['onboarding_step'] = (int)$user['onboarding_step'];
    jsonResponse(['token' => $token, 'user' => $user]);
}

// POST /auth/admin/login
if ($method === 'POST' && $uri === '/auth/admin/login') {
    $body = getBody();
    $err  = validateRequired($body, ['email','password']);
    if ($err) jsonResponse(['error' => $err], 422);

    $stmt = $db->prepare('SELECT * FROM admins WHERE email = ? AND is_active = 1');
    $stmt->execute([strtolower(trim($body['email']))]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($body['password'], $admin['password_hash']))
        jsonResponse(['error' => 'Invalid credentials'], 401);

    $token = jwtEncode([
        'sub'   => $admin['id'],
        'email' => $admin['email'],
        'role'  => $admin['role'],
    ]);

    unset($admin['password_hash']);
    jsonResponse(['token' => $token, 'admin' => $admin]);
}

// GET /auth/me
if ($method === 'GET' && $uri === '/auth/me') {
    $payload = requireAuth();
    $isAdmin = in_array($payload['role'], ['admin','super_admin']);
    if ($isAdmin) {
        $stmt = $db->prepare('SELECT id,name,email,role FROM admins WHERE id = ?');
    } else {
        $stmt = $db->prepare('SELECT id,first_name,middle_name,last_name,email,phone,address,age,gender,civil_status,ctc_number,num_employees,verification_status,onboarding_step,onboarding_completed FROM users WHERE id = ?');
    }
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'Not found'], 404);
    
    // Convert numeric fields to proper types for JavaScript (only for regular users)
    if (!$isAdmin) {
        $user['onboarding_completed'] = (int)$user['onboarding_completed'];
        $user['onboarding_step'] = (int)$user['onboarding_step'];
    }
    
    jsonResponse($user);
}
