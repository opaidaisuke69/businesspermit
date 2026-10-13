<?php
// Check user's complete onboarding status
require_once __DIR__ . '/config/database.php';

header('Content-Type: text/html; charset=utf-8');

$db = getDB();

// Get the most recent user
$stmt = $db->prepare('SELECT id, email, first_name, last_name, onboarding_completed, onboarding_step FROM users ORDER BY id DESC LIMIT 1');
$stmt->execute();
$user = $stmt->fetch();

if (!$user) {
    die('No users found');
}

$uid = $user['id'];

// Check documents
$docs = $db->prepare('SELECT id, doc_category, id_type, file_url FROM user_documents WHERE user_id = ?');
$docs->execute([$uid]);
$documents = $docs->fetchAll();

// Check assistants
$asst = $db->prepare('SELECT id, first_name, last_name, relationship FROM user_assistants WHERE user_id = ?');
$asst->execute([$uid]);
$assistants = $asst->fetchAll();

// Categorize documents
$hasPrimary = false;
$hasBarangay = false;
$hasSelfie = false;
$hasOldPermit = false;
$primaryCount = 0;
$barangayCount = 0;
$selfieCount = 0;
$permitCount = 0;

foreach ($documents as $doc) {
    if ($doc['doc_category'] === 'primary_id') {
        $hasPrimary = true;
        $primaryCount++;
    }
    if ($doc['doc_category'] === 'barangay_clearance') {
        $hasBarangay = true;
        $barangayCount++;
    }
    if ($doc['doc_category'] === 'selfie') {
        $hasSelfie = true;
        $selfieCount++;
    }
    if ($doc['doc_category'] === 'old_business_permit') {
        $hasOldPermit = true;
        $permitCount++;
    }
}

$hasAssistant = count($assistants) > 0;
$shouldBeComplete = $hasPrimary && $hasBarangay && $hasAssistant && $hasSelfie;
$actuallyComplete = $user['onboarding_completed'] == 1;

?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Onboarding Status</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #073B3A; }
        .status { padding: 15px; border-radius: 8px; margin: 15px 0; }
        .status-good { background: #D1FAE5; border-left: 4px solid #065F46; }
        .status-bad { background: #FEE2E2; border-left: 4px solid #991B1B; }
        .status-warning { background: #FEF3C7; border-left: 4px solid #92400E; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f9f9f9; font-weight: bold; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; }
        .badge-yes { background: #D1FAE5; color: #065F46; }
        .badge-no { background: #FEE2E2; color: #991B1B; }
        .fix-btn { background: #073B3A; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; margin-top: 15px; }
        .fix-btn:hover { background: #0B6E4F; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 User Onboarding Status</h1>
        
        <div class="status <?php echo $user['onboarding_completed'] == 1 ? 'status-good' : 'status-bad'; ?>">
            <strong>User:</strong> <?php echo htmlspecialchars($user['first_name'] . ' ' . $user['last_name']); ?> (<?php echo htmlspecialchars($user['email']); ?>)<br>
            <strong>Onboarding Completed:</strong> <?php echo $user['onboarding_completed']; ?> 
            <?php echo $user['onboarding_completed'] == 1 ? '✓' : '✗'; ?><br>
            <strong>Onboarding Step:</strong> <?php echo $user['onboarding_step']; ?>
        </div>

        <h2>Requirements Checklist</h2>
        <table>
            <tr>
                <th>Requirement</th>
                <th>Status</th>
                <th>Count</th>
            </tr>
            <tr>
                <td>Primary ID</td>
                <td><span class="badge <?php echo $hasPrimary ? 'badge-yes' : 'badge-no'; ?>"><?php echo $hasPrimary ? 'YES' : 'NO'; ?></span></td>
                <td><?php echo $primaryCount; ?></td>
            </tr>
            <tr>
                <td>Barangay Clearance</td>
                <td><span class="badge <?php echo $hasBarangay ? 'badge-yes' : 'badge-no'; ?>"><?php echo $hasBarangay ? 'YES' : 'NO'; ?></span></td>
                <td><?php echo $barangayCount; ?></td>
            </tr>
            <tr>
                <td>Assistant</td>
                <td><span class="badge <?php echo $hasAssistant ? 'badge-yes' : 'badge-no'; ?>"><?php echo $hasAssistant ? 'YES' : 'NO'; ?></span></td>
                <td><?php echo count($assistants); ?></td>
            </tr>
            <tr>
                <td>Selfie</td>
                <td><span class="badge <?php echo $hasSelfie ? 'badge-yes' : 'badge-no'; ?>"><?php echo $hasSelfie ? 'YES' : 'NO'; ?></span></td>
                <td><?php echo $selfieCount; ?></td>
            </tr>
            <tr>
                <td>Old Business Permit (Optional)</td>
                <td><span class="badge <?php echo $hasOldPermit ? 'badge-yes' : 'badge-no'; ?>"><?php echo $hasOldPermit ? 'YES' : 'NO'; ?></span></td>
                <td><?php echo $permitCount; ?></td>
            </tr>
        </table>

        <h2>Analysis</h2>
        <?php
        if ($shouldBeComplete && $actuallyComplete) {
            echo '<div class="status status-good">✓ Status is CORRECT: User has all requirements and onboarding_completed = 1</div>';
        } elseif (!$shouldBeComplete && !$actuallyComplete) {
            echo '<div class="status status-warning">⚠ Status is CORRECT: User is missing requirements and onboarding_completed = 0</div>';
            echo '<p>Missing: ';
            $missing = array();
            if (!$hasPrimary) $missing[] = 'Primary ID';
            if (!$hasBarangay) $missing[] = 'Barangay Clearance';
            if (!$hasAssistant) $missing[] = 'Assistant';
            if (!$hasSelfie) $missing[] = 'Selfie';
            echo implode(', ', $missing);
            echo '</p>';
        } elseif ($shouldBeComplete && !$actuallyComplete) {
            echo '<div class="status status-bad">✗ INCONSISTENT: User has all requirements but onboarding_completed = 0</div>';
            echo '<p>This user should be able to access the dashboard but cannot.</p>';
            echo '<form method="POST" action="fix-onboarding.php">';
            echo '<input type="hidden" name="user_id" value="' . $uid . '">';
            echo '<input type="hidden" name="action" value="complete">';
            echo '<button type="submit" class="fix-btn">Fix: Set onboarding_completed = 1</button>';
            echo '</form>';
        } else {
            echo '<div class="status status-bad">✗ INCONSISTENT: User is missing requirements but onboarding_completed = 1</div>';
            echo '<p>This is the BUG! User can access dashboard without completing onboarding.</p>';
            echo '<form method="POST" action="fix-onboarding.php">';
            echo '<input type="hidden" name="user_id" value="' . $uid . '">';
            echo '<input type="hidden" name="action" value="reset">';
            echo '<button type="submit" class="fix-btn">Fix: Reset onboarding_completed = 0</button>';
            echo '</form>';
        }
        ?>

        <h2>All Documents (<?php echo count($documents); ?>)</h2>
        <?php if (count($documents) > 0): ?>
        <table>
            <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Type</th>
                <th>File</th>
            </tr>
            <?php foreach ($documents as $doc): ?>
            <tr>
                <td><?php echo $doc['id']; ?></td>
                <td><?php echo htmlspecialchars($doc['doc_category']); ?></td>
                <td><?php echo htmlspecialchars($doc['id_type'] ? $doc['id_type'] : 'N/A'); ?></td>
                <td><a href="<?php echo htmlspecialchars($doc['file_url']); ?>" target="_blank">View</a></td>
            </tr>
            <?php endforeach; ?>
        </table>
        <?php else: ?>
        <p>No documents uploaded.</p>
        <?php endif; ?>

        <h2>All Assistants (<?php echo count($assistants); ?>)</h2>
        <?php if (count($assistants) > 0): ?>
        <table>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Relationship</th>
            </tr>
            <?php foreach ($assistants as $a): ?>
            <tr>
                <td><?php echo $a['id']; ?></td>
                <td><?php echo htmlspecialchars($a['first_name'] . ' ' . $a['last_name']); ?></td>
                <td><?php echo htmlspecialchars($a['relationship']); ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
        <?php else: ?>
        <p>No assistants added.</p>
        <?php endif; ?>
    </div>
</body>
</html>
