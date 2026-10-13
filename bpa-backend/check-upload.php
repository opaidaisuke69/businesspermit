<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config/env.php';

echo "<h1>Upload Directory Check</h1>";

// Check UPLOAD_DIR constant
echo "<h2>UPLOAD_DIR Constant:</h2>";
echo "<p>" . UPLOAD_DIR . "</p>";

// Check if directory exists
echo "<h2>Directory Exists:</h2>";
if (is_dir(UPLOAD_DIR)) {
    echo "<p style='color: green;'>✓ YES</p>";
    
    // Check if writable
    if (is_writable(UPLOAD_DIR)) {
        echo "<p style='color: green;'>✓ Directory is writable</p>";
    } else {
        echo "<p style='color: red;'>✗ Directory is NOT writable</p>";
        echo "<p>Current permissions: " . substr(sprintf('%o', fileperms(UPLOAD_DIR)), -4) . "</p>";
    }
    
    // List files
    $files = scandir(UPLOAD_DIR);
    echo "<h2>Files in Directory (" . count($files) . "):</h2>";
    echo "<ul>";
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            $fullPath = UPLOAD_DIR . '/' . $file;
            $size = filesize($fullPath);
            echo "<li>" . htmlspecialchars($file) . " (" . number_format($size) . " bytes)</li>";
        }
    }
    echo "</ul>";
} else {
    echo "<p style='color: red;'>✗ NO - Directory does not exist</p>";
    echo "<p>Attempting to create directory...</p>";
    
    if (mkdir(UPLOAD_DIR, 0755, true)) {
        echo "<p style='color: green;'>✓ Directory created successfully</p>";
    } else {
        echo "<p style='color: red;'>✗ Failed to create directory</p>";
    }
}

// Check alternative path
$altDir = __DIR__ . '/uploads/';
echo "<h2>Alternative Path (__DIR__ . '/uploads/'):</h2>";
echo "<p>" . $altDir . "</p>";
if (is_dir($altDir)) {
    echo "<p style='color: green;'>✓ Exists</p>";
    $files = scandir($altDir);
    echo "<p>Files: " . (count($files) - 2) . "</p>";
} else {
    echo "<p style='color: red;'>✗ Does not exist</p>";
}

// Test file URL
echo "<h2>Test File Access:</h2>";
$testFiles = array_diff(scandir(UPLOAD_DIR), ['.', '..']);
if (count($testFiles) > 0) {
    $testFile = reset($testFiles);
    $testUrl = APP_URL . '/uploads/' . $testFile;
    echo "<p>Test URL: <a href='" . htmlspecialchars($testUrl) . "' target='_blank'>" . htmlspecialchars($testUrl) . "</a></p>";
} else {
    echo "<p>No files to test</p>";
}
