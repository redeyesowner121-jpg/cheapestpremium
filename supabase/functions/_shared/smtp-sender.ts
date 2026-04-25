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
  const client = new SMTPClient({
    connection: {
      hostname: cfg.host,
      port: cfg.port,
      tls: cfg.secure,
      auth: { username: cfg.username, password: cfg.password },
    },
  });
  try {
    await client.send({
      from: `${cfg.from_name} <${cfg.from_email}>`,
      to: opts.to,
      subject: opts.subject,
      content: opts.text || opts.subject,
      html: opts.html,
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
