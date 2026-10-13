<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Test Email Connection
require_once __DIR__ . '/vendor/phpmailer/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

echo '<h1>Testing Email Configuration</h1>';

$mail = new PHPMailer(true);

try {
    // Enable verbose debug output
    $mail->SMTPDebug = SMTP::DEBUG_SERVER;
    $mail->Debugoutput = 'html';
    
    echo '<h3>Attempting to connect to mail server...</h3>';
    
    $mail->isSMTP();
    $mail->Host       = 'mail.tetsousangyo.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'lcc.bpa-no-reply@tetsousangyo.com';
    $mail->Password   = 'Edrian010902';
    $mail->SMTPSecure = 'ssl';
    $mail->Port       = 465;
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ];

    $mail->setFrom('lcc.bpa-no-reply@tetsousangyo.com', 'LCC BPA System');
    $mail->addAddress('test@example.com', 'Test User');
    $mail->Subject = 'Test Email from LCC BPA';
    $mail->Body    = 'This is a test email to verify SMTP is working.';

    echo '<hr>';
    $mail->send();
    echo '<hr>';
    echo '<h2 style="color:green">✓ Email sent successfully!</h2>';
} catch (Exception $e) {
    echo '<hr>';
    echo '<h2 style="color:red">✗ Email failed</h2>';
    echo '<p><strong>Error:</strong> ' . $mail->ErrorInfo . '</p>';
    echo '<pre>' . $e->getMessage() . '</pre>';
}
?>
