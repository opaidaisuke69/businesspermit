<?php
// ============================================================
// Verification / Onboarding Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// ── GET /verification/status  ─────────────────────────────
// Returns the user's full onboarding status + uploaded docs
if ($method === 'GET' && $uri === '/verification/status') {
    $payload = requireAuth();
    $uid = (int)$payload['sub'];

    $stmt = $db->prepare('SELECT onboarding_step, onboarding_completed, verification_status FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $user = $stmt->fetch();

    $docs = $db->prepare('SELECT id, doc_category, id_type, file_url, original_name, uploaded_at FROM user_documents WHERE user_id = ? ORDER BY uploaded_at');
    $docs->execute([$uid]);
    $documents = $docs->fetchAll();

    $asst = $db->prepare('SELECT id, first_name, last_name, relationship, phone, address, photo_url FROM user_assistants WHERE user_id = ?');
    $asst->execute([$uid]);
    $assistants = $asst->fetchAll();

    // Derive what's complete
    $hasPrimary   = count(array_filter($documents, fn($d) => $d['doc_category'] === 'primary_id'))  > 0;
    $hasSecondary = count(array_filter($documents, fn($d) => $d['doc_category'] === 'secondary_id')) > 0;
    $hasBarangay  = count(array_filter($documents, fn($d) => $d['doc_category'] === 'barangay_clearance')) > 0;
    $hasSelfie    = count(array_filter($documents, fn($d) => $d['doc_category'] === 'selfie')) > 0;

    jsonResponse([
        'onboarding_step'      => (int)$user['onboarding_step'],
        'onboarding_completed' => (bool)$user['onboarding_completed'],
        'verification_status'  => $user['verification_status'],
        'phase1_complete'      => ($hasPrimary || $hasSecondary) && $hasBarangay,
        'phase2_complete'      => count($assistants) > 0,
        'phase3_complete'      => $hasSelfie,
        'has_primary_id'       => $hasPrimary,
        'has_secondary_id'     => $hasSecondary,
        'has_barangay'         => $hasBarangay,
        'has_selfie'           => $hasSelfie,
        'documents'            => $documents,
        'assistants'           => $assistants,
    ]);
}

// ── POST /verification/documents  ────────────────────────
// Upload a document (multipart handled by upload.php, this saves the record)
if ($method === 'POST' && $uri === '/verification/documents') {
    $payload = requireAuth();
    $uid  = (int)$payload['sub'];
    $body = getBody();

    $err = validateRequired($body, ['doc_category', 'file_url']);
    if ($err) jsonResponse(['error' => $err], 422);

    $validCats = ['primary_id','secondary_id','barangay_clearance','old_business_permit','selfie','product_photo'];
    if (!in_array($body['doc_category'], $validCats))
        jsonResponse(['error' => 'Invalid document category'], 422);

    // Primary ID: 1 ID type = 2 entries (front + back)
    if ($body['doc_category'] === 'primary_id') {
        // Count distinct base ID types (strip " (Front)" / " (Back)" suffix)
        $chk = $db->prepare("SELECT id_type FROM user_documents WHERE user_id=? AND doc_category='primary_id'");
        $chk->execute([$uid]);
        $existing = $chk->fetchAll(PDO::FETCH_COLUMN);
        $baseTypes = array_unique(array_map(fn($t) => preg_replace('/\s*\((Front|Back)\)$/i', '', $t), $existing));
        $incomingBase = preg_replace('/\s*\((Front|Back)\)$/i', '', $body['id_type'] ?? '');
        // Allow if same base type (adding back to existing front) or no primary yet
        if (count($baseTypes) >= 1 && !in_array($incomingBase, $baseTypes)) {
            jsonResponse(['error' => 'Only 1 Primary ID type is allowed. Remove the existing one first.'], 409);
        }
    }

    // Secondary ID: max 2 ID types = up to 4 entries (each has front + back)
    if ($body['doc_category'] === 'secondary_id') {
        $chk = $db->prepare("SELECT id_type FROM user_documents WHERE user_id=? AND doc_category='secondary_id'");
        $chk->execute([$uid]);
        $existing = $chk->fetchAll(PDO::FETCH_COLUMN);
        $baseTypes = array_unique(array_map(fn($t) => preg_replace('/\s*\((Front|Back)\)$/i', '', $t), $existing));
        $incomingBase = preg_replace('/\s*\((Front|Back)\)$/i', '', $body['id_type'] ?? '');
        if (count($baseTypes) >= 2 && !in_array($incomingBase, $baseTypes)) {
            jsonResponse(['error' => 'Maximum 2 Secondary ID types allowed.'], 409);
        }
    }

    $stmt = $db->prepare('INSERT INTO user_documents (user_id, doc_category, id_type, file_url, original_name) VALUES (?,?,?,?,?)');
    $stmt->execute([
        $uid,
        $body['doc_category'],
        sanitize($body['id_type'] ?? ''),
        sanitize($body['file_url']),
        sanitize($body['original_name'] ?? ''),
    ]);

    // Update onboarding step
    _updateOnboardingStep($db, $uid);

    jsonResponse(['message' => 'Document saved', 'id' => $db->lastInsertId()], 201);
}

// ── DELETE /verification/documents/{id}  ─────────────────
if ($method === 'DELETE' && preg_match('#^/verification/documents/(\d+)$#', $uri, $m)) {
    $payload = requireAuth();
    $uid = (int)$payload['sub'];
    $id  = (int)$m[1];

    $stmt = $db->prepare('SELECT user_id, file_url, doc_category, id_type FROM user_documents WHERE id = ?');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc || $doc['user_id'] != $uid) jsonResponse(['error' => 'Not found'], 404);

    // Delete the physical file
    _deleteUploadedFile($doc['file_url']);

    // If this is a primary/secondary ID, also delete the paired front/back sibling
    $baseType = preg_replace('/\s*\((Front|Back)\)$/i', '', $doc['id_type'] ?? '');
    if (in_array($doc['doc_category'], ['primary_id', 'secondary_id']) && $baseType) {
        $siblings = $db->prepare(
            "SELECT id, file_url FROM user_documents
             WHERE user_id=? AND doc_category=? AND id != ?
             AND (id_type=? OR id_type=? OR id_type=?)"
        );
        $siblings->execute([
            $uid, $doc['doc_category'], $id,
            $baseType,
            $baseType . ' (Front)',
            $baseType . ' (Back)',
        ]);
        foreach ($siblings->fetchAll() as $sib) {
            _deleteUploadedFile($sib['file_url']);
            $db->prepare('DELETE FROM user_documents WHERE id = ?')->execute([$sib['id']]);
        }
    }

    $db->prepare('DELETE FROM user_documents WHERE id = ?')->execute([$id]);
    _updateOnboardingStep($db, $uid);
    jsonResponse(['message' => 'Document removed']);
}

// ── Helper: delete physical upload file ──────────────────
function _deleteUploadedFile(string $fileUrl): void {
    if (empty($fileUrl)) return;
    // Extract filename from URL and build local path
    $filename = basename(parse_url($fileUrl, PHP_URL_PATH));
    if (empty($filename)) return;
    $dir  = !empty(UPLOAD_DIR) ? rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR : __DIR__ . '/../uploads/';
    $path = $dir . $filename;
    if (file_exists($path)) {
        @unlink($path);
    }
}

// ── POST /verification/complete-phase  ───────────────────
// Mark a phase as done and advance step
if ($method === 'POST' && $uri === '/verification/complete-phase') {
    $payload = requireAuth();
    $uid  = (int)$payload['sub'];
    $body = getBody();
    $phase = (int)($body['phase'] ?? 0);
    if ($phase < 1 || $phase > 3) jsonResponse(['error' => 'Invalid phase'], 422);

    $db->prepare('UPDATE users SET onboarding_step = GREATEST(onboarding_step, ?) WHERE id = ?')
       ->execute([$phase, $uid]);

    if ($phase === 3) {
        $db->prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?')->execute([$uid]);
        // Notify admins
        $db->prepare('INSERT INTO notifications (admin_id,title,message,type) SELECT id,"Peddler Ready for Review","A peddler has completed onboarding and is ready for verification.","system" FROM admins WHERE is_active=1')->execute();
    }

    jsonResponse(['message' => "Phase $phase completed"]);
}

// ── GET /verification/users/{id}  ────────────────────────
// Admin: get full verification data for a user
if ($method === 'GET' && preg_match('#^/verification/users/(\d+)$#', $uri, $m)) {
    requireAdmin();
    $uid = (int)$m[1];

    $uStmt = $db->prepare('SELECT id,first_name,last_name,email,phone,address,onboarding_step,onboarding_completed,verification_status,verified_at,rejection_reason FROM users WHERE id=?');
    $uStmt->execute([$uid]);
    $user = $uStmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found'], 404);

    $docs = $db->prepare('SELECT * FROM user_documents WHERE user_id = ? ORDER BY doc_category, uploaded_at');
    $docs->execute([$uid]);
    $user['documents'] = $docs->fetchAll();

    $asst = $db->prepare('SELECT * FROM user_assistants WHERE user_id = ?');
    $asst->execute([$uid]);
    $user['assistants'] = $asst->fetchAll();

    jsonResponse($user);
}

// ── Helper: recalculate onboarding_step ──────────────────
function _updateOnboardingStep(PDO $db, int $uid): void {
    $docs = $db->prepare('SELECT doc_category FROM user_documents WHERE user_id = ?');
    $docs->execute([$uid]);
    $cats = array_column($docs->fetchAll(), 'doc_category');

    $hasPrimary  = in_array('primary_id', $cats);
    $hasSecondary= in_array('secondary_id', $cats);
    $hasBarangay = in_array('barangay_clearance', $cats);
    $hasSelfie   = in_array('selfie', $cats);

    $asst = $db->prepare('SELECT COUNT(*) FROM user_assistants WHERE user_id = ?');
    $asst->execute([$uid]);
    $hasAssistant = $asst->fetchColumn() > 0;

    $step = 0;
    if (($hasPrimary || $hasSecondary) && $hasBarangay) $step = 1;
    if ($step >= 1 && $hasAssistant) $step = 2;
    if ($step >= 2 && $hasSelfie) { $step = 3; }

    $completed = $step >= 3 ? 1 : 0;
    $db->prepare('UPDATE users SET onboarding_step=?, onboarding_completed=? WHERE id=?')
       ->execute([$step, $completed, $uid]);
}
