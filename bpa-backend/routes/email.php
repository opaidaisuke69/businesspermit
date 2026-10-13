<?php
// ============================================================
// Email Verification & Password Reset Routes
// ============================================================

require_once __DIR__ . '/../helpers/mailer.php';

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

function generateOtp(): string {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}
function generateToken(): string {
    return bin2hex(random_bytes(32));
}
function invalidateOldTokens(PDO $db, string $email, string $type): void {
    $db->prepare("UPDATE email_tokens SET used=1 WHERE email=? AND type=? AND used=0")
       ->execute([$email, $type]);
}

// ── Helper: create user from pending_data ────────────────────
function createUserFromToken(PDO $db, array $row): int {
    $data = json_decode($row['pending_data'], true);
    if (!$data) return 0;

    // Check not already registered
    $chk = $db->prepare('SELECT id FROM users WHERE email=?');
    $chk->execute([$row['email']]);
    if ($existing = $chk->fetch()) return $existing['id'];

    $stmt = $db->prepare('INSERT INTO users (first_name,middle_name,last_name,email,phone,password_hash,address,age,gender,civil_status,ctc_number,email_verified,email_verified_at,onboarding_completed) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,NOW(),0)');
    $stmt->execute([
        $data['first_name'],
        $data['middle_name'] ?? null,
        $data['last_name'],
        $row['email'],
        $data['phone'],
        $data['password_hash'],
        $data['address'] ?? '',
        $data['age'] ?? null,
        $data['gender'] ?? null,
        $data['civil_status'] ?? null,
        $data['ctc_number'] ?? null,
    ]);
    $uid = (int)$db->lastInsertId();

    // Notify admins
    $db->prepare('INSERT INTO notifications (admin_id,title,message,type) SELECT id,"New User Registration","A new peddler has registered and awaits verification.","system" FROM admins WHERE is_active=1')->execute();

    return $uid;
}

// ── POST /auth/pre-register ──────────────────────────────────
// Validate registration data, send OTP/link, store pending data
// User is NOT created until email is verified
if ($method === 'POST' && ($uri === '/auth/pre-register' || $uri === '/auth/register')) {
    $body = getBody();
    $err  = validateRequired($body, ['first_name','last_name','email','phone','password']);
    if ($err) jsonResponse(['error' => $err], 422);

    if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL))
        jsonResponse(['error' => 'Invalid email address'], 422);

    if (strlen($body['password']) < 8)
        jsonResponse(['error' => 'Password must be at least 8 characters'], 422);

    $emailAddr  = strtolower(trim($body['email']));
    $sendMethod = in_array($body['method'] ?? 'code', ['code','link']) ? ($body['method'] ?? 'code') : 'code';

    // Check if already a verified user
    $chk = $db->prepare('SELECT id, email_verified FROM users WHERE email=?');
    $chk->execute([$emailAddr]);
    $existing = $chk->fetch();
    if ($existing && $existing['email_verified']) {
        jsonResponse(['error' => 'Email already registered'], 409);
    }

    // Store pending registration data (hashed password)
    $pendingData = json_encode([
        'first_name'    => sanitize($body['first_name']),
        'middle_name'   => sanitize($body['middle_name'] ?? ''),
        'last_name'     => sanitize($body['last_name']),
        'phone'         => sanitize($body['phone']),
        'address'       => sanitize($body['address'] ?? ''),
        'age'           => isset($body['age']) ? (int)$body['age'] : null,
        'gender'        => in_array(strtolower($body['gender'] ?? ''), ['male','female','other']) ? strtolower($body['gender']) : null,
        'civil_status'  => in_array(strtolower($body['civil_status'] ?? ''), ['single','married','widowed','separated']) ? strtolower($body['civil_status']) : null,
        'ctc_number'    => sanitize($body['ctc_number'] ?? ''),
        'password_hash' => password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]),
    ]);

    invalidateOldTokens($db, $emailAddr, 'email_verify');

    $otp   = generateOtp();
    $token = generateToken();
    $expInterval = $sendMethod === 'code' ? 'INTERVAL 15 MINUTE' : 'INTERVAL 30 MINUTE';

    // user_id = NULL means pending (no user yet)
    $db->prepare("INSERT INTO email_tokens (user_id,email,pending_data,token,otp,type,method,expires_at) VALUES (NULL,?,?,?,?,?,?,NOW() + {$expInterval})")
       ->execute([$emailAddr, $pendingData, $token, $otp, 'email_verify', $sendMethod]);

    $name = sanitize($body['first_name']) . ' ' . sanitize($body['last_name']);

    if ($sendMethod === 'code') {
        $sent = sendMail($emailAddr, $name, 'LCC BPA - Email Verification Code', emailVerifyOtpTemplate($name, $otp));
    } else {
        $link = APP_URL . '/api/auth/verify-email-link?token=' . $token;
        $sent = sendMail($emailAddr, $name, 'LCC BPA - Verify Your Email', emailVerifyLinkTemplate($name, $link));
    }

    if (!$sent) jsonResponse(['error' => 'Failed to send verification email. Please check your email address and try again.'], 500);

    jsonResponse([
        'message' => 'Verification ' . ($sendMethod === 'code' ? 'code' : 'link') . ' sent to ' . $emailAddr . '. Please verify to complete registration.',
        'email'   => $emailAddr,
        'method'  => $sendMethod,
    ], 201);
}

// ── POST /auth/send-verification ─────────────────────────────
// Resend for existing unverified users
if ($method === 'POST' && $uri === '/auth/send-verification') {
    $body   = getBody();
    $err    = validateRequired($body, ['email', 'method']);
    if ($err) jsonResponse(['error' => $err], 422);

    $emailAddr  = strtolower(trim($body['email']));
    $sendMethod = in_array($body['method'], ['code','link']) ? $body['method'] : 'code';

    // Check pending token or existing unverified user
    $chkToken = $db->prepare("SELECT id FROM email_tokens WHERE email=? AND type='email_verify' AND used=0 ORDER BY created_at DESC LIMIT 1");
    $chkToken->execute([$emailAddr]);
    $hasToken = $chkToken->fetch();

    $chkUser = $db->prepare('SELECT id, first_name, last_name, email_verified FROM users WHERE email=?');
    $chkUser->execute([$emailAddr]);
    $user = $chkUser->fetch();

    if (!$hasToken && !$user) jsonResponse(['error' => 'Email not found'], 404);
    if ($user && $user['email_verified']) jsonResponse(['error' => 'Email already verified'], 409);

    invalidateOldTokens($db, $emailAddr, 'email_verify');

    $otp   = generateOtp();
    $token = generateToken();
    $expInterval = $sendMethod === 'code' ? 'INTERVAL 15 MINUTE' : 'INTERVAL 30 MINUTE';

    // Get pending_data from last token if user not yet created
    $pendingData = null;
    if (!$user) {
        $lastToken = $db->prepare("SELECT pending_data FROM email_tokens WHERE email=? AND type='email_verify' ORDER BY created_at DESC LIMIT 1");
        $lastToken->execute([$emailAddr]);
        $lt = $lastToken->fetch();
        $pendingData = $lt['pending_data'] ?? null;
    }

    $uid = $user ? $user['id'] : null;
    $db->prepare("INSERT INTO email_tokens (user_id,email,pending_data,token,otp,type,method,expires_at) VALUES (?,?,?,?,?,?,?,NOW() + {$expInterval})")
       ->execute([$uid, $emailAddr, $pendingData, $token, $otp, 'email_verify', $sendMethod]);

    $name = $user ? ($user['first_name'] . ' ' . $user['last_name']) : 'User';

    if ($sendMethod === 'code') {
        $sent = sendMail($emailAddr, $name, 'LCC BPA — Email Verification Code', emailVerifyOtpTemplate($name, $otp));
    } else {
        $link = APP_URL . '/api/auth/verify-email-link?token=' . $token;
        $sent = sendMail($emailAddr, $name, 'LCC BPA — Verify Your Email', emailVerifyLinkTemplate($name, $link));
    }

    if (!$sent) jsonResponse(['error' => 'Failed to send email. Please try again.'], 500);
    jsonResponse(['message' => 'Verification ' . ($sendMethod === 'code' ? 'code' : 'link') . ' sent to ' . $emailAddr]);
}

// ── POST /auth/verify-email-code ─────────────────────────────
if ($method === 'POST' && $uri === '/auth/verify-email-code') {
    $body = getBody();
    $err  = validateRequired($body, ['email', 'otp']);
    if ($err) jsonResponse(['error' => $err], 422);

    $emailAddr = strtolower(trim($body['email']));
    $otp       = trim($body['otp']);

    $stmt = $db->prepare("SELECT * FROM email_tokens
        WHERE email=? AND otp=? AND type='email_verify' AND used=0 AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([$emailAddr, $otp]);
    $row = $stmt->fetch();

    if (!$row) jsonResponse(['error' => 'Invalid or expired code. Please request a new one.'], 422);

    $db->prepare('UPDATE email_tokens SET used=1 WHERE id=?')->execute([$row['id']]);

    // Create user if pending (no user_id yet)
    if (empty($row['user_id'])) {
        $uid = createUserFromToken($db, $row);
        if (!$uid) jsonResponse(['error' => 'Registration data expired. Please register again.'], 422);
    } else {
        $db->prepare('UPDATE users SET email_verified=1, email_verified_at=NOW() WHERE id=?')->execute([$row['user_id']]);
    }

    jsonResponse(['message' => 'Email verified! You can now sign in.']);
}

// ── GET /auth/verify-email-link ──────────────────────────────
if ($method === 'GET' && $uri === '/auth/verify-email-link') {
    $token = $_GET['token'] ?? '';
    if (!$token) jsonResponse(['error' => 'Missing token'], 422);

    $stmt = $db->prepare("SELECT * FROM email_tokens WHERE token=? AND type='email_verify' AND used=0 AND expires_at > NOW()");
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        header('Content-Type: text/html');
        echo '<html><body style="font-family:Arial;text-align:center;padding:60px"><h2 style="color:#EF4444">❌ Invalid or Expired Link</h2><p>Please request a new verification email.</p></body></html>';
        exit;
    }

    $db->prepare('UPDATE email_tokens SET used=1 WHERE id=?')->execute([$row['id']]);

    if (empty($row['user_id'])) {
        $uid = createUserFromToken($db, $row);
        if (!$uid) {
            header('Content-Type: text/html');
            echo '<html><body style="font-family:Arial;text-align:center;padding:60px"><h2 style="color:#EF4444">❌ Registration Expired</h2><p>Please register again.</p></body></html>';
            exit;
        }
    } else {
        $db->prepare('UPDATE users SET email_verified=1, email_verified_at=NOW() WHERE id=?')->execute([$row['user_id']]);
    }

    header('Content-Type: text/html');
    echo '<html><body style="font-family:Arial,sans-serif;background:#f0f7f4;margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center"><div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(7,59,58,.12);text-align:center"><div style="font-size:56px">✅</div><h2 style="color:#073B3A">Email Verified!</h2><p style="color:#4A7A72">Your account has been created and verified. You can now open the app and sign in.</p></div></body></html>';
    exit;
}

// ── POST /auth/forgot-password ───────────────────────────────
if ($method === 'POST' && $uri === '/auth/forgot-password') {
    $body   = getBody();
    $err    = validateRequired($body, ['email', 'method']);
    if ($err) jsonResponse(['error' => $err], 422);

    $emailAddr  = strtolower(trim($body['email']));
    $sendMethod = in_array($body['method'], ['code','link']) ? $body['method'] : 'code';

    $stmt = $db->prepare('SELECT id, first_name, last_name FROM users WHERE email=? AND is_active=1 AND email_verified=1');
    $stmt->execute([$emailAddr]);
    $user = $stmt->fetch();

    // Always return success to prevent email enumeration
    if (!$user) jsonResponse(['message' => 'If that email exists, a reset ' . ($sendMethod === 'code' ? 'code' : 'link') . ' has been sent.']);

    invalidateOldTokens($db, $emailAddr, 'password_reset');

    $otp   = generateOtp();
    $token = generateToken();
    $expInterval = $sendMethod === 'code' ? 'INTERVAL 15 MINUTE' : 'INTERVAL 30 MINUTE';

    $db->prepare("INSERT INTO email_tokens (user_id,email,token,otp,type,method,expires_at) VALUES (?,?,?,?,?,?,NOW() + {$expInterval})")
       ->execute([$user['id'], $emailAddr, $token, $otp, 'password_reset', $sendMethod]);

    $name = $user['first_name'] . ' ' . $user['last_name'];

    if ($sendMethod === 'code') {
        sendMail($emailAddr, $name, 'LCC BPA — Password Reset Code', passwordResetOtpTemplate($name, $otp));
    } else {
        $link = APP_URL . '/api/auth/reset-password-link?token=' . $token;
        sendMail($emailAddr, $name, 'LCC BPA — Reset Your Password', passwordResetLinkTemplate($name, $link));
    }

    jsonResponse(['message' => 'If that email exists, a reset ' . ($sendMethod === 'code' ? 'code' : 'link') . ' has been sent.']);
}

// ── POST /auth/reset-password-code ───────────────────────────
if ($method === 'POST' && $uri === '/auth/reset-password-code') {
    $body = getBody();
    $err  = validateRequired($body, ['email', 'otp', 'new_password']);
    if ($err) jsonResponse(['error' => $err], 422);

    if (strlen($body['new_password']) < 8)
        jsonResponse(['error' => 'Password must be at least 8 characters'], 422);

    $emailAddr = strtolower(trim($body['email']));

    $stmt = $db->prepare("SELECT * FROM email_tokens
        WHERE email=? AND otp=? AND type='password_reset' AND used=0 AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([$emailAddr, trim($body['otp'])]);
    $row = $stmt->fetch();

    if (!$row) jsonResponse(['error' => 'Invalid or expired code.'], 422);

    $hash = password_hash($body['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
    $db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash, $row['user_id']]);
    $db->prepare('UPDATE email_tokens SET used=1 WHERE id=?')->execute([$row['id']]);

    jsonResponse(['message' => 'Password reset successfully. You can now sign in.']);
}

// ── GET /auth/reset-password-link ────────────────────────────
if ($method === 'GET' && $uri === '/auth/reset-password-link') {
    $token = $_GET['token'] ?? '';

    $stmt = $db->prepare("SELECT * FROM email_tokens WHERE token=? AND type='password_reset' AND used=0 AND expires_at > NOW()");
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        header('Content-Type: text/html');
        echo '<html><body style="font-family:Arial;text-align:center;padding:60px"><h2 style="color:#EF4444">❌ Invalid or Expired Link</h2><p>Please request a new password reset.</p></body></html>';
        exit;
    }

    header('Content-Type: text/html');
    echo <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset Password — LCC BPA</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f7f4;margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#fff;border-radius:16px;padding:32px;max-width:400px;width:100%;box-shadow:0 4px 24px rgba(7,59,58,.12)}h2{color:#073B3A;margin:0 0 8px;font-size:22px}p{color:#4A7A72;font-size:14px;margin:0 0 20px}label{display:block;font-size:12px;font-weight:700;color:#4A7A72;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}input{width:100%;border:1.5px solid #D1E8E2;border-radius:10px;padding:12px 14px;font-size:14px;color:#0D2B28;background:#F0F7F4;margin-bottom:14px}button{width:100%;background:linear-gradient(135deg,#073B3A,#0B6E4F);color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer}.msg{padding:12px;border-radius:10px;font-size:13px;margin-bottom:14px;display:none}.success{background:#D1FAE5;color:#065F46}.error{background:#FEE2E2;color:#991B1B}</style></head>
<body><div class="card"><h2>🔑 Reset Password</h2><p>Enter your new password below.</p>
<div id="msg" class="msg"></div>
<form id="form"><input type="hidden" id="token" value="{$token}">
<label>New Password</label><input type="password" id="pw" placeholder="Min. 8 characters" required minlength="8">
<label>Confirm Password</label><input type="password" id="pw2" placeholder="Repeat password" required>
<button type="submit">Reset Password</button></form></div>
<script>document.getElementById('form').onsubmit=async function(e){e.preventDefault();var pw=document.getElementById('pw').value,pw2=document.getElementById('pw2').value,msg=document.getElementById('msg');if(pw!==pw2){msg.className='msg error';msg.style.display='block';msg.textContent='Passwords do not match.';return;}var r=await fetch(location.origin+'/lccsystem/bpa-backend/api/auth/reset-password-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:document.getElementById('token').value,new_password:pw})});var d=await r.json();msg.style.display='block';if(r.ok){msg.className='msg success';msg.textContent='✓ '+d.message;document.getElementById('form').style.display='none';}else{msg.className='msg error';msg.textContent='✗ '+d.error;}};</script></body></html>
HTML;
    exit;
}

// ── POST /auth/reset-password-link ───────────────────────────
if ($method === 'POST' && $uri === '/auth/reset-password-link') {
    $body = getBody();
    $err  = validateRequired($body, ['token', 'new_password']);
    if ($err) jsonResponse(['error' => $err], 422);

    if (strlen($body['new_password']) < 8)
        jsonResponse(['error' => 'Password must be at least 8 characters'], 422);

    $stmt = $db->prepare("SELECT * FROM email_tokens WHERE token=? AND type='password_reset' AND used=0 AND expires_at > NOW()");
    $stmt->execute([trim($body['token'])]);
    $row = $stmt->fetch();

    if (!$row) jsonResponse(['error' => 'Invalid or expired token.'], 422);

    $hash = password_hash($body['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
    $db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash, $row['user_id']]);
    $db->prepare('UPDATE email_tokens SET used=1 WHERE id=?')->execute([$row['id']]);

    jsonResponse(['message' => 'Password reset successfully. You can now sign in.']);
}

