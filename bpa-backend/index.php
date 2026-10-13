<?php
// ============================================================
// LCC BPA - Main Router
// ============================================================

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/jwt.php';

setCorsHeaders();

// Resolve URI relative to this script's directory
// Works for: /api/..., /lccsystem/bpa-backend/api/..., etc.
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve static files from uploads directory BEFORE any path manipulation
if (strpos($uri, '/uploads/') !== false) {
    // Extract just the filename part
    $filename = basename($uri);
    $filePath = rtrim(UPLOAD_DIR, '/') . '/' . $filename;
    
    if (file_exists($filePath) && is_file($filePath)) {
        $mimeType = mime_content_type($filePath);
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: public, max-age=31536000'); // Cache for 1 year
        readfile($filePath);
        exit;
    } else {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File not found', 'filename' => $filename, 'path' => $filePath]);
        exit;
    }
}

// Strip the script's base path so routes are always relative
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($scriptDir && strpos($uri, $scriptDir) === 0) {
    $uri = substr($uri, strlen($scriptDir));
}

// Strip /api prefix if present
if (strpos($uri, '/api') === 0) {
    $uri = substr($uri, 4);
}

$uri = rtrim($uri, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'];

// Route map: [METHOD, pattern, handler_file]
$routes = [
    // Auth
    ['POST', '/auth/register',          'routes/auth.php'],
    ['POST', '/auth/pre-register',      'routes/email.php'],
    ['POST', '/auth/login',             'routes/auth.php'],
    ['POST', '/auth/admin/login',       'routes/auth.php'],
    ['GET',  '/auth/me',                'routes/auth.php'],

    // Users
    ['GET',  '/users',                  'routes/users.php'],
    ['GET',  '/users/{id}',             'routes/users.php'],
    ['PUT',  '/users/{id}',             'routes/users.php'],
    ['POST', '/users/{id}/verify',      'routes/users.php'],
    ['POST', '/users/{id}/reject',      'routes/users.php'],
    ['POST', '/users/{id}/deactivate',  'routes/users.php'],
    ['POST', '/users/{id}/activate',    'routes/users.php'],

    // Applications
    ['GET',  '/applications',           'routes/applications.php'],
    ['POST', '/applications',           'routes/applications.php'],
    ['GET',  '/applications/{id}',      'routes/applications.php'],
    ['PUT',  '/applications/{id}',      'routes/applications.php'],
    ['POST', '/applications/{id}/approve', 'routes/applications.php'],
    ['POST', '/applications/{id}/reject',  'routes/applications.php'],

    // Renewals
    ['GET',  '/renewals/check-eligibility', 'routes/renewals.php'],
    ['POST', '/renewals/create',            'routes/renewals.php'],

    // Payments
    ['GET',  '/payments',                   'routes/payments.php'],
    ['POST', '/payments',                   'routes/payments.php'],
    ['GET',  '/payments/fees-preview',      'routes/payments.php'],
    ['GET',  '/payments/{id}',              'routes/payments.php'],
    ['GET',  '/payments/{id}/receipt',      'routes/payments.php'],
    ['POST', '/payments/{id}/approve',      'routes/payments.php'],
    ['POST', '/payments/{id}/reject',       'routes/payments.php'],
    ['POST', '/payments/{id}/verify',       'routes/payments.php'],
    ['POST', '/payments/webhook',           'routes/payments.php'],

    // PayMongo Integration
    ['POST', '/paymongo/create-payment-intent',    'routes/paymongo.php'],
    ['POST', '/paymongo/attach-payment-method',    'routes/paymongo.php'],
    ['GET',  '/paymongo/payment-status',           'routes/paymongo.php'],
    ['POST', '/paymongo/webhook',                  'routes/paymongo.php'],
    ['GET',  '/paymongo/payment-methods',          'routes/paymongo.php'],
    ['GET',  '/paymongo/test',                     'routes/paymongo.php'],
    ['GET',  '/paymongo-return',                   'routes/paymongo.php'],
    ['POST', '/paymongo/create-qrph-source',       'routes/paymongo.php'],
    ['GET',  '/paymongo/qrph-status',              'routes/paymongo.php'],
    ['POST', '/paymongo/create-payment-link',      'routes/paymongo.php'],
    ['GET',  '/paymongo/link-status',              'routes/paymongo.php'],

    // Permit Fees (admin settings)
    ['GET',  '/fees',                   'routes/fees.php'],
    ['PUT',  '/fees',                   'routes/fees.php'],
    ['PUT',  '/fees/{key}',             'routes/fees.php'],

    // Document Signatories (admin settings)
    ['GET',  '/signatories',            'routes/signatories.php'],
    ['PUT',  '/signatories',            'routes/signatories.php'],

    // Permits
    ['GET',  '/permits',                    'routes/permits.php'],
    ['GET',  '/permits/{id}',               'routes/permits.php'],
    ['GET',  '/permits/{id}/download',      'routes/permits.php'],
    ['GET',  '/permits/{id}/download/mpp',  'routes/permits.php'],
    ['GET',  '/permits/{id}/download/sp',   'routes/permits.php'],
    ['POST', '/permits/{id}/revoke',        'routes/permits.php'],

    // Vendor Locations
    ['GET',  '/locations',              'routes/locations.php'],
    ['POST', '/locations',              'routes/locations.php'],
    ['PUT',  '/locations/{id}',         'routes/locations.php'],
    ['DELETE','/locations/{id}',        'routes/locations.php'],

    // Notifications
    ['GET',  '/notifications',          'routes/notifications.php'],
    ['POST', '/notifications/{id}/read','routes/notifications.php'],

    // Counts
    ['GET',  '/counts/pending',         'routes/counts.php'],

    // Dashboard & Reports
    ['GET',  '/dashboard/stats',        'routes/dashboard.php'],
    ['GET',  '/reports/weekly',         'routes/reports.php'],
    ['POST', '/reports/generate',       'routes/reports.php'],

    // Upload
    ['POST', '/upload',                 'routes/upload.php'],

    // Email Verification & Password Reset
    ['POST', '/auth/send-verification',    'routes/email.php'],
    ['POST', '/auth/verify-email-code',    'routes/email.php'],
    ['GET',  '/auth/verify-email-link',    'routes/email.php'],
    ['POST', '/auth/forgot-password',      'routes/email.php'],
    ['POST', '/auth/reset-password-code',  'routes/email.php'],
    ['GET',  '/auth/reset-password-link',  'routes/email.php'],
    ['POST', '/auth/reset-password-link',  'routes/email.php'],

    // Verification / Onboarding
    ['GET',  '/verification/status',              'routes/verification.php'],
    ['POST', '/verification/documents',           'routes/verification.php'],
    ['DELETE','/verification/documents/{id}',     'routes/verification.php'],
    ['POST', '/verification/complete-phase',      'routes/verification.php'],
    ['GET',  '/verification/users/{id}',          'routes/verification.php'],

    // Assistants
    ['GET',  '/assistants',             'routes/assistants.php'],
    ['POST', '/assistants',             'routes/assistants.php'],
    ['PUT',  '/assistants/{id}',        'routes/assistants.php'],
    ['DELETE','/assistants/{id}',       'routes/assistants.php'],
];

// Match route
$matched = false;
foreach ($routes as [$routeMethod, $pattern, $handler]) {
    $regex = preg_replace('/\{[^}]+\}/', '([^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    if ($method === $routeMethod && preg_match($regex, $uri, $matches)) {
        array_shift($matches);
        $GLOBALS['route_params'] = $matches;
        $GLOBALS['route_uri']    = $uri;
        $GLOBALS['route_method'] = $method;
        require __DIR__ . '/' . $handler;
        $matched = true;
        break;
    }
}

if (!$matched) {
    jsonResponse(['error' => 'Route not found', 'uri' => $uri], 404);
}
