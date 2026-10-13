<?php
// ============================================================
// Official Receipt HTML Generator
// Accountable Form No. 51-C — CTO La Carlota City
// ============================================================

require_once __DIR__ . '/signatories.php';

function generateReceiptHTML(array $pay, array $user, array $app): string {
    $db  = getDB();
    $sig = getSignatories($db);
    $collectingOfficer    = $sig['collecting_officer']['person_name'] ?? '';
    $collectingTitle      = $sig['collecting_officer']['credentials'] ?? 'Collecting Officer';
    $collectingSig        = $sig['collecting_officer']['signature_url'] ?? '';
    $collectingSigImg     = $collectingSig
        ? "<img src=\"{$collectingSig}\" style=\"height:44px;max-width:130px;object-fit:contain;display:block;margin:0 auto 0;\" alt=\"\" />"
        : '';
    // Parse fee breakdown
    $breakdown = [];
    if (!empty($pay['fee_breakdown'])) {
        $raw = is_string($pay['fee_breakdown']) ? json_decode($pay['fee_breakdown'], true) : $pay['fee_breakdown'];
        if (is_array($raw)) $breakdown = $raw;
    }

    $total      = (float)$pay['amount'];
    $totalWords = _numberToWords($total);
    $receiptNo  = str_pad((string)$pay['id'], 7, '0', STR_PAD_LEFT);
    $date       = !empty($pay['verified_at']) ? date('M. d, Y', strtotime($pay['verified_at'])) : date('M. d, Y');
    $payorName  = strtoupper(trim($user['last_name'] . ', ' . $user['first_name'] . ' ' . ($user['middle_name'] ?? '')));
    $method     = strtoupper($pay['payment_method_type'] ?? 'CASH');
    $totalDisplay = number_format($total, 2);

    // Logo
    $logoPath = __DIR__ . '/../logo.png';
    $logoSrc  = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : '';

    $isMobile = isset($_GET['source']) && $_GET['source'] === 'mobile';

    // Download bar
    $downloadBar = '';
    $downloadScript = '';
    if (!$isMobile) {
        $downloadBar    = '<div class="no-print" style="text-align:center;padding:16px;background:#f5f5f5"><button onclick="downloadPDF()" style="background:linear-gradient(135deg,#073B3A,#0B6E4F);color:#fff;border:none;border-radius:12px;padding:14px 36px;font-size:15px;font-weight:bold;cursor:pointer;font-family:Arial,sans-serif">⬇ Download Receipt as PDF</button></div>';
        $downloadScript = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script><script>function downloadPDF(){var btn=document.querySelector(".no-print");btn.style.display="none";html2pdf().set({margin:0,filename:"Receipt-' . $receiptNo . '.pdf",image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true,width:794,windowWidth:794},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(document.getElementById("receipt-wrap")).save().then(function(){btn.style.display="block";});}</script>';
    }

    // Build fee rows
    $feeRowsHtml = '';
    $feeKeys = [
        'mayors_permit'      => "MAYOR'S PERMIT",
        'sanitary_permit'    => 'SANITARY PERMIT',
        'health_certificate' => 'HEALTH CERTIFICATE',
        'occupational_tax'   => 'OCCUPATIONAL TAX',
        'garbage_fee'        => 'GARBAGE FEE',
        'brgy_clearance'     => 'BRGY. CLEARANCE',
        'peddlers_tax'       => "PEDDLERS TAX",
    ];

    // Index breakdown by key
    $byKey = [];
    foreach ($breakdown as $f) {
        $byKey[$f['key']] = $f;
    }

    foreach ($feeKeys as $key => $label) {
        $amt = isset($byKey[$key]) ? (float)$byKey[$key]['amount'] : 0.0;
        $qty = isset($byKey[$key]['qty']) ? (int)$byKey[$key]['qty'] : null;
        $amtDisplay = $amt > 0 ? number_format($amt, 2) : '—';
        $qtyNote    = ($qty && $qty > 1) ? " <span style='font-size:8px;color:#555;'>(×{$qty})</span>" : '';
        $feeRowsHtml .= <<<ROW
        <tr>
          <td class="fee-label">{$label}{$qtyNote}</td>
          <td class="fee-amt">₱ {$amtDisplay}</td>
        </tr>
ROW;
    }

    // Payment method checkboxes: Cash | Check | Digital Wallet
    $cashChecked   = ($method === 'CASH')                              ? '&#10003;' : '&#9633;';
    $checkChecked  = ($method === 'CHECK')                             ? '&#10003;' : '&#9633;';
    $walletChecked = in_array($method, ['GCASH','MAYA','QRPH'])        ? '&#10003;' : '&#9633;';
    $walletLabel   = in_array($method, ['GCASH','MAYA','QRPH'])
                       ? 'Digital Wallet (' . ucfirst(strtolower($method)) . ')'
                       : 'Digital Wallet';

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Official Receipt No. {$receiptNo}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #e8e8e8; }

#receipt-wrap {
  width: 380px;
  margin: 24px auto;
  background: #fff;
  border: 2px solid #000;
  padding: 0;
}

.receipt-inner {
  border: 1px solid #000;
  margin: 5px;
  padding: 0;
}

/* ── Top meta ── */
.top-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 8px 4px;
  border-bottom: 1px solid #000;
  font-size: 7.5px;
}
.top-meta-left { line-height: 1.5; }
.top-meta-right { text-align: right; font-size: 7.5px; }

/* ── Header ── */
.receipt-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 10px 6px;
  border-bottom: 1.5px solid #000;
  text-align: center;
}
.receipt-header img { width: 52px; height: 52px; object-fit: contain; }
.receipt-header-text { }
.receipt-header-text .official { font-size: 11px; font-weight: bold; }
.receipt-header-text .republic { font-size: 9px; }
.receipt-header-text .no-value { font-size: 18px; font-weight: 900; letter-spacing: 1px; margin-top: 6px; }

/* ── Date / Agency ── */
.receipt-meta {
  padding: 5px 8px;
  border-bottom: 1px solid #000;
  font-size: 9px;
}
.receipt-meta table { width: 100%; border-collapse: collapse; }
.receipt-meta td { padding: 2px 0; }
.receipt-meta .meta-label { font-weight: bold; width: 55px; }
.receipt-meta .meta-val { border-bottom: 1px solid #000; padding-left: 4px; }

/* ── Fee table ── */
.fee-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
}
.fee-table thead tr th {
  border: 1px solid #000;
  padding: 3px 5px;
  font-size: 8.5px;
  text-align: center;
  background: #f0f0f0;
}
.fee-table tbody tr td {
  border: 1px solid #000;
  padding: 3px 5px;
}
.fee-label { font-weight: bold; font-size: 8.5px; }
.fee-amt   { width: 70px; text-align: right; font-weight: bold; }

/* ── Total ── */
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  border-top: 2px solid #000;
  border-bottom: 1px solid #000;
  font-size: 10px;
  font-weight: bold;
}

/* ── Amount in words ── */
.words-row {
  padding: 4px 8px;
  font-size: 8.5px;
  border-bottom: 1px solid #000;
  line-height: 1.5;
}
.words-label { font-weight: bold; }
.words-val { border-bottom: 1px solid #000; display: block; margin-top: 2px; font-style: italic; }

/* ── Payment method ── */
.method-row {
  display: flex;
  gap: 14px;
  padding: 5px 8px;
  font-size: 9px;
  border-bottom: 1px solid #000;
  align-items: center;
}
.method-item { display: flex; align-items: center; gap: 3px; }
.method-check { font-size: 11px; line-height: 1; }

/* ── Drawee row ── */
.drawee-row {
  display: flex;
  gap: 0;
  font-size: 8.5px;
  border-bottom: 1px solid #000;
}
.drawee-cell {
  flex: 1;
  padding: 3px 6px;
  border-right: 1px solid #000;
}
.drawee-cell:last-child { border-right: none; }
.drawee-label { font-weight: bold; font-size: 8px; }
.drawee-val { border-bottom: 1px solid #000; min-height: 14px; margin-top: 2px; }

/* ── Received ── */
.received-row {
  padding: 5px 8px 2px;
  font-size: 8.5px;
  font-style: italic;
}

/* ── Signature ── */
.sig-row {
  padding: 2px 8px 8px;
  text-align: right;
  font-size: 8.5px;
}
.sig-line {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
  display: inline-block;
  width: 160px;
  text-align: center;
  font-weight: bold;
  line-height: 1.5;
}

/* ── Note ── */
.note-row {
  padding: 4px 8px 6px;
  font-size: 7.5px;
  font-style: italic;
  color: #333;
  border-top: 1px solid #000;
}

@media print {
  body { background: #fff; }
  .no-print { display: none !important; }
  #receipt-wrap { margin: 0 auto; border: 2px solid #000; }
}
@page { size: A4; margin: 10mm; }
</style>
</head>
<body>

<div id="receipt-wrap">
  <div class="receipt-inner">

    <!-- Top meta -->
    <div class="top-meta">
      <div class="top-meta-left">
        Accountable Form No. 51-C<br>
        Revised January, 1992
      </div>
      <div class="top-meta-right">(ORIGINAL)</div>
    </div>

    <!-- Header -->
    <div class="receipt-header">
      <img src="{$logoSrc}" alt="LCC Seal" />
      <div class="receipt-header-text">
        <div class="official">Official Receipt</div>
        <div class="republic">of the Republic of the Philippines</div>
        <div class="no-value">No. {$receiptNo}</div>
      </div>
    </div>

    <!-- Date / Agency / Payor -->
    <div class="receipt-meta">
      <table>
        <tr>
          <td class="meta-label">Date</td>
          <td class="meta-val" colspan="3">{$date}</td>
        </tr>
        <tr>
          <td class="meta-label">Agency</td>
          <td class="meta-val" colspan="3">CTO — LA CARLOTA CITY</td>
        </tr>
        <tr>
          <td class="meta-label">Payor</td>
          <td class="meta-val" colspan="3">{$payorName}</td>
        </tr>
      </table>
    </div>

    <!-- Fee table -->
    <table class="fee-table">
      <thead>
        <tr>
          <th>Nature of Collection</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {$feeRowsHtml}
      </tbody>
    </table>

    <!-- Total -->
    <div class="total-row">
      <span>TOTAL</span>
      <span>₱ {$totalDisplay}</span>
    </div>

    <!-- Amount in words -->
    <div class="words-row">
      <span class="words-label">Amount in Words</span>
      <span class="words-val">{$totalWords}</span>
    </div>

    <!-- Payment method -->
    <div class="method-row">
      <div class="method-item">
        <span class="method-check">{$cashChecked}</span>
        <span>Cash</span>
      </div>
      <div class="method-item">
        <span class="method-check">{$checkChecked}</span>
        <span>Check</span>
      </div>
      <div class="method-item">
        <span class="method-check">{$walletChecked}</span>
        <span>{$walletLabel}</span>
      </div>
    </div>

    <!-- Date -->
    <div class="drawee-row">
    </div>

    <!-- Received -->
    <div class="received-row">Received the amount stated above.</div>

    <!-- Signature -->
    <div class="sig-row">
      <div class="sig-line">
        {$collectingSigImg}
        {$collectingOfficer}<br>
        {$collectingTitle}
      </div>
    </div>

    <!-- Note -->
    <div class="note-row">
      NOTE: Write the number and date of this receipt on the back of check or money order received.
    </div>

  </div>
</div>

{$downloadBar}
{$downloadScript}
</body>
</html>
HTML;
}

// ── Number to words helper ────────────────────────────────────
function _numberToWords(float $amount): string {
    $amount   = round($amount, 2);
    $pesos    = (int)floor($amount);
    $centavos = (int)round(($amount - $pesos) * 100);

    $words = _intToWords($pesos) . ' Peso' . ($pesos !== 1 ? 's' : '');
    if ($centavos > 0) {
        $words .= ' and ' . _intToWords($centavos) . ' Centavo' . ($centavos !== 1 ? 's' : '');
    }
    return $words . ' Only';
}

function _intToWords(int $n): string {
    if ($n === 0) return 'Zero';
    $ones  = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
              'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
              'Seventeen','Eighteen','Nineteen'];
    $tens  = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    if ($n < 20)  return $ones[$n];
    if ($n < 100) return $tens[(int)($n/10)] . ($n % 10 ? ' ' . $ones[$n % 10] : '');
    if ($n < 1000) return $ones[(int)($n/100)] . ' Hundred' . ($n % 100 ? ' ' . _intToWords($n % 100) : '');
    if ($n < 1000000) return _intToWords((int)($n/1000)) . ' Thousand' . ($n % 1000 ? ' ' . _intToWords($n % 1000) : '');
    return _intToWords((int)($n/1000000)) . ' Million' . ($n % 1000000 ? ' ' . _intToWords($n % 1000000) : '');
}
