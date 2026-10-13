<?php
// ============================================================
// Reports Routes
// ============================================================

$uri    = $GLOBALS['route_uri'];
$method = $GLOBALS['route_method'];
$db     = getDB();

// GET /reports/weekly
if ($method === 'GET' && $uri === '/reports/weekly') {
    requireAdmin();
    $stmt = $db->query('SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 12');
    jsonResponse(['data' => $stmt->fetchAll()]);
}

// POST /reports/generate — generate weekly report
if ($method === 'POST' && $uri === '/reports/generate') {
    requireAdmin();
    $body      = getBody();
    $weekStart = $body['week_start'] ?? date('Y-m-d', strtotime('last sunday'));
    $weekEnd   = $body['week_end']   ?? date('Y-m-d', strtotime('next saturday', strtotime($weekStart)));

    $totalPeddlers = $db->query("SELECT COUNT(*) FROM users WHERE verification_status='verified'")->fetchColumn();

    $pStmt = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN ('paid','verified') AND paid_at BETWEEN ? AND ?");
    $pStmt->execute([$weekStart . ' 00:00:00', $weekEnd . ' 23:59:59']);
    $totalPayments = $pStmt->fetchColumn();

    $pmStmt = $db->prepare("SELECT COUNT(*) FROM permits WHERE created_at BETWEEN ? AND ?");
    $pmStmt->execute([$weekStart . ' 00:00:00', $weekEnd . ' 23:59:59']);
    $totalPermits = $pmStmt->fetchColumn();

    $appStmt = $db->prepare("SELECT COUNT(*) FROM applications WHERE created_at BETWEEN ? AND ?");
    $appStmt->execute([$weekStart . ' 00:00:00', $weekEnd . ' 23:59:59']);
    $totalApps = $appStmt->fetchColumn();

    $reportData = [
        'top_business_types' => $db->query("SELECT business_type, COUNT(*) AS count FROM applications GROUP BY business_type ORDER BY count DESC LIMIT 5")->fetchAll(),
        'payment_methods'    => $db->query("SELECT payment_method, COUNT(*) AS count FROM payments GROUP BY payment_method")->fetchAll(),
    ];

    $stmt = $db->prepare('INSERT INTO weekly_reports (week_start,week_end,total_peddlers,total_payments,total_permits_issued,total_applications,report_data) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([$weekStart, $weekEnd, $totalPeddlers, $totalPayments, $totalPermits, $totalApps, json_encode($reportData)]);

    jsonResponse([
        'message'          => 'Report generated',
        'week_start'       => $weekStart,
        'week_end'         => $weekEnd,
        'total_peddlers'   => $totalPeddlers,
        'total_payments'   => $totalPayments,
        'total_permits'    => $totalPermits,
        'total_apps'       => $totalApps,
    ]);
}
