// Send order status email via SMTP (primary) with Resend fallback + admin alerts on failure
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getActiveSmtpConfig, sendViaSmtp } from "../_shared/smtp-sender.ts";
import { buildEmail, type Payload } from "./email-template.ts";
import { sendAdminAlert } from "./admin-alert.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Cheapest Premiums <support@cheapest-premiums.in>';
const FALLBACK_FROM = 'Cheapest Premiums <onboarding@resend.dev>';

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

    const { subject, html, text } = buildEmail(payload);
    const smtpCfg = await getActiveSmtpConfig(supabase);

    // 1) Try SMTP first
    if (smtpCfg) {
      const r = await sendViaSmtp(smtpCfg, { to: payload.to, subject, html, text });
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
