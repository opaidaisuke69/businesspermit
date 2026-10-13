<?php
// ============================================================
// PayMongo Payment Routes
// ============================================================

require_once __DIR__ . '/../helpers/paymongo.php';

$uri      = $GLOBALS['route_uri'];
$method   = $GLOBALS['route_method'];
$endpoint = '';
if (preg_match('#^/paymongo/(.+)$#', $uri, $m)) {
    $endpoint = $m[1];
}

// ── Helper: calculate fees ────────────────────────────────────
function _calcFees(PDO $db, int $numPapag): array {
    $rows  = $db->query('SELECT fee_key, label, amount FROM permit_fees ORDER BY id')->fetchAll();
    $total = 0; $breakdown = [];
    foreach ($rows as $f) {
        $amt = (float)$f['amount'];
        $row = ['key' => $f['fee_key'], 'label' => $f['label'], 'amount' => $amt];
        if ($f['fee_key'] === 'occupational_tax') {
            $qty = max(1, $numPapag); $amt *= $qty;
            $row['unit'] = (float)$f['amount']; $row['qty'] = $qty; $row['amount'] = $amt;
        }
        $breakdown[] = $row; $total += $amt;
    }
    return ['breakdown' => $breakdown, 'total' => $total];
}

// ── POST /paymongo/create-payment-link ───────────────────────
// Creates a PayMongo Payment Link. Does NOT insert a payment record.
// The record is only inserted in link-status when PayMongo confirms paid.
if ($method === 'POST' && $endpoint === 'create-payment-link') {
    $payload = requireAuth();
    $input   = json_decode(file_get_contents('php://input'), true);
    $appId   = (int)($input['application_id'] ?? 0);

    if (!$appId) jsonResponse(['error' => 'application_id is required'], 400);

    try {
        $db   = getDB();
        $stmt = $db->prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?");
        $stmt->execute([$appId, $payload['sub']]);
        $app  = $stmt->fetch();

        if (!$app) jsonResponse(['error' => 'Application not found'], 404);
        if ($app['status'] !== 'approved') jsonResponse(['error' => 'Application must be approved before payment'], 400);

        // Block if already paid
        $stmt = $db->prepare("SELECT id FROM payments WHERE application_id = ? AND status IN ('paid','verified')");
        $stmt->execute([$appId]);
        if ($stmt->fetch()) jsonResponse(['error' => 'This application has already been paid'], 409);

        $fees        = _calcFees($db, (int)($app['num_papag'] ?? 1));
        $link        = createPayMongoPaymentLink($fees['total'], 'Permit Payment - ' . $app['application_number'], $app['application_number']);
        $linkId      = $link['data']['id'];
        $checkoutUrl = $link['data']['attributes']['checkout_url'] ?? null;

        if (!$checkoutUrl) jsonResponse(['error' => 'PayMongo did not return a checkout URL'], 500);

        jsonResponse(['link_id' => $linkId, 'checkout_url' => $checkoutUrl, 'amount' => $fees['total']]);

    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

// ── GET /paymongo/link-status ─────────────────────────────────
// Checks PayMongo link status. Inserts payment record ONLY when status = 'paid'.
if ($method === 'GET' && $endpoint === 'link-status') {
    $payload = requireAuth();
    $linkId  = $_GET['link_id'] ?? null;
    $appId   = (int)($_GET['application_id'] ?? 0);

    if (!$linkId || !$appId) jsonResponse(['error' => 'link_id and application_id are required'], 400);

    try {
        $link   = retrievePaymentLink($linkId);
        $status = $link['data']['attributes']['status'];

        if ($status === 'paid') {
            $db = getDB();

            // Only insert once
            $stmt = $db->prepare("SELECT id FROM payments WHERE application_id = ? AND status IN ('paid','verified')");
            $stmt->execute([$appId]);
            if (!$stmt->fetch()) {
                $stmt = $db->prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?");
                $stmt->execute([$appId, $payload['sub']]);
                $app = $stmt->fetch();

                if ($app) {
                    $fees = _calcFees($db, (int)($app['num_papag'] ?? 1));
                    $db->prepare("
                        INSERT INTO payments
                            (application_id, user_id, amount, fee_breakdown, payment_method, payment_method_type, payment_gateway, paymongo_link_id, status, paid_at)
                        VALUES (?, ?, ?, ?, 'qrph', 'qrph', 'paymongo', ?, 'paid', NOW())
                    ")->execute([$appId, $payload['sub'], $fees['total'], json_encode($fees['breakdown']), $linkId]);

                    $db->prepare("INSERT INTO notifications (admin_id,title,message,type) SELECT id,?,?,? FROM admins WHERE is_active=1")
                       ->execute(['QR Ph Payment Received', "Payment of ₱" . number_format($fees['total'], 2) . " received for {$app['application_number']}.", 'payment']);
                }
            }
        }

        jsonResponse(['status' => $status]);

    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

// ── POST /paymongo/webhook ────────────────────────────────────
if ($method === 'POST' && $endpoint === 'webhook') {
    $raw       = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';

    if (!verifyWebhookSignature($raw, $signature)) {
        http_response_code(401); exit('Unauthorized');
    }

    $event = json_decode($raw, true);
    if (($event['data']['attributes']['type'] ?? '') === 'link.payment.paid') {
        try {
            $db     = getDB();
            $linkId = $event['data']['attributes']['data']['id'] ?? null;
            if ($linkId) {
                $stmt = $db->prepare("SELECT * FROM payments WHERE paymongo_link_id = ?");
                $stmt->execute([$linkId]);
                $pay = $stmt->fetch();
                if ($pay && $pay['status'] === 'pending') {
                    $db->prepare("UPDATE payments SET status='paid', paid_at=NOW() WHERE id=?")
                       ->execute([$pay['id']]);
                }
            }
        } catch (Exception $e) {
            error_log('PayMongo webhook error: ' . $e->getMessage());
        }
    }

    http_response_code(200); echo 'OK';
}

// ── GET /paymongo/test ────────────────────────────────────────
if ($method === 'GET' && $endpoint === 'test') {
    jsonResponse(['status' => 'ok', 'timestamp' => date('Y-m-d H:i:s')]);
}
