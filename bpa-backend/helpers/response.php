<?php
// ============================================================
// Response & CORS Helpers
// ============================================================

function setCorsHeaders(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = CORS_ORIGIN;

    // Allow any origin in development (CORS_ORIGIN=*)
    // or match specific origin in production
    if ($allowed === '*' || $origin === $allowed) {
        header('Access-Control-Allow-Origin: ' . ($allowed === '*' ? '*' : $origin));
    } elseif ($allowed === '*') {
        header('Access-Control-Allow-Origin: *');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function jsonResponse(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function sanitize(string $val): string {
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}

function validateRequired(array $data, array $fields): ?string {
    foreach ($fields as $f) {
        if (empty($data[$f])) return "Field '$f' is required.";
    }
    return null;
}

function generateAppNumber(): string {
    return 'APP-' . date('Y') . '-' . strtoupper(substr(uniqid(), -6));
}

function generatePermitNumber(): string {
    $yy      = date('y');                          // e.g. "26"
    $chars   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $suffix  = '';
    for ($i = 0; $i < 6; $i++) {
        $suffix .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $yy . '-' . $suffix;                    // e.g. "26-F53PX7"
}

function paginate(array $data, int $page, int $perPage): array {
    $total = count($data);
    $offset = ($page - 1) * $perPage;
    return [
        'data'        => array_slice($data, $offset, $perPage),
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => (int)ceil($total / $perPage),
    ];
}
