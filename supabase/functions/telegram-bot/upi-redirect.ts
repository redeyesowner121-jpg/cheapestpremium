// ===== UPI REDIRECT HTML PAGE (GET handler) =====
// Standalone HTML page that opens UPI app or shows QR fallback.

import { corsHeaders, UPI_ID, UPI_NAME } from "./constants.ts";

export function handleUpiRedirect(url: URL): Response {
  const pa = url.searchParams.get("pa") || UPI_ID;
  const pn = url.searchParams.get("pn") || UPI_NAME;
  const am = url.searchParams.get("am") || "0";
  const cu = url.searchParams.get("cu") || "INR";
  const tn = (url.searchParams.get("tn") || "Payment").slice(0, 80);
  const upiUrl = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${encodeURIComponent(am)}&cu=${encodeURIComponent(cu)}&tn=${encodeURIComponent(tn)}`;
  const qrUrl = `https://quickchart.io/qr?size=320&text=${encodeURIComponent(upiUrl)}`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Open UPI Payment</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f8; margin: 0; padding: 24px; color: #111827; }
      .card { max-width: 420px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 10px 28px rgba(0,0,0,0.08); padding: 20px; text-align: center; }
      .btn { display: inline-block; margin-top: 12px; padding: 12px 16px; border-radius: 10px; text-decoration: none; font-weight: 600; }
      .btn-primary { background: #111827; color: white; }
      .btn-secondary { background: #e5e7eb; color: #111827; }
      .hint { font-size: 13px; color: #6b7280; margin-top: 10px; }
      img { width: 220px; height: 220px; border-radius: 12px; margin-top: 12px; }
      #fallback { display: none; margin-top: 14px; }
      code { word-break: break-all; font-size: 12px; display: block; margin-top: 10px; background: #f3f4f6; padding: 10px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Opening UPI app…</h2>
      <p class="hint">If your app doesn't open automatically, use the button below or scan QR.</p>
      <div id="fallback">
        <a class="btn btn-primary" href="${upiUrl}">💳 Open UPI App</a><br/>
        <a class="btn btn-secondary" href="#" onclick="copyUpi(event)">📋 Copy UPI Link</a>
        <img src="${qrUrl}" alt="UPI QR Code" />
        <code id="upiText">${upiUrl}</code>
      </div>
    </div>
    <script>
      const upiUrl = ${JSON.stringify("" + upiUrl)};
      const fallbackEl = document.getElementById('fallback');
      setTimeout(() => { window.location.href = upiUrl; }, 50);
      setTimeout(() => { if (fallbackEl) fallbackEl.style.display = 'block'; }, 1200);
      function copyUpi(e) {
        e.preventDefault();
        if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(upiUrl); alert('UPI link copied'); return; }
        const temp = document.createElement('textarea'); temp.value = upiUrl; document.body.appendChild(temp); temp.select(); document.execCommand('copy'); document.body.removeChild(temp); alert('UPI link copied');
      }
      window.copyUpi = copyUpi;
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
