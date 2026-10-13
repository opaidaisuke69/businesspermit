<?php
// Simple onboarding checker
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    
    // Get the most recent user
    $stmt = $db->query('SELECT id, email, first_name, last_name, onboarding_completed, onboarding_step FROM users ORDER BY id DESC LIMIT 1');
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        die('No users found in database');
    }
    
    echo "<h1>User Onboarding Check</h1>";
    echo "<p><strong>User:</strong> " . htmlspecialchars($user['first_name'] . ' ' . $user['last_name']) . "</p>";
    echo "<p><strong>Email:</strong> " . htmlspecialchars($user['email']) . "</p>";
    echo "<p><strong>Onboarding Completed:</strong> " . $user['onboarding_completed'] . "</p>";
    echo "<p><strong>Onboarding Step:</strong> " . $user['onboarding_step'] . "</p>";
    
    // Check documents
    $stmt = $db->prepare('SELECT COUNT(*) as cnt, doc_category FROM user_documents WHERE user_id = ? GROUP BY doc_category');
    $stmt->execute([$user['id']]);
    $docs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<h2>Documents:</h2><ul>";
    if (count($docs) > 0) {
        foreach ($docs as $d) {
            echo "<li>" . htmlspecialchars($d['doc_category']) . ": " . $d['cnt'] . "</li>";
        }
    } else {
        echo "<li>No documents</li>";
    }
    echo "</ul>";
    
    // Check assistants
    $stmt = $db->prepare('SELECT COUNT(*) as cnt FROM user_assistants WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $assistantCount = $stmt->fetchColumn();
    
    echo "<h2>Assistants:</h2>";
    echo "<p>Count: " . $assistantCount . "</p>";
    
    // Diagnosis
    echo "<h2>Diagnosis:</h2>";
    if ($user['onboarding_completed'] == 1) {
        echo "<p style='color: red; font-weight: bold;'>⚠️ BUG CONFIRMED: onboarding_completed = 1</p>";
        echo "<p>User can access dashboard without completing onboarding.</p>";
        echo "<form method='POST'>";
        echo "<input type='hidden' name='fix' value='1'>";
        echo "<input type='hidden' name='user_id' value='" . $user['id'] . "'>";
        echo "<button type='submit' style='padding: 10px 20px; background: #073B3A; color: white; border: none; border-radius: 5px; cursor: pointer;'>Fix: Reset to 0</button>";
        echo "</form>";
    } else {
        echo "<p style='color: green; font-weight: bold;'>✓ Status is correct: onboarding_completed = 0</p>";
    }
    
    // Handle fix
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['fix'])) {
        $userId = (int)$_POST['user_id'];
        $db->prepare('UPDATE users SET onboarding_completed = 0, onboarding_step = 0 WHERE id = ?')->execute([$userId]);
        echo "<p style='color: green; margin-top: 20px;'>✓ Fixed! Onboarding reset to 0. <a href='check-onboarding.php'>Refresh</a></p>";
    }
    
} catch (Exception $e) {
    echo "<h1>Error</h1>";
    echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}
