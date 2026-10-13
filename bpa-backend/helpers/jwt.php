<?php
// ============================================================
// JWT Helper (HS256, no external library)
// ============================================================

function jwtEncode(array $payload): string {
    $header  = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;
    $body    = base64url_encode(json_encode($payload));
    $sig     = base64url_encode(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
    return "$header.$body.$sig";
}

function jwtDecode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $body, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $payload = json_decode(base64url_decode($body), true);
    if (!$payload || $payload['exp'] < time()) return null;
    return $payload;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

function requireAuth(): array {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    // Also accept token as query param for browser/WebView downloads
    if (empty($auth) && !empty($_GET['token'])) {
        $auth = 'Bearer ' . $_GET['token'];
    }

    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
    $payload = jwtDecode($m[1]);
    if (!$payload) jsonResponse(['error' => 'Invalid or expired token'], 401);

    // For user-role tokens, verify the account is still active
    if (($payload['role'] ?? '') === 'user') {
        $db   = getDB();
        $stmt = $db->prepare('SELECT is_active FROM users WHERE id = ?');
        $stmt->execute([$payload['sub']]);
        $row  = $stmt->fetch();
        if (!$row || !$row['is_active']) {
            jsonResponse([
                'error'               => 'Your account has been deactivated. Please contact the admin.',
                'account_deactivated' => true,
            ], 403);
        }
    }

    return $payload;
}

function requireAdmin(): array {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'admin' && ($payload['role'] ?? '') !== 'super_admin') {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    return $payload;
}
