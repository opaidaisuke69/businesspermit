<?php
// Debug script to check onboarding status
require_once __DIR__ . '/config/database.php';

header('Content-Type: text/html; charset=utf-8');

$db = getDB();

// Get all users with their onboarding status
$stmt = $db->prepare('SELECT id, email, first_name, last_name, onboarding_completed, onboarding_step, email_verified, created_at FROM users ORDER BY id DESC LIMIT 10');
$stmt->execute();
$users = $stmt->fetchAll();

?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Onboarding Debug</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #073B3A; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #073B3A; color: white; }
        tr:hover { background: #f9f9f9; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-success { background: #D1FAE5; color: #065F46; }
        .badge-warning { background: #FEF3C7; color: #92400E; }
        .badge-danger { background: #FEE2E2; color: #991B1B; }
        .json { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; margin-top: 20px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Onboarding Status Debug</h1>
        <p>This page shows the onboarding status of all users in the database.</p>
        
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Email Verified</th>
                    <th>Onboarding Completed</th>
                    <th>Onboarding Step</th>
                    <th>Created At</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user): ?>
                <tr>
                    <td><?= htmlspecialchars($user['id']) ?></td>
                    <td><?= htmlspecialchars($user['email']) ?></td>
                    <td><?= htmlspecialchars($user['first_name'] . ' ' . $user['last_name']) ?></td>
                    <td>
                        <?php if ($user['email_verified']): ?>
                            <span class="badge badge-success">✓ Verified</span>
                        <?php else: ?>
                            <span class="badge badge-danger">✗ Not Verified</span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <strong><?= htmlspecialchars($user['onboarding_completed']) ?></strong>
                        <small>(<?= gettype($user['onboarding_completed']) ?>)</small>
                        <?php if ($user['onboarding_completed'] == 0): ?>
                            <span class="badge badge-warning">Incomplete</span>
                        <?php else: ?>
                            <span class="badge badge-success">Complete</span>
                        <?php endif; ?>
                    </td>
                    <td><?= htmlspecialchars($user['onboarding_step']) ?></td>
                    <td><?= htmlspecialchars($user['created_at']) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        
        <h2>JSON Response Test</h2>
        <p>This shows how the data would be returned via the API:</p>
        <div class="json">
            <?php
            // Simulate API response
            $testUser = $users[0] ?? null;
            if ($testUser) {
                unset($testUser['created_at']); // Remove for cleaner output
                // Convert to integers like we do in the API
                $testUser['onboarding_completed'] = (int)$testUser['onboarding_completed'];
                $testUser['onboarding_step'] = (int)$testUser['onboarding_step'];
                echo json_encode($testUser, JSON_PRETTY_PRINT);
            }
            ?>
        </div>
        
        <h2>JavaScript Test</h2>
        <p>Test how JavaScript interprets the onboarding_completed value:</p>
        <div id="js-test"></div>
        
        <script>
            const user = <?= json_encode($testUser ?? []) ?>;
            const testDiv = document.getElementById('js-test');
            
            testDiv.innerHTML = `
                <div class="json">
                    <strong>user.onboarding_completed:</strong> ${user.onboarding_completed}<br>
                    <strong>typeof:</strong> ${typeof user.onboarding_completed}<br>
                    <strong>!user.onboarding_completed:</strong> ${!user.onboarding_completed}<br>
                    <strong>user.onboarding_completed === 0:</strong> ${user.onboarding_completed === 0}<br>
                    <strong>user.onboarding_completed == 0:</strong> ${user.onboarding_completed == 0}<br>
                    <br>
                    <strong>Should redirect to onboarding?</strong> ${!user.onboarding_completed ? 'YES ✓' : 'NO ✗'}
                </div>
            `;
        </script>
    </div>
</body>
</html>
