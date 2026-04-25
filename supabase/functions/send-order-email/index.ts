// Send order status email via Gmail (Google Mail API) + log every attempt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1';

interface Payload {
  to: string;
  customerName?: string;
  productName: string;
  orderId: string;
  status: 'confirmed' | 'completed' | 'processing' | 'cancelled' | 'refunded' | string;
  totalPrice?: number;
  accessLink?: string;
  hasDiscount?: boolean;
}

const APP_NAME = 'Cheapest Premiums';
const APP_URL = 'https://cheapest-premiums.in';

function buildEmail(p: Payload): { subject: string; html: string } {
  const name = p.customerName || 'Customer';
  const shortId = p.orderId.slice(0, 8).toUpperCase();
  const price = p.totalPrice ? `₹${p.totalPrice}` : '';

  let subject = '', title = '', intro = '', body = '', accent = '#6366f1';

  switch (p.status) {
    case 'confirmed':
    case 'completed':
      subject = `✅ Order Confirmed - ${p.productName} (#${shortId})`;
      title = '🎉 Your Order is Confirmed!';
      intro = `Great news, ${name}! Your order has been successfully processed.`;
      accent = '#10b981';
      body = `
        <p style="margin:0 0 12px;color:#374151;">Your access details are ready below.</p>
        ${p.accessLink ? `
          <div style="background:#f0fdf4;border:2px solid #10b981;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;font-weight:600;color:#065f46;font-size:14px;">🔑 Access Link / Credentials:</p>
            <p style="margin:0;word-break:break-all;font-family:monospace;background:#fff;padding:12px;border-radius:8px;color:#111;border:1px solid #d1fae5;">${p.accessLink}</p>
          </div>
        ` : `<p style="color:#6b7280;">Check your account orders page for delivery details.</p>`}
      `;
      break;
    case 'processing':
      subject = `🔄 Order Processing - ${p.productName} (#${shortId})`;
      title = '⏳ Order is Being Processed';
      intro = `Hi ${name}, we're working on your order right now.`;
      accent = '#f59e0b';
      body = `<p style="color:#374151;">You'll receive another email once it's confirmed. Hang tight!</p>`;
      break;
    case 'cancelled':
      subject = `❌ Order Cancelled - ${p.productName} (#${shortId})`;
      title = 'Order Cancelled';
      intro = `Hi ${name}, your order has been cancelled.`;
      accent = '#ef4444';
      body = p.hasDiscount
        ? `<p style="color:#374151;">No refund was issued because a coupon/discount was used on this order.</p>`
        : `<p style="color:#374151;">${price ? `<strong>${price}</strong> has been refunded to your wallet.` : 'Your refund has been added to your wallet.'}</p>`;
      break;
    case 'refunded':
      subject = `💰 Order Refunded - ${p.productName} (#${shortId})`;
      title = '💰 Refund Processed';
      intro = `Hi ${name}, your refund has been processed.`;
      accent = '#8b5cf6';
      body = p.hasDiscount
        ? `<p style="color:#374151;">No wallet refund (coupon/discount was applied).</p>`
        : `<p style="color:#374151;">${price ? `<strong>${price}</strong> credited back to your wallet.` : 'Refund credited to your wallet.'}</p>`;
      break;
    default:
      subject = `Order Update - ${p.productName} (#${shortId})`;
      title = 'Order Status Update';
      intro = `Hi ${name}, there's an update on your order.`;
      body = `<p>Status: <strong>${p.status}</strong></p>`;
  }

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">${APP_NAME}</h1>
    </div>
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 8px;color:#111;font-size:22px;">${title}</h2>
      <p style="margin:0 0 20px;color:#4b5563;font-size:15px;">${intro}</p>
      <div style="background:#f9fafb;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">📦 Product</p>
        <p style="margin:0 0 12px;color:#111;font-weight:600;">${p.productName}</p>
        <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">🆔 Order ID</p>
        <p style="margin:0;color:#111;font-family:monospace;">#${shortId}</p>
        ${price ? `<p style="margin:12px 0 6px;color:#6b7280;font-size:13px;">💵 Amount</p><p style="margin:0;color:#111;font-weight:600;">${price}</p>` : ''}
      </div>
      ${body}
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${APP_URL}/orders" style="display:inline-block;background:${accent};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">View My Orders</a>
      </div>
    </div>
    <div style="padding:20px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">© ${APP_NAME} • <a href="${APP_URL}" style="color:#9ca3af;">${APP_URL.replace('https://','')}</a></p>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

function buildRawEmail(to: string, subject: string, html: string): string {
  // RFC 2822 with UTF-8 base64 subject for emoji safety
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  ].join('\r\n');
  // base64url
  const utf8 = unescape(encodeURIComponent(message));
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let payload: Payload | null = null;
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GMAIL_KEY = Deno.env.get('GOOGLE_MAIL_API_KEY');

    payload = await req.json() as Payload;
    if (!payload.to || !payload.productName || !payload.orderId || !payload.status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, html } = buildEmail(payload);

    if (!LOVABLE_API_KEY || !GMAIL_KEY) {
      await supabase.from('email_send_log').insert({
        template_name: `order_${payload.status}`,
        recipient_email: payload.to,
        subject,
        provider: 'gmail',
        status: 'failed',
        error_message: 'Email not configured (missing API keys)',
        order_id: payload.orderId,
      });
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = buildRawEmail(payload.to, subject, html);
    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GMAIL_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const respText = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(respText); } catch { /* ignore */ }

    if (!res.ok) {
      console.error('Gmail send failed', res.status, respText);
      await supabase.from('email_send_log').insert({
        template_name: `order_${payload.status}`,
        recipient_email: payload.to,
        subject,
        provider: 'gmail',
        status: 'failed',
        error_message: `${res.status}: ${respText.slice(0, 500)}`,
        order_id: payload.orderId,
        metadata: { product: payload.productName },
      });
      return new Response(JSON.stringify({ error: 'Send failed', detail: respText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('email_send_log').insert({
      message_id: parsed.id || null,
      template_name: `order_${payload.status}`,
      recipient_email: payload.to,
      subject,
      provider: 'gmail',
      status: 'sent',
      order_id: payload.orderId,
      metadata: { product: payload.productName, threadId: parsed.threadId || null },
    });

    return new Response(JSON.stringify({ success: true, id: parsed.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-order-email error', e);
    try {
      await supabase.from('email_send_log').insert({
        template_name: payload ? `order_${payload.status}` : 'order_unknown',
        recipient_email: payload?.to || 'unknown',
        subject: payload ? `Order ${payload.status}` : 'Unknown',
        provider: 'gmail',
        status: 'failed',
        error_message: String(e).slice(0, 500),
        order_id: payload?.orderId || null,
      });
    } catch {/* ignore */}
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
