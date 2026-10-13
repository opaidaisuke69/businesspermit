<?php
// ============================================================
// Vendor Locations Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /locations — public
if ($method === 'GET' && $uri === '/locations') {
    $status   = $_GET['status'] ?? null;
    $areaType = $_GET['area_type'] ?? null;

    $where = ['1=1']; $binds = [];
    if ($status)   { $where[] = 'status = ?';    $binds[] = $status; }
    if ($areaType) { $where[] = 'area_type = ?'; $binds[] = $areaType; }

    $stmt = $db->prepare('SELECT * FROM vendor_locations WHERE ' . implode(' AND ', $where) . ' ORDER BY slot_number');
    $stmt->execute($binds);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

// POST /locations — admin only
if ($method === 'POST' && $uri === '/locations') {
    $admin = requireAdmin();
    $body  = getBody();
    $err   = validateRequired($body, ['name','latitude','longitude']);
    if ($err) jsonResponse(['error' => $err], 422);

    $stmt = $db->prepare('INSERT INTO vendor_locations (name,description,latitude,longitude,area_type,slot_number,status,created_by) VALUES (?,?,?,?,?,?,?,?)');
    $stmt->execute([
        sanitize($body['name']),
        sanitize($body['description'] ?? ''),
        (float)$body['latitude'],
        (float)$body['longitude'],
        in_array($body['area_type'] ?? '', ['saturday_market']) ? $body['area_type'] : 'saturday_market',
        sanitize($body['slot_number'] ?? ''),
        in_array($body['status'] ?? '', ['available','occupied','inactive']) ? $body['status'] : 'available',
        $admin['sub'],
    ]);

    $db->prepare('INSERT INTO audit_logs (admin_id,action,target_table,target_id) VALUES (?,?,?,?)')
       ->execute([$admin['sub'], 'create_location', 'vendor_locations', $db->lastInsertId()]);

    jsonResponse(['message' => 'Location created', 'id' => $db->lastInsertId()], 201);
}

// PUT /locations/{id} — admin only
if ($method === 'PUT' && preg_match('#^/locations/(\d+)$#', $uri, $m)) {
    $admin = requireAdmin();
    $id    = (int)$m[1];
    $body  = getBody();

    $allowed = ['name','description','latitude','longitude','area_type','slot_number','status'];
    $sets = []; $binds = [];
    foreach ($allowed as $f) {
        if (isset($body[$f])) { $sets[] = "$f = ?"; $binds[] = $body[$f]; }
    }
    if (empty($sets)) jsonResponse(['error' => 'Nothing to update'], 422);
    $binds[] = $id;
    $db->prepare('UPDATE vendor_locations SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($binds);
    jsonResponse(['message' => 'Location updated']);
}

// DELETE /locations/{id} — admin only
if ($method === 'DELETE' && preg_match('#^/locations/(\d+)$#', $uri, $m)) {
    $admin = requireAdmin();
    $id    = (int)$m[1];
    $db->prepare('UPDATE vendor_locations SET status="inactive" WHERE id=?')->execute([$id]);
    jsonResponse(['message' => 'Location deactivated']);
}
