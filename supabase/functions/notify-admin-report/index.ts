// Notifies admin about a new order report — uses SMTP first (Hostinger etc.), Resend fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getActiveSmtpConfig, sendViaSmtp } from "../_shared/smtp-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'red.eyes.owner121@gmail.com';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Cheapest Premiums <support@cheapest-premiums.in>';
const FALLBACK_FROM = 'Cheapest Premiums <onboarding@resend.dev>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { order_id, reason, details, report_id } = await req.json();
    if (!order_id || !reason) {
      return new Response(JSON.stringify({ error: 'order_id and reason required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, product_name, total_price, user_id, profiles:user_id(name, email)')
      .eq('id', order_id)
      .maybeSingle();

    const reporterName = (order as any)?.profiles?.name || 'A user';
    const reporterEmail = (order as any)?.profiles?.email || 'unknown';
    const productName = order?.product_name || 'Unknown product';

    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins?.length) {
      const notifs = admins.map((a) => ({
        user_id: a.user_id,
        title: '🚩 New Order Report',
        message: `${reporterName} reported "${productName}" — Reason: ${reason}${details ? ` | ${details}` : ''} (Order: ${order_id.slice(0, 8)})`,
        type: 'order',
      }));
      await supabase.from('notifications').insert(notifs);
    }

    let emailSent = false;
    let emailError: string | null = null;
    let messageId: string | null = null;
    let provider = 'none';
    const subject = `🚩 Order Report: ${reason} — ${productName}`;
    const html = `
      <h2>🚩 New Order Report</h2>
      <p><strong>Order ID:</strong> ${order_id}</p>
      <p><strong>Product:</strong> ${productName}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      ${details ? `<p><strong>Details:</strong> ${details}</p>` : ''}
      <p><strong>Reported by:</strong> ${reporterName} (${reporterEmail})</p>
      ${order?.total_price ? `<p><strong>Order Amount:</strong> ₹${order.total_price}</p>` : ''}
      <hr/>
      <p>Manage in Admin Panel → Orders → Reports.</p>
    `;

    // 1) Try SMTP first
    const smtpCfg = await getActiveSmtpConfig(supabase);
    if (smtpCfg) {
      provider = 'smtp';
      const r = await sendViaSmtp(smtpCfg, { to: ADMIN_EMAIL, subject, html });
      if (r.ok) {
        emailSent = true;
      } else {
        emailError = r.error || 'SMTP send failed';
        console.warn('SMTP failed, will try Resend:', emailError);
      }
    }

    // 2) Fallback to Resend
    if (!emailSent) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (LOVABLE_API_KEY && RESEND_API_KEY) {
        provider = 'resend';
        const sendVia = async (from: string) => {
          const r = await fetch(`${GATEWAY_URL}/emails`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': RESEND_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from, to: [ADMIN_EMAIL], subject, html }),
          });
          return { ok: r.ok, status: r.status, text: await r.text() };
        };

        let r = await sendVia(FROM_ADDRESS);
        if (!r.ok && (r.status === 403 || /domain|verify|not verified|from/i.test(r.text)) && FROM_ADDRESS !== FALLBACK_FROM) {
          r = await sendVia(FALLBACK_FROM);
        }
        if (r.ok) {
          emailSent = true;
          emailError = null;
          try { messageId = JSON.parse(r.text).id || null; } catch {/*ignore*/}
        } else {
          emailError = `${r.status}: ${r.text.slice(0, 500)}`;
          console.error('Resend send failed:', emailError);
        }
      } else if (!smtpCfg) {
        emailError = 'No SMTP configured and Resend keys missing';
      }
    }

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'admin_order_report',
      recipient_email: ADMIN_EMAIL,
      subject,
      provider,
      status: emailSent ? 'sent' : 'failed',
      error_message: emailError,
      order_id: order_id,
      metadata: { reason, reporter_email: reporterEmail, report_id: report_id || null },
    });

    if (report_id) {
      await supabase
        .from('order_reports')
        .update({
          email_status: emailSent ? 'sent' : 'failed',
          email_error: emailError,
          email_sent_at: emailSent ? new Date().toISOString() : null,
        })
        .eq('id', report_id);
    }

    return new Response(JSON.stringify({ success: true, emailSent, emailError, provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify-admin-report error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
