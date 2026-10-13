<?php
// ============================================================
// Renewal Routes
// ============================================================

$payload = requireAuth();
$db = getDB();

// GET /renewals/check-eligibility
// Check if user has permits eligible for renewal (2 months before expiry)
if ($method === 'GET' && $uri === '/renewals/check-eligibility') {
    if ($payload['role'] !== 'user') jsonResponse(['error' => 'Forbidden'], 403);
    
    $stmt = $db->prepare("
        SELECT p.*, a.business_name, a.business_type, a.products_sold, a.preferred_location_id
        FROM permits p
        JOIN applications a ON a.id = p.application_id
        WHERE p.user_id = ? 
          AND p.status = 'active'
          AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH)
          AND p.expiry_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
          AND NOT EXISTS (
              SELECT 1 FROM applications 
              WHERE type = 'renewal' 
                AND renewed_from_permit_id = p.id 
                AND status IN ('pending', 'under_review', 'approved')
          )
        ORDER BY p.expiry_date ASC
    ");
    $stmt->execute([$payload['sub']]);
    $eligible = $stmt->fetchAll();
    
    jsonResponse(['eligible_permits' => $eligible]);
}

// POST /renewals/create
// Create a renewal application from an existing permit
if ($method === 'POST' && $uri === '/renewals/create') {
    if ($payload['role'] !== 'user') jsonResponse(['error' => 'Forbidden'], 403);
    
    $body = getBody();
    $err = validateRequired($body, ['permit_id', 'business_name', 'business_type', 'products_sold']);
    if ($err) jsonResponse(['error' => $err], 422);
    
    // Verify permit ownership and eligibility
    $stmt = $db->prepare("
        SELECT p.*, a.application_number as old_app_number, a.preferred_location_id
        FROM permits p
        JOIN applications a ON a.id = p.application_id
        WHERE p.id = ? 
          AND p.user_id = ? 
          AND p.status = 'active'
          AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH)
          AND p.expiry_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
    ");
    $stmt->execute([(int)$body['permit_id'], $payload['sub']]);
    $permit = $stmt->fetch();
    
    if (!$permit) {
        jsonResponse(['error' => 'Permit not found or not eligible for renewal'], 404);
    }
    
    // Use the same location as the old permit
    $locationId = $permit['preferred_location_id'];
    
    // Check if renewal already exists
    $check = $db->prepare("
        SELECT id FROM applications 
        WHERE type = 'renewal' 
          AND renewed_from_permit_id = ? 
          AND status IN ('pending', 'under_review', 'approved')
    ");
    $check->execute([(int)$body['permit_id']]);
    if ($check->fetch()) {
        jsonResponse(['error' => 'A renewal application already exists for this permit'], 409);
    }
    
    // Generate new application number
    $year = date('Y');
    $stmt = $db->query("SELECT application_number FROM applications WHERE application_number LIKE 'BPA-$year-%' ORDER BY id DESC LIMIT 1");
    $last = $stmt->fetch();
    $seq = 1;
    if ($last) {
        preg_match('/BPA-\d{4}-(\d+)/', $last['application_number'], $m);
        $seq = isset($m[1]) ? (int)$m[1] + 1 : 1;
    }
    $appNum = sprintf('BPA-%s-%04d', $year, $seq);
    
    // Create renewal application
    $stmt = $db->prepare("
        INSERT INTO applications (
            user_id, application_number, type, renewed_from_permit_id,
            business_name, business_type, products_sold, preferred_location_id, 
            num_papag, num_employees, status
        ) VALUES (?, ?, 'renewal', ?, ?, ?, ?, ?, ?, ?, 'pending')
    ");
    $stmt->execute([
        $payload['sub'],
        $appNum,
        (int)$body['permit_id'],
        sanitize($body['business_name']),
        sanitize($body['business_type']),
        sanitize($body['products_sold']),
        $locationId, // Use location from old permit
        isset($body['num_papag']) ? (int)$body['num_papag'] : 0,
        isset($body['num_employees']) ? (int)$body['num_employees'] : 0,
    ]);
    
    $appId = $db->lastInsertId();
    
    // Notify admins
    $db->prepare('INSERT INTO notifications (admin_id,title,message,type) SELECT id,?,?,? FROM admins WHERE is_active=1')
       ->execute([
           "Renewal Application Submitted",
           "Renewal application $appNum has been submitted (from permit {$permit['permit_number']}).",
           "application"
       ]);
    
    jsonResponse([
        'message' => 'Renewal application created successfully',
        'application_id' => $appId,
        'application_number' => $appNum
    ], 201);
}
