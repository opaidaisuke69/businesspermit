<?php
// ============================================================
// PayMongo Payment Helper
// ============================================================

function paymongo_curl(string $url, string $method, array $data = []): array {
    $secretKey = $_ENV['PAYMONGO_SECRET'] ?? '';
    if (empty($secretKey)) throw new Exception('PayMongo secret key not configured');

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Basic ' . base64_encode($secretKey . ':'),
        'Content-Type: application/json',
        'Accept: application/json',
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($response, true);

    if ($httpCode < 200 || $httpCode >= 300) {
        $detail = $decoded['errors'][0]['detail'] ?? $response;
        throw new Exception('PayMongo API Error (' . $httpCode . '): ' . $detail);
    }

    return $decoded;
}

// Create a Payment Link — returns the full PayMongo response
function createPayMongoPaymentLink(float $amount, string $description, string $remarks): array {
    return paymongo_curl('https://api.paymongo.com/v1/links', 'POST', [
        'data' => [
            'attributes' => [
                'amount'      => (int)($amount * 100),
                'currency'    => 'PHP',
                'description' => $description,
                'remarks'     => $remarks,
            ],
        ],
    ]);
}

// Retrieve a Payment Link by ID
function retrievePaymentLink(string $linkId): array {
    return paymongo_curl("https://api.paymongo.com/v1/links/{$linkId}", 'GET');
}

// Verify webhook signature
function verifyWebhookSignature(string $payload, string $signature): bool {
    $webhookSecret = $_ENV['PAYMONGO_WEBHOOK'] ?? '';
    if (empty($webhookSecret)) return false;
    $computed = hash_hmac('sha256', $payload, $webhookSecret);
    return hash_equals($signature, $computed);
}
