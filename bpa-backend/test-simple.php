<?php
echo '<h1>PHP is working!</h1>';
echo '<p>PHP Version: ' . phpversion() . '</p>';

// Test if PHPMailer files exist
$files = [
    __DIR__ . '/vendor/phpmailer/Exception.php',
    __DIR__ . '/vendor/phpmailer/PHPMailer.php',
    __DIR__ . '/vendor/phpmailer/SMTP.php'
];

echo '<h2>Checking PHPMailer files:</h2>';
foreach ($files as $file) {
    if (file_exists($file)) {
        echo '✓ ' . basename($file) . ' exists<br>';
    } else {
        echo '✗ ' . basename($file) . ' NOT FOUND<br>';
    }
}

// Try to load PHPMailer
echo '<h2>Loading PHPMailer:</h2>';
try {
    require_once __DIR__ . '/vendor/phpmailer/Exception.php';
    echo '✓ Exception.php loaded<br>';
    
    require_once __DIR__ . '/vendor/phpmailer/PHPMailer.php';
    echo '✓ PHPMailer.php loaded<br>';
    
    require_once __DIR__ . '/vendor/phpmailer/SMTP.php';
    echo '✓ SMTP.php loaded<br>';
    
    echo '<h2 style="color:green">All files loaded successfully!</h2>';
} catch (Exception $e) {
    echo '<h2 style="color:red">Error loading files:</h2>';
    echo '<pre>' . $e->getMessage() . '</pre>';
}
?>
