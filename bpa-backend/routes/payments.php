<?php
// ============================================================
// Payments Routes
// ============================================================

require_once __DIR__ . '/../helpers/receipt_html.php';

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// ── Helper: calculate total fee from permit_fees + num_papag ──
function _calculateFees(PDO $db, int $numPapag): array {
    $stmt = $db->query('SELECT fee_key, label, amount FROM permit_fees ORDER BY id');
    $fees = $stmt->fetchAll();

    $breakdown = [];
    $total     = 0.0;

    foreach ($fees as $f) {
        $amt = (float)$f['amount'];
        if ($f['fee_key'] === 'occupational_tax') {
            $qty = max(1, $numPapag);
            $amt = $amt * $qty;
            $breakdown[] = [
                'key'    => $f['fee_key'],
                'label'  => $f['label'],
                'unit'   => (float)$f['amount'],
                'qty'    => $qty,
                'amount' => $amt,
            ];
        } else {
            $breakdown[] = [
                'key'    => $f['fee_key'],
                'label'  => $f['label'],
                'amount' => $amt,
            ];
        }
        $total += $amt;
    }

    return ['breakdown' => $breakdown, 'total' => $total];
}

// GET /payments/{id}/receipt — download official receipt HTML
if ($method === 'GET' && preg_match('#^/payments/(\d+)/receipt$#', $uri, $m)) {
    $payload = requireAuth();
    $id      = (int)$m[1];

    $stmt = $db->prepare("SELECT p.*, a.application_number, a.business_name, a.num_papag,
        u.first_name, u.last_name, u.middle_name, u.email
        FROM payments p
        JOIN applications a ON a.id = p.application_id
        JOIN users u ON u.id = p.user_id
        WHERE p.id = ?");
    $stmt->execute([$id]);
    $pay = $stmt->fetch();
    if (!$pay) jsonResponse(['error' => 'Not found'], 404);

    // Only verified payments have a receipt
    if ($pay['status'] !== 'verified')
        jsonResponse(['error' => 'Receipt is only available for verified payments.'], 422);

    // Auth check — user can only see their own
    if ($payload['role'] === 'user' && $pay['user_id'] != $payload['sub'])
        jsonResponse(['error' => 'Forbidden'], 403);

    $user = [
        'first_name'  => $pay['first_name'],
        'last_name'   => $pay['last_name'],
        'middle_name' => $pay['middle_name'] ?? '',
    ];
    $app = [
        'application_number' => $pay['application_number'],
        'business_name'      => $pay['business_name'],
    ];

    header('Content-Type: text/html; charset=utf-8');
    echo generateReceiptHTML($pay, $user, $app);
    exit;
}

// GET /payments/{id} — get single payment details
if ($method === 'GET' && preg_match('#^/payments/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $id      = (int)$m[1];

    $stmt = $db->prepare("SELECT p.*, a.application_number, a.business_name, a.num_papag,
        CONCAT(u.first_name,' ',u.last_name) AS payer_name, u.email AS payer_email
        FROM payments p
        JOIN applications a ON a.id = p.application_id
        JOIN users u ON u.id = p.user_id
        WHERE p.id = ?");
    $stmt->execute([$id]);
    $payment = $stmt->fetch();
    
    if (!$payment) {
        jsonResponse(['error' => 'Payment not found'], 404);
    }

    // Auth check — user can only see their own payments
    if ($payload['role'] === 'user' && $payment['user_id'] != $payload['sub']) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    // Add due date (30 days from creation for pending payments)
    if ($payment['status'] === 'pending') {
        $payment['due_date'] = date('Y-m-d', strtotime($payment['created_at'] . ' +30 days'));
    }

    jsonResponse($payment);
}

// GET /payments/fees-preview?num_papag=N — show fee breakdown before submitting
if ($method === 'GET' && $uri === '/payments/fees-preview') {
    requireAuth();
    $numPapag = max(0, (int)($_GET['num_papag'] ?? 1));
    $result   = _calculateFees($db, $numPapag);
    jsonResponse($result);
}

// GET /payments
if ($method === 'GET' && $uri === '/payments') {
    $payload = requireAuth();
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $limit   = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset  = ($page - 1) * $limit;
    $status  = $_GET['status'] ?? null;
    $search  = $_GET['search'] ?? null;

    $where = ['1=1']; $binds = [];
    if ($payload['role'] === 'user') { $where[] = 'p.user_id = ?'; $binds[] = $payload['sub']; }
    if ($status) { $where[] = 'p.status = ?'; $binds[] = $status; }
    if ($search) {
        $where[] = '(a.application_number LIKE ? OR CONCAT(u.first_name," ",u.last_name) LIKE ?)';
        $s = "%$search%"; $binds = array_merge($binds, [$s,$s]);
    }

    $sql = "SELECT p.*,
            a.application_number, a.business_name, a.num_papag,
            CONCAT(u.first_name,' ',u.last_name) AS payer_name, u.email AS payer_email,
            MAX(CASE WHEN pm.permit_type = 'mayors_permit'   THEN pm.permit_number END) AS mayors_permit_number,
            MAX(CASE WHEN pm.permit_type = 'sanitary_permit' THEN pm.permit_number END) AS sanitary_permit_number
            FROM payments p
            JOIN applications a ON a.id = p.application_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN permits pm ON pm.application_id = p.application_id
            WHERE " . implode(' AND ', $where) . "
            GROUP BY p.id
            ORDER BY p.created_at DESC LIMIT $limit OFFSET $offset";
    $stmt = $db->prepare($sql);
    $stmt->execute($binds);
    $payments = $stmt->fetchAll();

    $countStmt = $db->prepare('SELECT COUNT(*) FROM payments p JOIN applications a ON a.id=p.application_id JOIN users u ON u.id=p.user_id WHERE ' . implode(' AND ', $where));
    $countStmt->execute($binds);
    $total = $countStmt->fetchColumn();

    jsonResponse(['data' => $payments, 'total' => $total, 'page' => $page, 'limit' => $limit]);
}

// POST /payments — peddler submits payment (cash/e-wallet/qrph)
if ($method === 'POST' && $uri === '/payments') {
    $payload = requireAuth();
    if ($payload['role'] !== 'user') jsonResponse(['error' => 'Forbidden'], 403);

    $body = getBody();
    $err  = validateRequired($body, ['application_id', 'payment_method_type']);
    if ($err) jsonResponse(['error' => $err], 422);

    $validMethods = ['cash','check','gcash','paymaya','grab_pay','card','qrph','other'];
    if (!in_array($body['payment_method_type'], $validMethods))
        jsonResponse(['error' => 'Invalid payment method. Use: ' . implode(', ', $validMethods)], 422);

    $appId = (int)$body['application_id'];
    $stmt  = $db->prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?');
    $stmt->execute([$appId, $payload['sub']]);
    $app = $stmt->fetch();
    if (!$app) jsonResponse(['error' => 'Application not found'], 404);

    // Application must be approved before payment
    if ($app['status'] !== 'approved')
        jsonResponse(['error' => 'Your application must be approved before submitting payment.'], 422);

    // Check for existing non-rejected payment
    $pStmt = $db->prepare("SELECT id, status FROM payments WHERE application_id = ? AND status NOT IN ('rejected','failed')");
    $pStmt->execute([$appId]);
    $existing = $pStmt->fetch();
    if ($existing) jsonResponse(['error' => 'A payment already exists for this application.'], 409);

    // Calculate fees
    $numPapag = (int)($app['num_papag'] ?? 1);
    $feeData  = _calculateFees($db, $numPapag);
    $total    = $feeData['total'];

    // Determine payment gateway
    $paymentGateway = null;
    if (in_array($body['payment_method_type'], ['gcash', 'paymaya', 'grab_pay', 'card', 'qrph'])) {
        $paymentGateway = $body['payment_gateway'] ?? 'paymongo';
    }

    $stmt = $db->prepare('INSERT INTO payments (application_id,user_id,amount,fee_breakdown,payment_method_type,payment_method,payment_gateway,status) VALUES (?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $appId,
        $payload['sub'],
        $total,
        json_encode($feeData['breakdown']),
        $body['payment_method_type'],
        sanitize($body['payment_method_type']),
        $paymentGateway,
        'pending',
    ]);
    $payId = $db->lastInsertId();

    // Notify admins
    $db->prepare('INSERT INTO notifications (admin_id,title,message,type) SELECT id,?,?,? FROM admins WHERE is_active=1')
       ->execute([
           'Payment Submitted',
           "Payment of ₱" . number_format($total, 2) . " submitted for application {$app['application_number']} via {$body['payment_method_type']}.",
           'payment',
       ]);

    jsonResponse([
        'id'          => $payId,
        'payment_id'  => $payId,
        'amount'      => $total,
        'breakdown'   => $feeData['breakdown'],
        'method'      => $body['payment_method_type'],
        'gateway'     => $paymentGateway,
        'message'     => 'Payment submitted. Awaiting admin verification.',
    ], 201);
}

// POST /payments/{id}/approve — admin approves payment → generates permits
if ($method === 'POST' && preg_match('#^/payments/(\d+)/approve$#', $uri, $m)) {
    $admin = requireAdmin();
    $id    = (int)$m[1];

    $stmt = $db->prepare('SELECT p.*, a.user_id AS app_user_id, a.application_number, a.business_name, a.preferred_location_id, a.num_papag, a.type, a.renewed_from_permit_id FROM payments p JOIN applications a ON a.id=p.application_id WHERE p.id = ?');
    $stmt->execute([$id]);
    $pay = $stmt->fetch();
    if (!$pay) jsonResponse(['error' => 'Not found'], 404);

    if (!in_array($pay['status'], ['pending']))
        jsonResponse(['error' => 'Payment is not pending.'], 422);

    // Mark payment verified
    $db->prepare("UPDATE payments SET status='verified', verified_by=?, verified_at=NOW() WHERE id=?")
       ->execute([$admin['sub'], $id]);

    // Determine expiry date based on application type
    $issued = date('Y-m-d');
    $expiry = date('Y-m-d', strtotime('+1 year'));
    
    if ($pay['type'] === 'renewal' && $pay['renewed_from_permit_id']) {
        // For renewals, extend from old permit's expiry date
        $oldPermitStmt = $db->prepare('SELECT expiry_date FROM permits WHERE id = ? LIMIT 1');
        $oldPermitStmt->execute([$pay['renewed_from_permit_id']]);
        $oldPermit = $oldPermitStmt->fetch();
        
        if ($oldPermit) {
            $oldExpiry = strtotime($oldPermit['expiry_date']);
            $today = strtotime(date('Y-m-d'));
            
            // If old permit already expired, extend from today; otherwise extend from old expiry
            $baseDate = ($oldExpiry < $today) ? $today : $oldExpiry;
            $expiry = date('Y-m-d', strtotime('+1 year', $baseDate));
        }
    }

    // Generate Mayor's Permit
    $mppNum = 'MPP-' . date('Y') . '-' . strtoupper(substr(uniqid(), -6));

    // Get business_name from application
    $appStmt = $db->prepare('SELECT * FROM applications WHERE id = ?');
    $appStmt->execute([$pay['application_id']]);
    $app = $appStmt->fetch();

    $db->prepare("INSERT INTO permits (application_id,user_id,permit_number,permit_type,business_name,issued_date,expiry_date,issued_by,renewed_from_permit_id)
                  VALUES (?,?,?,'mayors_permit',?,?,?,?,?)
                  ON DUPLICATE KEY UPDATE permit_number=VALUES(permit_number), issued_date=VALUES(issued_date), expiry_date=VALUES(expiry_date), issued_by=VALUES(issued_by)")
       ->execute([$pay['application_id'], $pay['app_user_id'], $mppNum, $app['business_name'], $issued, $expiry, $admin['sub'], $pay['renewed_from_permit_id']]);

    // Generate Sanitary Permit
    $spNum = 'SP-' . date('Y') . '-' . strtoupper(substr(uniqid(), -6));
    $db->prepare("INSERT INTO permits (application_id,user_id,permit_number,permit_type,business_name,issued_date,expiry_date,issued_by,renewed_from_permit_id)
                  VALUES (?,?,?,'sanitary_permit',?,?,?,?,?)
                  ON DUPLICATE KEY UPDATE permit_number=VALUES(permit_number), issued_date=VALUES(issued_date), expiry_date=VALUES(expiry_date), issued_by=VALUES(issued_by)")
       ->execute([$pay['application_id'], $pay['app_user_id'], $spNum, $app['business_name'], $issued, $expiry, $admin['sub'], $pay['renewed_from_permit_id']]);

    // Update location if assigned
    if ($app['preferred_location_id']) {
        $db->prepare("UPDATE vendor_locations SET status='occupied' WHERE id=?")
           ->execute([$app['preferred_location_id']]);
    }

    // Notify user
    $renewalText = ($pay['type'] === 'renewal') ? ' (Renewal)' : '';
    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"permit")')
       ->execute([
           $pay['app_user_id'],
           'Payment Approved — Permits Issued!',
           "Your payment has been verified. Your Mayor's Permit ($mppNum) and Sanitary Permit ($spNum) are now available$renewalText. Go to Profile → My Permits to download.",
       ]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'approve_payment', 'payments', $id, json_encode(['mpp' => $mppNum, 'sp' => $spNum, 'type' => $pay['type']])]);

    jsonResponse([
        'message'          => 'Payment approved. Permits issued.',
        'mayors_permit'    => $mppNum,
        'sanitary_permit'  => $spNum,
    ]);
}

// POST /payments/{id}/reject — admin rejects payment
if ($method === 'POST' && preg_match('#^/payments/(\d+)/reject$#', $uri, $m)) {
    $admin  = requireAdmin();
    $id     = (int)$m[1];
    $body   = getBody();
    $reason = sanitize($body['reason'] ?? 'Payment rejected by admin.');

    $stmt = $db->prepare('SELECT p.*, a.application_number FROM payments p JOIN applications a ON a.id=p.application_id WHERE p.id = ?');
    $stmt->execute([$id]);
    $pay = $stmt->fetch();
    if (!$pay) jsonResponse(['error' => 'Not found'], 404);

    $db->prepare("UPDATE payments SET status='rejected', rejection_reason=?, verified_by=?, verified_at=NOW() WHERE id=?")
       ->execute([$reason, $admin['sub'], $id]);

    // Notify user — they can resubmit payment
    $db->prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,"payment")')
       ->execute([
           $pay['user_id'],
           'Payment Rejected',
           "Your payment for application {$pay['application_number']} was rejected. Reason: $reason. Please resubmit your payment.",
       ]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id,details) VALUES (?,?,?,?,?)')
       ->execute([$admin['sub'], 'reject_payment', 'payments', $id, json_encode(['reason' => $reason])]);

    jsonResponse(['message' => 'Payment rejected. Peddler notified.']);
}

// POST /payments/{id}/verify — kept for backward compat (alias for approve)
if ($method === 'POST' && preg_match('#^/payments/(\d+)/verify$#', $uri, $m)) {
    // Redirect to approve logic
    $GLOBALS['route_uri'] = '/payments/' . $m[1] . '/approve';
    // Re-run this file
    require __FILE__;
    exit;
}
