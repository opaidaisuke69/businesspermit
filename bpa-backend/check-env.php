<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Environment Check</h1>";

// Check current directory
echo "<h2>Current Directory:</h2>";
echo "<p>" . __DIR__ . "</p>";

// Check .env file path
$envFile = __DIR__ . '/.env';
echo "<h2>.env File Path:</h2>";
echo "<p>" . $envFile . "</p>";

// Check if .env exists
echo "<h2>.env File Exists:</h2>";
if (file_exists($envFile)) {
    echo "<p style='color: green;'>✓ YES</p>";
    
    // Check if readable
    if (is_readable($envFile)) {
        echo "<p style='color: green;'>✓ File is readable</p>";
        
        // Show first few lines (without sensitive data)
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        echo "<h2>File Contents (first 5 lines, passwords hidden):</h2>";
        echo "<pre>";
        $count = 0;
        foreach ($lines as $line) {
            if ($count >= 5) break;
            // Hide password values
            if (strpos($line, 'PASSWORD') !== false || strpos($line, 'SECRET') !== false) {
                $parts = explode('=', $line, 2);
                echo htmlspecialchars($parts[0]) . "=***HIDDEN***\n";
            } else {
                echo htmlspecialchars($line) . "\n";
            }
            $count++;
        }
        echo "</pre>";
    } else {
        echo "<p style='color: red;'>✗ File is NOT readable</p>";
    }
} else {
    echo "<p style='color: red;'>✗ NO - File does not exist</p>";
}

// Load env.php and check constants
echo "<h2>Loading env.php:</h2>";
require_once __DIR__ . '/config/env.php';

echo "<h3>Database Constants:</h3>";
echo "<p>DB_HOST: " . (defined('DB_HOST') ? DB_HOST : 'NOT DEFINED') . "</p>";
echo "<p>DB_NAME: " . (defined('DB_NAME') ? DB_NAME : 'NOT DEFINED') . "</p>";
echo "<p>DB_USER: " . (defined('DB_USER') ? DB_USER : 'NOT DEFINED') . "</p>";
echo "<p>DB_PASS: " . (defined('DB_PASS') ? '***SET***' : 'NOT DEFINED') . "</p>";

echo "<h3>Other Constants:</h3>";
echo "<p>APP_URL: " . (defined('APP_URL') ? APP_URL : 'NOT DEFINED') . "</p>";
echo "<p>UPLOAD_DIR: " . (defined('UPLOAD_DIR') ? UPLOAD_DIR : 'NOT DEFINED') . "</p>";

// Check $_ENV
echo "<h2>$_ENV Variables:</h2>";
echo "<pre>";
foreach ($_ENV as $key => $value) {
    if (strpos($key, 'DB_') === 0) {
        if (strpos($key, 'PASS') !== false) {
            echo htmlspecialchars($key) . " = ***HIDDEN***\n";
        } else {
            echo htmlspecialchars($key) . " = " . htmlspecialchars($value) . "\n";
        }
    }
}
echo "</pre>";
