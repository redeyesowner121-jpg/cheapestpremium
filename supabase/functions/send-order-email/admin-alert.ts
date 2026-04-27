import { sendViaSmtp } from "../_shared/smtp-sender.ts";

const ADMIN_ALERT_EMAIL = 'red.eyes.owner121@gmail.com';

export async function sendAdminAlert(
  supabase: any,
  smtpCfg: any,
  subject: string,
  errorDetail: string,
  ctx: Record<string, any>
) {
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
