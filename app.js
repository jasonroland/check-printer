/* ============================================================
   BUSINESS CHECK PRINTER — Application Logic
   ============================================================ */

'use strict';

// ── MICR E-13B symbol mapping ─────────────────────────────
// Unicode E-13B characters (U+2446–U+2449)
// ⑆ = Transit (routing) symbol
// ⑇ = Amount symbol
// ⑈ = On-Us symbol (account/check num separator)
// ⑉ = Dash symbol

const MICR = {
  transit: 'A',  // transit/routing delimiter
  amount:  'C',  // amount symbol
  onUs:    'B',  // on-us delimiter
  dash:    'D',  // dash
};

// MICR line format for personal/business checks:
//   ⑆RoutingNum⑆  AccountNum  ⑈  CheckNumber  ⑈
function buildMICR(routing, account, checkNum) {
  const r = routing.replace(/\D/g, '').padEnd(9, '0').slice(0, 9);
  const a = account.replace(/\D/g, '');
  const n = String(checkNum).padStart(4, '0');
  // Business check format: check# first (Auxiliary On-Us), then routing, then account
  return `${MICR.amount}${n}${MICR.amount}  ${MICR.transit}${r}${MICR.transit}  ${a}${MICR.amount}`;
}

// ── Dollar-amount to written words ───────────────────────
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen',
  'Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function hundreds(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n/10)] + (n%10 ? '-'+ONES[n%10] : '');
  return ONES[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+hundreds(n%100) : '');
}

function toWords(amount) {
  if (!amount || isNaN(amount) || amount <= 0) return 'Zero Dollars and 00/100';
  const cents = Math.round(amount * 100) % 100;
  const dollars = Math.floor(amount);
  const centsStr = String(cents).padStart(2,'0');
  if (dollars === 0) return `Zero Dollars and ${centsStr}/100`;

  const MAGNITUDES = ['', ' Thousand', ' Million', ' Billion'];
  let parts = [];
  let n = dollars;
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(hundreds(chunk) + MAGNITUDES[i]);
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(', ') + ` Dollars and ${centsStr}/100`;
}

// ── Date formatting ───────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Amount formatting ─────────────────────────────────────
function formatAmount(val) {
  if (!val) return '0.00';
  return parseFloat(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Fractional routing number (ABA fraction) ──────────────
// Format: XX-YYYY/ZZZZ  (simplified display)
function buildFractional(routing) {
  const r = routing.replace(/\D/g, '');
  if (r.length < 9) return '';
  const prefix = r.slice(0,4);
  const suffix = r.slice(4,8);
  const check  = r[8];
  return `${prefix.slice(0,2)}-${prefix.slice(2)}/${suffix}`;
}

// ── Get form values ───────────────────────────────────────
function getValues() {
  return {
    companyName: document.getElementById('companyName').value.trim(),
    address1:    document.getElementById('address1').value.trim(),
    address2:    document.getElementById('address2').value.trim(),
    phone:       document.getElementById('phone').value.trim(),
    bankName:    document.getElementById('bankName').value.trim(),
    routingNum:  document.getElementById('routingNum').value.trim(),
    accountNum:  document.getElementById('accountNum').value.trim(),
    checkNum:    document.getElementById('checkNum').value.trim(),
    payee:       document.getElementById('payee').value.trim(),
    amount:      document.getElementById('amount').value,
    checkDate:   document.getElementById('checkDate').value,
    memo:        document.getElementById('memo').value.trim(),
    sigLabel:    document.getElementById('sigLabel').value.trim() || 'Authorized Signature',
  };
}

// ── Render check HTML ─────────────────────────────────────
// The check is rendered with inline styles so it works both
// in the screen preview and in the print iframe.
// Screen: 1in = 96px  |  Print: resolved by @page in CSS
// We use class names for print CSS overrides and inline px for screen.

function renderCheck(v) {
  const micrLine  = buildMICR(v.routingNum, v.accountNum, v.checkNum);
  const written   = toWords(parseFloat(v.amount));
  const dateStr   = formatDate(v.checkDate);
  const amtFmt    = formatAmount(v.amount);
  const fracRoute = buildFractional(v.routingNum);
  const checkN    = String(v.checkNum).padStart(4,'0');

  const addrLines = [v.address1, v.address2].filter(Boolean).join('<br/>');
  const phoneStr  = v.phone ? `<br/>${v.phone}` : '';

  // Screen-px positions (96dpi)
  // Check = 768px wide × 312px tall on screen (3.25")
  // Top separator: ~68px, Date: ~72px, Pay to: ~100px,
  // Written: ~130px, Mid sep: ~154px, Bottom: ~164px, MICR: ~290px

  return `
<div class="check">

  <!-- Company info (top left) -->
  <div style="position:absolute;top:10px;left:18px;right:165px;z-index:1;">
    <div class="check-company-name" style="font-size:17px;">${escHtml(v.companyName) || '<span style="color:#000;">Your Company Name</span>'}</div>
    <div class="check-company-address" style="font-size:10px;line-height:1.5;">${addrLines || '123 Main Street<br/>City, State ZIP'}${phoneStr}</div>
  </div>

  <!-- Check number (top right) -->
  <div class="check-number" style="position:absolute;top:10px;right:18px;z-index:1;font-size:13px;">
    <span style="font-size:9px;color:#000;font-family:inherit;margin-right:3px;font-weight:400;">NO.</span>${checkN}
  </div>

  <!-- Bank name (top right) -->
  <div style="position:absolute;top:30px;right:18px;text-align:right;z-index:1;">
    <div class="check-bank-name" style="font-size:11px;">${escHtml(v.bankName) || '<span style="color:#000;">Bank Name</span>'}</div>
    ${fracRoute ? `<div class="check-bank-sub" style="font-size:9px;">${fracRoute}</div>` : ''}
  </div>

  <!-- Date line -->
  <div style="position:absolute;top:62px;right:18px;display:flex;align-items:baseline;gap:8px;z-index:1;">
    <label style="font-size:10px;color:#000;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Date</label>
    <div style="font-size:13px;color:#1a1612;border-bottom:1.5px solid #000;min-width:130px;padding-bottom:2px;text-align:right;">${escHtml(dateStr) || '&nbsp;'}</div>
  </div>

  <!-- Pay to the order of -->
  <div style="position:absolute;top:88px;left:18px;right:18px;display:flex;align-items:baseline;z-index:1;">
    <label style="font-size:9px;color:#000;white-space:nowrap;margin-right:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;flex-shrink:0;">Pay to the Order of</label>
    <div style="flex:1;font-size:14px;color:#1a1612;font-weight:600;border-bottom:1.5px solid #000;padding-bottom:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(v.payee) || '&nbsp;'}</div>
    <div style="margin-left:14px;border:2px solid #000;border-radius:2px;padding:3px 10px 3px 20px;min-width:120px;text-align:right;font-size:14px;font-weight:700;color:#1a1612;font-family:'Courier New',monospace;position:relative;flex-shrink:0;">
      <span style="position:absolute;left:6px;font-size:10px;font-weight:400;top:50%;transform:translateY(-50%);color:#000;font-family:inherit;">$</span>${escHtml(amtFmt)}
    </div>
  </div>

  <!-- Written amount -->
  <div style="position:absolute;top:124px;left:18px;right:18px;display:flex;align-items:baseline;z-index:1;">
    <div style="flex:1;font-size:13px;color:#1a1612;border-bottom:1.5px solid #000;padding-bottom:3px;font-style:italic;">${escHtml(written)}</div>
    <div style="font-size:10px;color:#000;white-space:nowrap;margin-left:6px;padding-bottom:3px;">DOLLARS</div>
  </div>

  <!-- Memo + signature -->
  <div style="position:absolute;top:180px;left:18px;right:18px;display:flex;align-items:flex-end;justify-content:space-between;z-index:1;">
    <div>
      <div style="font-size:9px;color:#000;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;font-weight:600;">Memo</div>
      <div style="font-size:12px;color:#000;border-bottom:1.5px solid #000;padding-bottom:3px;min-width:180px;max-width:260px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(v.memo) || '&nbsp;'}</div>
    </div>
    <div style="text-align:right;min-width:210px;">
      <div style="border-bottom:2px solid #000;margin-bottom:3px;height:20px;"></div>
      <div style="font-size:9px;color:#000;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">${escHtml(v.sigLabel)}</div>
    </div>
  </div>

  <!-- MICR Line -->
  <div style="position:absolute;bottom:18px;left:14px;right:14px;z-index:2;">
    <div class="micr-text">${micrLine}</div>
  </div>

</div>`;
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Build & inject preview ────────────────────────────────
function updatePreview() {
  const v = getValues();
  document.getElementById('checkOut').innerHTML = renderCheck(v);
}

// ── Print ─────────────────────────────────────────────────
function printCheck() {
  const v = getValues();
  const checkHtml = renderCheck(v);
  const style = document.getElementById('printStyles').innerHTML;

  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Check #${v.checkNum}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
${style}
</style>
</head>
<body class="print-body">
<div class="print-page">
  ${checkHtml}
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(doc);
  win.document.close();

  win.document.fonts.ready.then(() => {
    win.print();
    win.close();
  });
}

// ── Zoom ──────────────────────────────────────────────────
let zoom = 1.0;

function setZoom(val) {
  zoom = Math.max(0.4, Math.min(2.0, val));
  document.getElementById('checkWrapper').style.transform = `scale(${zoom})`;
  document.getElementById('zoomVal').textContent = Math.round(zoom * 100) + '%';
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date as default
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('checkDate').value = today;

  // Live update on any input change
  const form = document.getElementById('checkForm');
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  document.getElementById('btnPreview').addEventListener('click', updatePreview);
  document.getElementById('btnPrint').addEventListener('click', printCheck);

  document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom + 0.1));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom - 0.1));

  // Initial render
  updatePreview();
});
