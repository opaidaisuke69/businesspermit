<?php
// ============================================================
// Permit HTML Generator — Market Peddlers Permit + Sanitary Permit
// ============================================================

require_once __DIR__ . '/signatories.php';

// ── Shared data prep ─────────────────────────────────────────
function _permitData(array $p): array {
    $year        = date('Y', strtotime($p['issued_date']));
    $issuedShort = date('m/d/Y', strtotime($p['issued_date']));
    $expiryShort = date('m/d/Y', strtotime($p['expiry_date']));
    $isMobile    = isset($_GET['source']) && $_GET['source'] === 'mobile';

    $logoPath = __DIR__ . '/../logo.png';
    $logoSrc  = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : '';

    $dohPath = __DIR__ . '/../DOH.png';
    $dohSrc  = file_exists($dohPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($dohPath)) : '';

    $hallPath = __DIR__ . '/../../global-assets/images/hall.png';
    $hallSrc  = file_exists($hallPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($hallPath)) : '';

    $pmLogoPath = __DIR__ . '/../../global-assets/images/publicmarket-logo.png';
    $pmLogoSrc  = file_exists($pmLogoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($pmLogoPath)) : '';

    $permitNum = $p['permit_number'];
    $yy        = substr($permitNum, 0, 2);

    $locationAddress = !empty($p['location_name'])
        ? $p['location_name'] . (!empty($p['location_description']) ? ', ' . $p['location_description'] : '')
        : ($p['address'] ?? '');

    srand(crc32($permitNum . 'sp'));
    $spSuffix  = str_pad((string)(rand(0, 999999)), 6, '0', STR_PAD_LEFT);
    $permitNum2 = $yy . '-' . $spSuffix;

    srand(crc32($permitNum . 'or'));
    $orNum = str_pad((string)(rand(0, 9999)), 4, '0', STR_PAD_LEFT);

    return compact('year','issuedShort','expiryShort','isMobile','logoSrc','dohSrc','hallSrc','pmLogoSrc','permitNum','yy','locationAddress','permitNum2','orNum');
}

function _downloadBar(string $filename, bool $isMobile): array {
    if ($isMobile) return ['',''];
    $bar    = '<div class="no-print" style="text-align:center;padding:16px;background:#f5f5f5"><button onclick="downloadPDF()" style="background:linear-gradient(135deg,#073B3A,#0B6E4F);color:#fff;border:none;border-radius:12px;padding:14px 36px;font-size:15px;font-weight:bold;cursor:pointer;font-family:Arial,sans-serif">⬇ Download as PDF</button></div>';
    $script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script><script>function downloadPDF(){var btn=document.querySelector(".no-print");btn.style.display="none";html2pdf().set({margin:0,filename:"' . $filename . '.pdf",image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true,width:794,windowWidth:794,scrollX:0,scrollY:0,x:0,y:0},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["avoid-all","css","legacy"]}}).from(document.getElementById("permits-wrap")).toPdf().get("pdf").then(function(pdf){}).save().then(function(){btn.style.display="block";});}</script>';
    return [$bar, $script];
}

// ── Market Peddlers Permit only ──────────────────────────────
function generateMPPHTML(array $p): string {
    $db = getDB();
    $sig = getSignatories($db);
    $mayorName      = $sig['city_mayor']['person_name'];
    $mayorTitle     = $sig['city_mayor']['credentials'];
    $mayorSig       = $sig['city_mayor']['signature_url'] ?? '';
    $budgetOfficer  = $sig['city_budget_officer']['person_name'];
    $budgetTitle    = $sig['city_budget_officer']['credentials'];
    $budgetSig      = $sig['city_budget_officer']['signature_url'] ?? '';

    // Signature img tags — shown above name, no spacer when empty
    $mayorSigImg  = $mayorSig  ? "<img src=\"{$mayorSig}\"  style=\"height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto 0;\" alt=\"\" />" : '';
    $budgetSigImg = $budgetSig ? "<img src=\"{$budgetSig}\" style=\"height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto 0;\" alt=\"\" />" : '';

    extract(_permitData($p));
    [$downloadBar, $downloadScript] = _downloadBar("MPP-{$permitNum}", $isMobile);
    $expiryFull  = date('F d, Y', strtotime($p['expiry_date']));

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Market Peddlers Permit — {$permitNum}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #f0f0f0; }
#permits-wrap { width: 794px; margin: 0 auto; background: #fff; }

/* ── PAGE BREAK ── */
.page { width: 794px; min-height: 1050px; background: #fff; position: relative; display: flex; flex-direction: column; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: avoid; break-after: avoid; }
.page-sp { min-height: 1400px; }

/* ══════════════════════════════════════════════
   MARKET PEDDLERS PERMIT
══════════════════════════════════════════════ */
.mpp { border: 3px solid #000; margin: 20px; padding: 0; }
.mpp-inner { border: 1.5px solid #000; margin: 6px; padding: 0; }

.mpp-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 20px 10px; border-bottom: 2px solid #000; }
.mpp-header-center { flex: 1; text-align: center; }
.mpp-header-center .republic { font-size: 11px; font-weight: bold; letter-spacing: 1px; }
.mpp-header-center .city { font-size: 18px; font-weight: 900; letter-spacing: 1px; margin: 2px 0; }
.mpp-header-center .office { font-size: 10px; }
.mpp-header-center .address { font-size: 10px; color: #333; }
.mpp-badge { background: #f5a623; border: 2px solid #c8860a; border-radius: 4px; padding: 6px 10px; text-align: center; width: 90px; flex-shrink: 0; }
.mpp-badge-text { font-size: 9px; font-weight: 900; color: #000; line-height: 1.3; text-transform: uppercase; }
.mpp-seal { width: 100px; height: 100px; object-fit: contain; flex-shrink: 0; }

.mpp-title { text-align: center; padding: 10px 20px 4px; }
.mpp-title h1 { font-size: 26px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; display: inline-block; padding-bottom: 2px; }

.mpp-issued { text-align: center; font-size: 11px; font-weight: bold; padding: 4px 0 2px; letter-spacing: 1px; }

.mpp-name { text-align: center; padding: 6px 20px 0; }
.mpp-name .name-val { font-size: 20px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }

.mpp-biz { text-align: center; padding: 0 20px; }
.mpp-biz .biz-label { font-size: 10px; font-style: italic; color: #333; margin-bottom: 4px; }
.mpp-biz .biz-val { font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }

.mpp-section { text-align: center; padding: 0 20px; }
.mpp-section .sec-label { font-size: 10px; font-style: italic; color: #333; margin-bottom: 4px; }
.mpp-section .sec-val { font-size: 15px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }

.mpp-details { display: flex; justify-content: space-between; padding: 12px 24px 8px; margin-top: 10px; }
.mpp-detail-item { text-align: center; }
.mpp-detail-item .d-val { font-size: 13px; font-weight: bold; padding-bottom: 2px; min-width: 80px; display: inline-block; }
.mpp-detail-item .d-label { font-size: 9px; font-style: italic; color: #333; margin-top: 2px; }

.mpp-conditions { padding: 8px 40px; font-size: 13px; font-style: italic; line-height: 1.6; text-indent: 2em; margin-top: 16px; }

.mpp-approval { padding: 10px 24px 14px; display: flex; justify-content: space-between; align-items: flex-end; }
.mpp-approved-by { }
.mpp-approved-by .approved-label { font-size: 10px; font-weight: bold; }
.mpp-approved-by .approved-name { font-size: 13px; font-weight: 900; text-transform: uppercase; margin-top: 4px; }
.mpp-approved-by .approved-title { font-size: 10px; font-style: italic; }
.mpp-approved-by .approved-auth { font-size: 9px; color: #333; margin-top: 6px; }
.mpp-approved-by .approved-eo { font-size: 9px; color: #333; }
.mpp-approved-by .approved-admin { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-top: 4px; }
.mpp-approved-by .approved-admin-title { font-size: 9px; font-style: italic; }
.mpp-qr { text-align: center; }
.mpp-qr img { width: 70px; height: 70px; border: 1px solid #ccc; }
.mpp-qr-label { font-size: 8px; color: #666; margin-top: 2px; }

/* ══════════════════════════════════════════════
   SANITARY PERMIT TO OPERATE
══════════════════════════════════════════════ */
.sp { border: 4px solid #2a7a8c; margin: 20px; padding: 0; position: relative; }
.sp-inner { border: 2px solid #2a7a8c; margin: 6px; padding: 0; }

/* Watermark */
.sp-watermark { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); opacity: 0.06; z-index: 0; pointer-events: none; }
.sp-watermark img { width: 500px; height: 500px; object-fit: contain; }

.sp-content { position: relative; z-index: 1; }

.sp-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 10px; border-bottom: 2px solid #2a7a8c; }
.sp-header-center { flex: 1; text-align: center; }
.sp-header-center .republic { font-size: 11px; font-weight: bold; letter-spacing: 1px; }
.sp-header-center .facility { font-size: 13px; font-weight: 900; letter-spacing: 0.5px; margin: 2px 0; }
.sp-header-center .address { font-size: 10px; color: #333; }
.sp-doh { width: 110px; height: 110px; object-fit: contain; flex-shrink: 0; }
.sp-seal { width: 110px; height: 110px; object-fit: contain; flex-shrink: 0; }

.sp-title { text-align: center; padding: 14px 20px 6px; }
.sp-title h1 { font-size: 28px; font-weight: 900; color: #1a6a7a; letter-spacing: 2px; text-transform: uppercase; }

.sp-issued { text-align: center; font-size: 11px; font-weight: bold; padding: 2px 0 4px; letter-spacing: 1px; }

.sp-name { text-align: center; padding: 6px 20px 0; }
.sp-name .name-val { font-size: 20px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }

.sp-reg { text-align: center; padding: 6px 20px 0; }
.sp-reg .reg-val { font-size: 15px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }
.sp-reg .reg-label { font-size: 10px; font-style: italic; color: #333; margin-top: 2px; }

.sp-address { text-align: center; padding: 6px 20px 0; }
.sp-address .addr-val { font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }
.sp-address .addr-label { font-size: 10px; font-style: italic; color: #333; margin-top: 2px; }

.sp-details { display: flex; justify-content: space-between; padding: 12px 24px 8px; margin-top: 20px; }
.sp-detail-item { text-align: center; }
.sp-detail-item .d-val { font-size: 13px; font-weight: bold; border-bottom: 1.5px solid #000; padding-bottom: 2px; min-width: 80px; display: inline-block; }
.sp-detail-item .d-label { font-size: 9px; font-style: italic; color: #333; margin-top: 2px; }

.sp-conditions { padding: 8px 40px; font-size: 12px; font-style: italic; line-height: 1.6; text-align: center; text-indent: 2em; margin-top: 16px; }

.sp-approval { padding: 10px 24px 24px; }
.sp-approval-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8px; }
.sp-sig-block { text-align: left; }
.sp-sig-block .sig-label { font-size: 10px; font-weight: bold; text-align: left; }
.sp-sig-block .sig-name { font-size: 13px; font-weight: 900; text-transform: uppercase; padding-top: 4px; }
.sp-sig-block .sig-title { font-size: 10px; font-style: italic; }

.sp-building { width: 100%; height: 160px; overflow: hidden; margin-top: -40px; }
.sp-building img { width: 100%; height: 100%; object-fit: cover; object-position: center top; opacity: 0.12; display: block; }

@media print {
  body { background: #fff; }
  .no-print { display: none !important; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
}
@page { size: A4; margin: 0; }
</style>
</head>
<body>
<div id="permits-wrap">

<!-- ══════════════════════════════════════════════
     PAGE 1: MARKET PEDDLERS PERMIT
══════════════════════════════════════════════ -->
<div class="page">
  <div class="mpp">
    <div class="mpp-inner">

      <!-- Header -->
      <div class="mpp-header">
        <img src="{$logoSrc}" alt="LCC Seal" class="mpp-seal" />
        <div class="mpp-header-center">
          <div class="republic">REPUBLIC OF THE PHILIPPINES</div>
          <div class="city">CITY OF LA CARLOTA</div>
          <div class="office">OPERATION OF PUBLIC MARKET OFFICE</div>
          <div class="address">La Carlota City, Negros Occidental, 6130</div>
        </div>
        <img src="{$pmLogoSrc}" alt="Public Market" style="width:90px;height:90px;object-fit:contain;flex-shrink:0;" />
      </div>

      <!-- Title -->
      <div class="mpp-title">
        <h1>MARKET PEDDLERS PERMIT {$year}</h1>
      </div>

      <!-- Issued to -->
      <div class="mpp-issued">ISSUED TO</div>

      <!-- Name — no label, just the value -->
      <div class="mpp-name">
        <div class="name-val">{$p['holder_name']}</div>
      </div>

      <!-- Business type — label on top, value below -->
      <div class="mpp-biz" style="margin-top:12px;">
        <div class="biz-label">Registered Name</div>
        <div class="biz-val">{$p['business_name']}</div>
      </div>

      <!-- Business section — label on top, value below -->
      <div class="mpp-section" style="margin-top:12px;">
        <div class="sec-label">Nature of Business</div>
        <div class="sec-val">{$p['business_type']}</div>
      </div>

      <!-- Details label on top -->
      <div style="text-align:center;font-size:10px;font-style:italic;color:#333;margin-top:12px;margin-bottom:2px;">Business Section</div>

      <!-- Details row -->
      <div class="mpp-details">
        <div class="mpp-detail-item">
          <div class="d-val">{$permitNum}</div>
          <div class="d-label">Permit No.</div>
        </div>
        <div class="mpp-detail-item">
          <div class="d-val">{$orNum}</div>
          <div class="d-label">OR Number</div>
        </div>
        <div class="mpp-detail-item">
          <div class="d-val">{$issuedShort}</div>
          <div class="d-label">Date Issued</div>
        </div>
        <div class="mpp-detail-item">
          <div class="d-val">{$expiryShort}</div>
          <div class="d-label">Valid Until</div>
        </div>
      </div>

      <!-- Conditions -->
      <div class="mpp-conditions">
        This permit is non transferable and subject to revocation or cancellation in case of violation of any rules, regulations and ordinances governing the operation of the above activity/activities.
      </div>

      <!-- Approval -->
      <div style="padding:16px 24px 20px;">

        <!-- Mayor -->
        <div style="position:relative;text-align:center;margin-bottom:4px;">
          <div style="position:absolute;left:0;top:0;font-size:12px;font-weight:bold;">Approved:</div>
          {$mayorSigImg}
          <div style="font-size:15px;font-weight:900;text-transform:uppercase;">{$mayorName}</div>
        </div>
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:12px;font-style:italic;">{$mayorTitle}</div>
          <div style="font-size:10px;color:#333;margin-top:4px;">by the Authority of the Local Chief Executive</div>
          <div style="font-size:10px;color:#333;">E.O.-01 Series of 2022</div>
        </div>

        <!-- Budget Officer -->
        <div style="text-align:center;">
          {$budgetSigImg}
          <div style="font-size:15px;font-weight:900;text-transform:uppercase;">{$budgetOfficer}</div>
          <div style="font-size:12px;font-style:italic;">{$budgetTitle}</div>
        </div>
      </div>

    </div>
  </div>
</div>

</div><!-- #permits-wrap -->

{$downloadBar}
{$downloadScript}
</body>
</html>
HTML;
}

// ── Sanitary Permit only ─────────────────────────────────────
function generateSPHTML(array $p): string {
    $db = getDB();
    $sig = getSignatories($db);
    $sanitationName  = $sig['sanitation_inspector']['person_name'];
    $sanitationTitle = $sig['sanitation_inspector']['credentials'];
    $sanitationSig   = $sig['sanitation_inspector']['signature_url'] ?? '';
    $healthName      = $sig['city_health_officer']['person_name'];
    $healthTitle     = $sig['city_health_officer']['credentials'];
    $healthSig       = $sig['city_health_officer']['signature_url'] ?? '';

    $sanitationSigImg = $sanitationSig ? "<img src=\"{$sanitationSig}\" style=\"height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto 0;\" alt=\"\" />" : '';
    $healthSigImg     = $healthSig     ? "<img src=\"{$healthSig}\"     style=\"height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto 0;\" alt=\"\" />" : '';

    extract(_permitData($p));
    [$downloadBar, $downloadScript] = _downloadBar("SP-{$permitNum2}", $isMobile);

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sanitary Permit — {$permitNum2}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #f0f0f0; }
#permits-wrap { width: 794px; margin: 0 auto; background: #fff; }
.page { width: 794px; min-height: 1050px; background: #fff; position: relative; display: flex; flex-direction: column; }
.page-sp { min-height: 1050px; max-height: 1123px; overflow: hidden; }
.sp { border: 4px solid #2a7a8c; margin: 20px; padding: 0; position: relative; }
.sp-inner { border: 2px solid #2a7a8c; margin: 6px; padding: 0; }
.sp-watermark { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); opacity: 0.06; z-index: 0; pointer-events: none; }
.sp-watermark img { width: 380px; height: 380px; object-fit: contain; }
.sp-content { position: relative; z-index: 1; }
.sp-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 10px; border-bottom: 2px solid #2a7a8c; }
.sp-header-center { flex: 1; text-align: center; }
.sp-header-center .republic { font-size: 11px; font-weight: bold; letter-spacing: 1px; }
.sp-header-center .facility { font-size: 13px; font-weight: 900; letter-spacing: 0.5px; margin: 2px 0; }
.sp-header-center .address { font-size: 10px; color: #333; }
.sp-doh { width: 110px; height: 110px; object-fit: contain; flex-shrink: 0; }
.sp-seal { width: 110px; height: 110px; object-fit: contain; flex-shrink: 0; }
.sp-title { text-align: center; padding: 14px 20px 6px; }
.sp-title h1 { font-size: 28px; font-weight: 900; color: #1a6a7a; letter-spacing: 2px; text-transform: uppercase; }
.sp-issued { text-align: center; font-size: 11px; font-weight: bold; padding: 2px 0 4px; letter-spacing: 1px; }
.sp-name { text-align: center; padding: 6px 20px 0; }
.sp-name .name-val { font-size: 20px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }
.sp-reg { text-align: center; padding: 6px 20px 0; }
.sp-reg .reg-val { font-size: 15px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }
.sp-reg .reg-label { font-size: 10px; font-style: italic; color: #333; margin-top: 2px; }
.sp-address { text-align: center; padding: 6px 20px 0; }
.sp-address .addr-val { font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #000; display: block; width: 60%; margin: 0 auto; padding-bottom: 2px; }
.sp-address .addr-label { font-size: 10px; font-style: italic; color: #333; margin-top: 2px; }
.sp-details { display: flex; justify-content: space-between; padding: 12px 24px 8px; margin-top: 20px; }
.sp-detail-item { text-align: center; }
.sp-detail-item .d-val { font-size: 13px; font-weight: bold; border-bottom: 1.5px solid #000; padding-bottom: 2px; min-width: 80px; display: inline-block; }
.sp-detail-item .d-label { font-size: 9px; font-style: italic; color: #333; margin-top: 2px; }
.sp-conditions { padding: 8px 40px; font-size: 12px; font-style: italic; line-height: 1.6; text-align: center; text-indent: 2em; margin-top: 16px; }
.sp-approval { padding: 10px 24px 24px; }
.sp-sig-block { text-align: left; }
.sp-sig-block .sig-label { font-size: 10px; font-weight: bold; text-align: left; }
.sp-sig-block .sig-name { font-size: 13px; font-weight: 900; text-transform: uppercase; padding-top: 4px; }
.sp-sig-block .sig-title { font-size: 10px; font-style: italic; }
.sp-building { width: 100%; height: 160px; overflow: hidden; margin-top: -40px; }
.sp-building img { width: 100%; height: 100%; object-fit: cover; object-position: center top; opacity: 0.12; display: block; }
.sp-content { position: relative; z-index: 1; }
@media print { body { background: #fff; } .no-print { display: none !important; } }
@page { size: A4; margin: 0; }
</style>
</head>
<body>
<div id="permits-wrap">
<div class="page page-sp">
  <div class="sp">
    <div class="sp-watermark"><img src="{$dohSrc}" alt="" /></div>
    <div class="sp-inner">
      <div class="sp-content">
        <div class="sp-header">
          <img src="{$dohSrc}" alt="DOH" class="sp-doh" />
          <div class="sp-header-center">
            <div class="republic">REPUBLIC OF THE PHILIPPINES</div>
            <div class="facility">LA CARLOTA PRIMARY CARE FACILITY I</div>
            <div class="address">City of La Carlota, Negros Occidental, 6130</div>
          </div>
          <img src="{$logoSrc}" alt="LCC Seal" class="sp-seal" />
        </div>
        <div class="sp-title"><h1>SANITARY PERMIT TO OPERATE</h1></div>
        <div class="sp-issued">ISSUED TO</div>
        <div class="sp-name"><div class="name-val">{$p['holder_name']}</div></div>
        <div class="sp-reg" style="margin-top:8px;">
          <div class="reg-val">{$p['business_name']}</div>
          <div class="reg-label">Registered Name</div>
        </div>
        <div class="sp-reg" style="margin-top:8px;">
          <div class="reg-val">PEDDLERS</div>
          <div class="reg-label">Name &amp; Type of Establishment</div>
        </div>
        <div class="sp-address" style="margin-top:8px;">
          <div class="addr-val">{$locationAddress}</div>
          <div class="addr-label">Address of Business</div>
        </div>
        <div class="sp-details">
          <div class="sp-detail-item"><div class="d-val">{$permitNum2}</div><div class="d-label">Sanitary Permit No.</div></div>
          <div class="sp-detail-item"><div class="d-val">{$issuedShort}</div><div class="d-label">Date Issued</div></div>
          <div class="sp-detail-item"><div class="d-val">{$expiryShort}</div><div class="d-label">Date of Expiration</div></div>
        </div>
        <div class="sp-conditions">This permit is non-transferable and will be revoked for violation of the Sanitary Rules, Law or Regulation of P.D. 522, P.D. 856 and Pertinent Local Ordinances.</div>
        <div class="sp-approval">
          <div style="font-size:10px;font-weight:bold;">Recommending Approval:</div>
          <div style="text-align:center;margin-top:8px;margin-bottom:8px;">
            {$sanitationSigImg}
            <div style="font-size:13px;font-weight:900;text-transform:uppercase;">{$sanitationName}</div>
            <div style="font-size:10px;font-style:italic;">{$sanitationTitle}</div>
          </div>
          <div style="font-size:10px;font-weight:bold;margin-top:16px;">Approved:</div>
          <div style="text-align:center;margin-top:8px;">
            {$healthSigImg}
            <div style="font-size:13px;font-weight:900;text-transform:uppercase;">{$healthName}</div>
            <div style="font-size:10px;font-style:italic;">{$healthTitle}</div>
          </div>
        </div>
      </div>
      <div class="sp-building"><img src="{$hallSrc}" alt="" /></div>
    </div>
  </div>
</div>
</div>
{$downloadBar}
{$downloadScript}
</body>
</html>
HTML;
}

// ── Combined (kept for backward compat) ──────────────────────
function generatePermitHTML(array $p): string {
    return generateMPPHTML($p) . "\n" . generateSPHTML($p);
}

