// Shared SMTP sender — uses denomailer to send via configured SMTP server (e.g. Hostinger)
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
}

export async function getActiveSmtpConfig(supabase: SupabaseClient): Promise<SmtpConfig | null> {
  const { data, error } = await supabase
    .from('smtp_settings')
    .select('host, port, secure, username, password, from_email, from_name')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('getActiveSmtpConfig error:', error);
    return null;
  }
  return data as SmtpConfig | null;
}

export async function sendViaSmtp(
  cfg: SmtpConfig,
  opts: { to: string; subject: string; html: string; text?: string }
): Promise<{ ok: boolean; error?: string }> {
  // Port 465 = implicit TLS, port 587/25 = STARTTLS upgrade.
  // Using cfg.secure on 587 causes "InvalidContentType" handshake errors.
  const useImplicitTls = cfg.port === 465;
  const client = new SMTPClient({
    connection: {
      hostname: cfg.host,
      port: cfg.port,
      tls: useImplicitTls,
      auth: { username: cfg.username, password: cfg.password },
    },
  });
  try {
    // Strip HTML tags as a clean plain-text fallback when text not provided
    const plainText = (opts.text && opts.text.trim().length > 0)
      ? opts.text
      : opts.html
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();

    await client.send({
      from: `${cfg.from_name} <${cfg.from_email}>`,
      to: opts.to,
      subject: opts.subject,
      content: plainText,
      html: opts.html,
      // Force proper MIME multipart/alternative so HTML renders in all clients
      mimeContent: [
        { mimeType: 'text/plain; charset=utf-8', content: plainText, transferEncoding: 'quoted-printable' },
        { mimeType: 'text/html; charset=utf-8', content: opts.html, transferEncoding: 'quoted-printable' },
      ],
      headers: {
        'MIME-Version': '1.0',
        'X-Mailer': `${cfg.from_name} Mailer`,
      },
    });
    await client.close();
    return { ok: true };
  } catch (e) {
    try { await client.close(); } catch { /* noop */ }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}
