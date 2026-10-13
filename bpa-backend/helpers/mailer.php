<?php
// ============================================================
// PHPMailer Helper — Gmail SMTP
// ============================================================

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as MailException;

require_once __DIR__ . '/../vendor/phpmailer/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/SMTP.php';

function sendMail(string $toEmail, string $toName, string $subject, string $htmlBody): bool {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'mail.tetsousangyo.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'lcc.bpa-no-reply@tetsousangyo.com';
        $mail->Password   = 'Edrian010902';
        $mail->SMTPSecure = 'ssl';
        $mail->Port       = 465;
        $mail->SMTPOptions = ['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]];

        $mail->setFrom('lcc.bpa-no-reply@tetsousangyo.com', 'LCC BPA System');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $htmlBody));

        $mail->send();
        return true;
    } catch (MailException $e) {
        error_log('Mailer error: ' . $mail->ErrorInfo);
        return false;
    }
}

// ── Email templates ──────────────────────────────────────────

function emailVerifyOtpTemplate(string $name, string $otp): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f0f7f4;margin:0;padding:20px}
  .wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,59,58,.12)}
  .header{background:linear-gradient(135deg,#073B3A,#0B6E4F);padding:32px 24px;text-align:center}
  .header img{width:60px;height:60px;border-radius:12px}
  .header h1{color:#fff;font-size:20px;margin:12px 0 4px}
  .header p{color:rgba(255,255,255,.7);font-size:13px;margin:0}
  .body{padding:28px 24px}
  .otp-box{background:#f0f7f4;border:2px dashed #21D375;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
  .otp{font-size:40px;font-weight:800;letter-spacing:10px;color:#073B3A;font-family:monospace}
  .otp-label{font-size:12px;color:#4A7A72;margin-top:6px}
  .note{font-size:12px;color:#8AADA8;text-align:center;margin-top:16px}
  .footer{background:#f8faf9;padding:16px 24px;text-align:center;font-size:11px;color:#8AADA8}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>LCC BPA</h1>
    <p>La Carlota City Business Permit Application</p>
  </div>
  <div class="body">
    <p style="color:#0D2B28;font-size:15px">Hi <strong>{$name}</strong>,</p>
    <p style="color:#4A7A72;font-size:14px">Use the verification code below to verify your email address:</p>
    <div class="otp-box">
      <div class="otp">{$otp}</div>
      <div class="otp-label">This code expires in <strong>15 minutes</strong></div>
    </div>
    <p class="note">If you did not request this, please ignore this email.</p>
  </div>
  <div class="footer">© 2025 City Government of La Carlota · LCC BPA System</div>
</div>
</body></html>
HTML;
}

function emailVerifyLinkTemplate(string $name, string $link): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f0f7f4;margin:0;padding:20px}
  .wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,59,58,.12)}
  .header{background:linear-gradient(135deg,#073B3A,#0B6E4F);padding:32px 24px;text-align:center}
  .header h1{color:#fff;font-size:20px;margin:0 0 4px}
  .header p{color:rgba(255,255,255,.7);font-size:13px;margin:0}
  .body{padding:28px 24px}
  .btn{display:block;background:linear-gradient(135deg,#073B3A,#0B6E4F);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;text-align:center;margin:20px 0}
  .link-box{background:#f0f7f4;border-radius:8px;padding:12px;word-break:break-all;font-size:11px;color:#4A7A72;margin-top:12px}
  .note{font-size:12px;color:#8AADA8;text-align:center;margin-top:16px}
  .footer{background:#f8faf9;padding:16px 24px;text-align:center;font-size:11px;color:#8AADA8}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>LCC BPA</h1>
    <p>La Carlota City Business Permit Application</p>
  </div>
  <div class="body">
    <p style="color:#0D2B28;font-size:15px">Hi <strong>{$name}</strong>,</p>
    <p style="color:#4A7A72;font-size:14px">Click the button below to verify your email address:</p>
    <a href="{$link}" class="btn">✓ Verify My Email</a>
    <p style="color:#4A7A72;font-size:12px;text-align:center">Or copy this link:</p>
    <div class="link-box">{$link}</div>
    <p class="note">This link expires in <strong>30 minutes</strong>. If you did not request this, ignore this email.</p>
  </div>
  <div class="footer">© 2025 City Government of La Carlota · LCC BPA System</div>
</div>
</body></html>
HTML;
}

function passwordResetOtpTemplate(string $name, string $otp): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f0f7f4;margin:0;padding:20px}
  .wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,59,58,.12)}
  .header{background:linear-gradient(135deg,#073B3A,#0B6E4F);padding:32px 24px;text-align:center}
  .header h1{color:#fff;font-size:20px;margin:0 0 4px}
  .header p{color:rgba(255,255,255,.7);font-size:13px;margin:0}
  .body{padding:28px 24px}
  .otp-box{background:#fff3cd;border:2px dashed #F59E0B;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
  .otp{font-size:40px;font-weight:800;letter-spacing:10px;color:#073B3A;font-family:monospace}
  .otp-label{font-size:12px;color:#92400e;margin-top:6px}
  .note{font-size:12px;color:#8AADA8;text-align:center;margin-top:16px}
  .footer{background:#f8faf9;padding:16px 24px;text-align:center;font-size:11px;color:#8AADA8}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Password Reset</h1>
    <p>LCC BPA System</p>
  </div>
  <div class="body">
    <p style="color:#0D2B28;font-size:15px">Hi <strong>{$name}</strong>,</p>
    <p style="color:#4A7A72;font-size:14px">Use this code to reset your password:</p>
    <div class="otp-box">
      <div class="otp">{$otp}</div>
      <div class="otp-label">Expires in <strong>15 minutes</strong></div>
    </div>
    <p class="note">If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
  </div>
  <div class="footer">© 2025 City Government of La Carlota · LCC BPA System</div>
</div>
</body></html>
HTML;
}

function passwordResetLinkTemplate(string $name, string $link): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f0f7f4;margin:0;padding:20px}
  .wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(7,59,58,.12)}
  .header{background:linear-gradient(135deg,#073B3A,#0B6E4F);padding:32px 24px;text-align:center}
  .header h1{color:#fff;font-size:20px;margin:0 0 4px}
  .header p{color:rgba(255,255,255,.7);font-size:13px;margin:0}
  .body{padding:28px 24px}
  .btn{display:block;background:#EF4444;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;text-align:center;margin:20px 0}
  .link-box{background:#f0f7f4;border-radius:8px;padding:12px;word-break:break-all;font-size:11px;color:#4A7A72;margin-top:12px}
  .note{font-size:12px;color:#8AADA8;text-align:center;margin-top:16px}
  .footer{background:#f8faf9;padding:16px 24px;text-align:center;font-size:11px;color:#8AADA8}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Password Reset</h1>
    <p>LCC BPA System</p>
  </div>
  <div class="body">
    <p style="color:#0D2B28;font-size:15px">Hi <strong>{$name}</strong>,</p>
    <p style="color:#4A7A72;font-size:14px">Click the button below to reset your password:</p>
    <a href="{$link}" class="btn">🔑 Reset My Password</a>
    <div class="link-box">{$link}</div>
    <p class="note">This link expires in <strong>30 minutes</strong>.</p>
  </div>
  <div class="footer">© 2025 City Government of La Carlota · LCC BPA System</div>
</div>
</body></html>
HTML;
}
