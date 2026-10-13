<?php
// Fix onboarding status
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    die('Method not allowed');
}

$userId = (int)($_POST['user_id'] ?? 0);
$action = $_POST['action'] ?? '';

if (!$userId || !in_array($action, ['complete', 'reset'])) {
    die('Invalid parameters');
}

$db = getDB();

if ($action === 'complete') {
    $db->prepare('UPDATE users SET onboarding_completed = 1, onboarding_step = 3 WHERE id = ?')->execute([$userId]);
    header('Location: test-user-complete-status.php?msg=completed');
} else {
    $db->prepare('UPDATE users SET onboarding_completed = 0, onboarding_step = 0 WHERE id = ?')->execute([$userId]);
    header('Location: test-user-complete-status.php?msg=reset');
}
exit;
