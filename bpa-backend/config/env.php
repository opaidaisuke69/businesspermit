<?php
// ============================================================
// Environment Configuration
// ============================================================

// Load .env file if exists
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

define('JWT_SECRET',         $_ENV['JWT_SECRET']         ?? 'lcc_bpa_secret_key_change_in_production');
define('JWT_EXPIRY',         (int)($_ENV['JWT_EXPIRY']   ?? 86400)); // 24h
define('PAYMONGO_SECRET',    $_ENV['PAYMONGO_SECRET']    ?? '');
define('PAYMONGO_PUBLIC',    $_ENV['PAYMONGO_PUBLIC']    ?? '');
define('PAYMONGO_WEBHOOK',   $_ENV['PAYMONGO_WEBHOOK']   ?? '');
define('UPLOAD_DIR',         $_ENV['UPLOAD_DIR']         ?? __DIR__ . '/../uploads/');
define('APP_URL',            $_ENV['APP_URL']            ?? 'http://localhost:8000');
define('PERMIT_FEE',         (float)($_ENV['PERMIT_FEE'] ?? 500.00));
define('CORS_ORIGIN',        $_ENV['CORS_ORIGIN']        ?? '*');
