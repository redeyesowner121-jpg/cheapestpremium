// Send order status email via SMTP (primary) with Resend fallback + admin alerts on failure
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getActiveSmtpConfig, sendViaSmtp } from "../_shared/smtp-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Cheapest Premiums <support@cheapest-premiums.in>';
const FALLBACK_FROM = 'Cheapest Premiums <onboarding@resend.dev>';
const ADMIN_ALERT_EMAIL = 'red.eyes.owner121@gmail.com';

interface Payload {
  to: string;
  customerName?: string;
  productName: string;
  orderId: string;
  status: string;
  totalPrice?: number;
  accessLink?: string;
  hasDiscount?: boolean;
  currency?: string;
  quantity?: number;
}

const APP_NAME = 'Cheapest Premiums';
const APP_URL = 'https://cheapest-premiums.in';
const APP_TAGLINE = 'Premium Subscriptions • Instant Delivery';
const SUPPORT_EMAIL = 'support@cheapest-premiums.in';
const BRAND_PRIMARY = '#6366f1';
const BRAND_DARK = '#0f172a';

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function buildEmail(p: Payload): { subject: string; html: string; text: string } {
  const name = escapeHtml(p.customerName || 'Customer');
  const productName = escapeHtml(p.productName);
  const fullOrderId = p.orderId;
  const shortId = fullOrderId.slice(0, 8).toUpperCase();
  const cur = p.currency || '₹';
  const priceStr = (p.totalPrice !== undefined && p.totalPrice !== null)
    ? `${cur}${Number(p.totalPrice).toFixed(2)}` : '';
  const qty = p.quantity || 1;

  let subject = '', preheader = '', badge = '', badgeColor = BRAND_PRIMARY;
  let title = '', intro = '', extraSection = '';
  let ctaLabel = 'View My Orders';
  let ctaUrl = `${APP_URL}/orders`;

  switch (p.status) {
    case 'confirmed':
    case 'completed':
      subject = `✅ Order Confirmed — ${p.productName} (#${shortId})`;
      preheader = `Your access details for ${p.productName} are ready inside.`;
      badge = 'ORDER CONFIRMED';
      badgeColor = '#059669';
      title = `Thanks, ${name} — your order is confirmed 🎉`;
      intro = `We've successfully processed your order. Your access details are below — enjoy your subscription!`;
      if (p.accessLink) {
        const link = escapeHtml(p.accessLink);
        const isUrl = /^https?:\/\//i.test(p.accessLink);
        extraSection = `
          <tr><td style="padding:0 32px;">
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:20px;margin:8px 0 24px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#065f46;letter-spacing:.4px;text-transform:uppercase;">🔑 Your Access Details</p>
              ${isUrl ? `
                <a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:4px 0;">Open Access Link</a>
                <p style="margin:10px 0 0;font-family:Menlo,Consolas,monospace;font-size:12px;color:#065f46;word-break:break-all;">${link}</p>
              ` : `
                <pre style="margin:0;padding:12px;background:#fff;border:1px solid #d1fae5;border-radius:8px;font-family:Menlo,Consolas,monospace;font-size:13px;color:#0f172a;white-space:pre-wrap;word-break:break-word;">${link}</pre>
              `}
            </div>
          </td></tr>
        `;
      } else {
        extraSection = `
          <tr><td style="padding:0 32px;">
            <p style="margin:0 0 24px;color:#475569;font-size:14px;">You can view your order and access details anytime from your account.</p>
          </td></tr>
        `;
      }
      break;

    case 'pending':
    case 'placed':
      subject = `🛒 Order Received — ${p.productName} (#${shortId})`;
      preheader = `We've received your order and our team is processing it now.`;
      badge = 'ORDER PLACED';
      badgeColor = BRAND_PRIMARY;
      title = `Hi ${name}, we've received your order`;
      intro = `Thanks for shopping with ${APP_NAME}! Your order has been placed successfully and is being processed. You'll get another email the moment it's confirmed and delivered.`;
      extraSection = `
        <tr><td style="padding:0 32px;">
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:18px;margin:8px 0 24px;">
            <p style="margin:0;font-size:14px;color:#3730a3;line-height:1.55;">
              ⏱️ <strong>Typical processing time:</strong> within minutes for digital products. We'll notify you instantly once delivered.
            </p>
          </div>
        </td></tr>
      `;
      break;

    case 'processing':
      subject = `🔄 Order Processing — ${p.productName} (#${shortId})`;
      preheader = `Your order is being processed right now.`;
      badge = 'PROCESSING';
      badgeColor = '#d97706';
      title = `Hi ${name}, your order is being processed`;
      intro = `Our team is working on your order. You'll receive a confirmation email with access details as soon as it's ready.`;
      break;

    case 'cancelled':
      subject = `❌ Order Cancelled — ${p.productName} (#${shortId})`;
      preheader = `Your order has been cancelled.`;
      badge = 'CANCELLED';
      badgeColor = '#dc2626';
      title = `Hi ${name}, your order has been cancelled`;
      intro = p.hasDiscount
        ? `Your order was cancelled. Since a coupon/discount was used, no wallet refund was issued.`
        : `Your order was cancelled. ${priceStr ? `<strong>${priceStr}</strong> has been refunded to your wallet.` : 'Your refund has been added to your wallet.'}`;
      ctaLabel = 'Browse Products';
      ctaUrl = `${APP_URL}/products`;
      break;

    case 'refunded':
      subject = `💰 Refund Processed — ${p.productName} (#${shortId})`;
      preheader = `Your refund has been processed.`;
      badge = 'REFUNDED';
      badgeColor = '#7c3aed';
      title = `Hi ${name}, your refund is complete`;
      intro = p.hasDiscount
        ? `Your refund has been processed. No wallet refund was issued because a coupon/discount was applied to this order.`
        : `${priceStr ? `<strong>${priceStr}</strong> has been credited back to your wallet.` : 'Your refund has been credited to your wallet.'}`;
      ctaLabel = 'View Wallet';
      ctaUrl = `${APP_URL}/wallet`;
      break;

    default:
      subject = `Order Update — ${p.productName} (#${shortId})`;
      preheader = `There's an update on your order.`;
      badge = String(p.status).toUpperCase();
      title = `Hi ${name}, there's an update on your order`;
      intro = `Your order status has been updated to <strong>${escapeHtml(p.status)}</strong>.`;
  }

  const text = [
    `${APP_NAME} — ${badge}`,
    '',
    title.replace(/<[^>]+>/g, ''),
    '',
    `Product: ${p.productName}`,
    `Order ID: #${shortId} (${fullOrderId})`,
    priceStr ? `Total: ${priceStr}` : '',
    qty > 1 ? `Quantity: ${qty}` : '',
    p.accessLink ? `Access: ${p.accessLink}` : '',
    '',
    `View your orders: ${APP_URL}/orders`,
    `Need help? ${SUPPORT_EMAIL}`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.06);">
        <tr><td style="background:linear-gradient(135deg,${BRAND_DARK} 0%,#1e293b 100%);padding:28px 32px;text-align:center;">
          <p style="margin:0 0 4px;color:#a5b4fc;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(APP_TAGLINE)}</p>
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-.3px;">${APP_NAME}</h1>
        </td></tr>

        <tr><td style="padding:28px 32px 8px;text-align:center;">
          <span style="display:inline-block;background:${badgeColor};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.2px;padding:6px 14px;border-radius:999px;">${badge}</span>
        </td></tr>

        <tr><td style="padding:8px 32px 16px;text-align:center;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">${title}</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${intro}</p>
        </td></tr>

        <tr><td style="padding:16px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:.6px;text-transform:uppercase;">Product</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;">${productName}${qty > 1 ? ` <span style="color:#64748b;font-weight:500;">× ${qty}</span>` : ''}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;vertical-align:top;width:50%;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:.6px;text-transform:uppercase;">Order ID</p>
                    <p style="margin:0;font-size:14px;font-family:Menlo,Consolas,monospace;color:#0f172a;font-weight:600;">#${shortId}</p>
                    <p style="margin:2px 0 0;font-size:11px;font-family:Menlo,Consolas,monospace;color:#94a3b8;word-break:break-all;">${escapeHtml(fullOrderId)}</p>
                  </td>
                  ${priceStr ? `
                  <td style="padding-left:12px;vertical-align:top;width:50%;text-align:right;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:.6px;text-transform:uppercase;">Amount</p>
                    <p style="margin:0;font-size:18px;color:#0f172a;font-weight:700;">${priceStr}</p>
                  </td>
                  ` : ''}
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        ${extraSection}

        <tr><td style="padding:8px 32px 28px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:${BRAND_DARK};color:#ffffff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${ctaLabel}</a>
        </td></tr>

        <tr><td style="padding:0 32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
            <tr><td style="padding-top:20px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#475569;">Need help with your order?</p>
              <p style="margin:0;font-size:13px;color:#475569;">Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a></p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600;">${APP_NAME}</p>
          <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;">${escapeHtml(APP_TAGLINE)}</p>
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            <a href="${APP_URL}" style="color:#94a3b8;text-decoration:none;">${APP_URL.replace('https://','')}</a>
            &nbsp;•&nbsp;
            <a href="${APP_URL}/orders" style="color:#94a3b8;text-decoration:none;">My Orders</a>
            &nbsp;•&nbsp;
            <a href="${APP_URL}/wallet" style="color:#94a3b8;text-decoration:none;">Wallet</a>
          </p>
          <p style="margin:12px 0 0;font-size:10px;color:#cbd5e1;">© ${new Date().getFullYear()} ${APP_NAME}. This is a transactional email regarding your order.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

async function sendAdminAlert(supabase: any, smtpCfg: any, subject: string, errorDetail: string, ctx: Record<string, any>) {
  try {
    const html = `<div style="font-family:Arial,sans-serif;padding:20px;">
      <h2 style="color:#ef4444;">⚠️ Email Delivery Failed</h2>
      <p><strong>Subject:</strong> ${subject}</p>
      <pre style="background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap;">${errorDetail}</pre>
      <h3>Context:</h3>
      <pre style="background:#f3f4f6;padding:12px;border-radius:8px;">${JSON.stringify(ctx, null, 2)}</pre>
    </div>`;
    const adminSubject = `🚨 Email Failed: ${subject}`;
    if (smtpCfg) {
      const r = await sendViaSmtp(smtpCfg, { to: ADMIN_ALERT_EMAIL, subject: adminSubject, html });
      await supabase.from('email_send_log').insert({
        template_name: 'admin_alert',
        recipient_email: ADMIN_ALERT_EMAIL,
        subject: adminSubject,
        provider: 'smtp',
        status: r.ok ? 'sent' : 'failed',
        error_message: r.ok ? null : r.error,
        metadata: ctx,
      });
    }
  } catch (e) {
    console.error('admin alert send failed', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let payload: Payload | null = null;
  try {
    payload = await req.json() as Payload;
    if (!payload.to || !payload.productName || !payload.orderId || !payload.status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, html } = buildEmail(payload);
    const smtpCfg = await getActiveSmtpConfig(supabase);

    // 1) Try SMTP first
    if (smtpCfg) {
      const r = await sendViaSmtp(smtpCfg, { to: payload.to, subject, html });
      if (r.ok) {
        await supabase.from('email_send_log').insert({
          template_name: `order_${payload.status}`,
          recipient_email: payload.to,
          subject,
          provider: 'smtp',
          status: 'sent',
          order_id: payload.orderId,
          metadata: { product: payload.productName, from: smtpCfg.from_email },
        });
        return new Response(JSON.stringify({ success: true, provider: 'smtp' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.warn('SMTP send failed, will try Resend fallback:', r.error);
      await supabase.from('email_send_log').insert({
        template_name: `order_${payload.status}`,
        recipient_email: payload.to,
        subject,
        provider: 'smtp',
        status: 'failed',
        error_message: r.error?.slice(0, 500),
        order_id: payload.orderId,
      });
    }

    // 2) Fallback to Resend if configured
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (LOVABLE_API_KEY && RESEND_API_KEY) {
      async function sendVia(from: string) {
        const r = await fetch(`${GATEWAY_URL}/emails`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': RESEND_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: [payload!.to], subject, html }),
        });
        const t = await r.text();
        let p: any = {};
        try { p = JSON.parse(t); } catch { /* ignore */ }
        return { ok: r.ok, status: r.status, text: t, parsed: p };
      }
      let res = await sendVia(FROM_ADDRESS);
      let usedFrom = FROM_ADDRESS;
      if (!res.ok && (res.status === 403 || /domain|verify|not verified|from/i.test(res.text)) && FROM_ADDRESS !== FALLBACK_FROM) {
        res = await sendVia(FALLBACK_FROM);
        usedFrom = FALLBACK_FROM;
      }
      if (res.ok) {
        await supabase.from('email_send_log').insert({
          message_id: res.parsed.id || null,
          template_name: `order_${payload.status}`,
          recipient_email: payload.to,
          subject,
          provider: 'resend',
          status: 'sent',
          order_id: payload.orderId,
          metadata: { product: payload.productName, from: usedFrom },
        });
        return new Response(JSON.stringify({ success: true, provider: 'resend', id: res.parsed.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errDetail = `Resend ${res.status}: ${res.text.slice(0, 500)}`;
      await supabase.from('email_send_log').insert({
        template_name: `order_${payload.status}`,
        recipient_email: payload.to,
        subject,
        provider: 'resend',
        status: 'failed',
        error_message: errDetail,
        order_id: payload.orderId,
      });
      await sendAdminAlert(supabase, smtpCfg, subject, errDetail, { to: payload.to, orderId: payload.orderId, status: payload.status });
      return new Response(JSON.stringify({ error: 'All providers failed', detail: errDetail }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Nothing configured
    const noneMsg = 'No email provider configured (SMTP & Resend both missing)';
    await sendAdminAlert(supabase, smtpCfg, subject, noneMsg, { to: payload.to, orderId: payload.orderId });
    return new Response(JSON.stringify({ error: noneMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-order-email error', e);
    const errStr = String(e).slice(0, 500);
    try {
      await supabase.from('email_send_log').insert({
        template_name: payload ? `order_${payload.status}` : 'order_unknown',
        recipient_email: payload?.to || 'unknown',
        subject: payload ? `Order ${payload.status}` : 'Unknown',
        provider: 'unknown',
        status: 'failed',
        error_message: errStr,
        order_id: payload?.orderId || null,
      });
      const cfg = await getActiveSmtpConfig(supabase);
      await sendAdminAlert(supabase, cfg, 'send-order-email exception', errStr, { payload });
    } catch {/* ignore */}
    return new Response(JSON.stringify({ error: errStr }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
