// Admin email broadcast — uses admin-configured SMTP first (e.g. Hostinger),
// falls back to Resend connector if no SMTP config is saved.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Cheapest Premiums <support@cheapest-premiums.in>';
const FALLBACK_FROM = 'Cheapest Premiums <onboarding@resend.dev>';
const APP_NAME = 'Cheapest Premiums';
const APP_URL = 'https://cheapest-premiums.in';

interface Body {
  subject: string;
  message: string;        // plain text or simple HTML
  recipients: 'all' | 'verified' | 'custom';
  customEmails?: string[]; // when recipients === 'custom'
  preheader?: string;
}

function wrapHtml(subject: string, body: string, preheader?: string) {
  // Convert plain newlines to <br> if no html tags found
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(body);
  const content = looksLikeHtml ? body : body.replace(/\n/g, '<br/>');
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f3f4f6;">${preheader}</div>` : ''}
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:28px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
    </div>
    <div style="padding:28px 24px;">
      <h2 style="margin:0 0 16px;color:#111;font-size:20px;">${subject}</h2>
      <div style="color:#374151;font-size:15px;line-height:1.6;">${content}</div>
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Visit ${APP_NAME}</a>
      </div>
    </div>
    <div style="padding:18px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">© ${APP_NAME} • <a href="${APP_URL}" style="color:#9ca3af;">${APP_URL.replace('https://','')}</a></p>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Auth: only admins
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: userData } = await supabase.auth.getUser(authHeader);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: userId });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: 'Forbidden — admins only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as Body;
    if (!body.subject || !body.message || !body.recipients) {
      return new Response(JSON.stringify({ error: 'subject, message, recipients required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build recipient list
    let recipients: string[] = [];
    if (body.recipients === 'custom') {
      recipients = (body.customEmails || []).map(e => e.trim()).filter(Boolean);
    } else {
      let q = supabase.from('profiles').select('email');
      const { data: profs, error } = await q.limit(10000);
      if (error) throw new Error('profiles query failed: ' + (error.message || JSON.stringify(error)));
      recipients = (profs || []).map((p: any) => p.email).filter(Boolean);
    }

    // Dedupe + basic email shape filter
    recipients = Array.from(new Set(recipients.filter(e => /.+@.+\..+/.test(e))));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid recipients found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = wrapHtml(body.subject, body.message, body.preheader);

    // ========== Try admin-configured SMTP first ==========
    const { data: smtpCfg } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smtpCfg) {
      const client = new SMTPClient({
        connection: {
          hostname: smtpCfg.host,
          port: smtpCfg.port,
          tls: smtpCfg.secure,
          auth: { username: smtpCfg.username, password: smtpCfg.password },
        },
      });
      let sent = 0, failed = 0, firstErr: string | null = null;
      const fromHeader = `${smtpCfg.from_name} <${smtpCfg.from_email}>`;
      for (const to of recipients) {
        try {
          await client.send({ from: fromHeader, to, subject: body.subject, content: body.subject, html });
          sent++;
          await supabase.from('email_send_log').insert({
            template_name: 'admin_broadcast', recipient_email: to, subject: body.subject,
            provider: 'smtp', status: 'sent', metadata: { from: fromHeader, broadcast: true, host: smtpCfg.host },
          });
        } catch (e) {
          failed++;
          const msg = e instanceof Error ? e.message : String(e);
          if (!firstErr) firstErr = msg;
          await supabase.from('email_send_log').insert({
            template_name: 'admin_broadcast', recipient_email: to, subject: body.subject,
            provider: 'smtp', status: 'failed', error_message: msg, metadata: { from: fromHeader, broadcast: true },
          });
        }
        await new Promise(res => setTimeout(res, 200));
      }
      try { await client.close(); } catch { /* noop */ }
      return new Response(JSON.stringify({
        success: true, total: recipients.length, sent, failed, from: fromHeader, provider: 'smtp', firstError: firstErr,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== Fallback: Resend connector ==========
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'No SMTP saved and Resend not configured. Set up SMTP in admin panel.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    async function sendOne(to: string, from: string) {
      const r = await fetch(`${GATEWAY_URL}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject: body.subject, html }),
      });
      const t = await r.text();
      let p: any = {};
      try { p = JSON.parse(t); } catch { /* ignore */ }
      return { ok: r.ok, status: r.status, text: t, parsed: p };
    }

    let sent = 0, failed = 0, usedFrom = FROM_ADDRESS;
    let firstErr: string | null = null;

    // Probe with the first recipient to detect domain-verify issues, then fallback once
    const probe = await sendOne(recipients[0], FROM_ADDRESS);
    if (!probe.ok && (probe.status === 403 || /domain|verify|not verified|from/i.test(probe.text)) && FROM_ADDRESS !== FALLBACK_FROM) {
      console.warn('Primary FROM failed, switching to fallback:', probe.status, probe.text.slice(0, 200));
      usedFrom = FALLBACK_FROM;
      const retry = await sendOne(recipients[0], FALLBACK_FROM);
      if (retry.ok) sent++;
      else { failed++; firstErr = `${retry.status}: ${retry.text.slice(0, 300)}`; }
      await supabase.from('email_send_log').insert({
        message_id: retry.parsed?.id || null,
        template_name: 'admin_broadcast',
        recipient_email: recipients[0],
        subject: body.subject,
        provider: 'resend',
        status: retry.ok ? 'sent' : 'failed',
        error_message: retry.ok ? null : firstErr,
        metadata: { from: usedFrom, broadcast: true },
      });
    } else {
      if (probe.ok) sent++;
      else { failed++; firstErr = `${probe.status}: ${probe.text.slice(0, 300)}`; }
      await supabase.from('email_send_log').insert({
        message_id: probe.parsed?.id || null,
        template_name: 'admin_broadcast',
        recipient_email: recipients[0],
        subject: body.subject,
        provider: 'resend',
        status: probe.ok ? 'sent' : 'failed',
        error_message: probe.ok ? null : firstErr,
        metadata: { from: usedFrom, broadcast: true },
      });
    }

    // Send to remaining recipients sequentially with small spacing (Resend rate limits)
    for (let i = 1; i < recipients.length; i++) {
      const to = recipients[i];
      const r = await sendOne(to, usedFrom);
      if (r.ok) sent++; else failed++;
      await supabase.from('email_send_log').insert({
        message_id: r.parsed?.id || null,
        template_name: 'admin_broadcast',
        recipient_email: to,
        subject: body.subject,
        provider: 'resend',
        status: r.ok ? 'sent' : 'failed',
        error_message: r.ok ? null : `${r.status}: ${r.text.slice(0, 300)}`,
        metadata: { from: usedFrom, broadcast: true },
      });
      // ~2 req/sec to stay under Resend's free-tier limits
      await new Promise(res => setTimeout(res, 550));
    }

    return new Response(JSON.stringify({
      success: true,
      total: recipients.length,
      sent,
      failed,
      from: usedFrom,
      firstError: firstErr,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('admin-broadcast-email error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
