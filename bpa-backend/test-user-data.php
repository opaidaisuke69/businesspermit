<?php
// Test script to check user data format
require_once __DIR__ . '/config/database.php';

header('Content-Type: application/json');

$db = getDB();

// Get the most recent user
$stmt = $db->prepare('SELECT id,first_name,middle_name,last_name,email,phone,address,age,gender,civil_status,ctc_number,num_employees,verification_status,onboarding_step,onboarding_completed FROM users ORDER BY id DESC LIMIT 1');
$stmt->execute();
$user = $stmt->fetch();

if (!$user) {
    echo json_encode(['error' => 'No users found']);
    exit;
}

// Show the raw data and types
echo json_encode([
    'user' => $user,
    'onboarding_completed_value' => $user['onboarding_completed'],
    'onboarding_completed_type' => gettype($user['onboarding_completed']),
    'is_falsy' => !$user['onboarding_completed'] ? 'yes' : 'no',
    'strict_equals_zero' => $user['onboarding_completed'] === 0 ? 'yes' : 'no',
    'loose_equals_zero' => $user['onboarding_completed'] == 0 ? 'yes' : 'no',
], JSON_PRETTY_PRINT);
