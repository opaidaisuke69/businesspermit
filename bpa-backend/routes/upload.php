<?php
// ============================================================
// File Upload Route
// ============================================================
error_reporting(0); // prevent PHP warnings from corrupting JSON response

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

$allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
$maxSize = 5 * 1024 * 1024; // 5MB

if (empty($_FILES['file'])) jsonResponse(['error' => 'No file uploaded'], 422);

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) jsonResponse(['error' => 'Upload error'], 422);
if ($file['size'] > $maxSize) jsonResponse(['error' => 'File too large (max 5MB)'], 422);

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowed)) jsonResponse(['error' => 'Invalid file type'], 422);

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid('upload_', true) . '.' . strtolower($ext);
$dir = !empty(UPLOAD_DIR) ? UPLOAD_DIR : __DIR__ . '/../uploads/';
$dir = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR;

if (!is_dir($dir)) mkdir($dir, 0755, true);

$dest = $dir . $filename;
if (!move_uploaded_file($file['tmp_name'], $dest))
    jsonResponse(['error' => 'Failed to save file'], 500);

$url = APP_URL . '/uploads/' . $filename;
jsonResponse(['url' => $url, 'filename' => $filename]);
