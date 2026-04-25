// Test SMTP — admins can send a test email through a saved SMTP config
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  to: string;
  // optional override (lets admin test before saving)
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  from_email?: string;
  from_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const { data: u } = await supabase.auth.getUser(auth);
    if (!u?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: u.user.id });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json() as Body;
    if (!body.to) return json({ error: 'to required' }, 400);

    let cfg: any;
    if (body.host && body.username && body.password && body.from_email) {
      cfg = {
        host: body.host,
        port: body.port || 465,
        secure: body.secure ?? true,
        username: body.username,
        password: body.password,
        from_email: body.from_email,
        from_name: body.from_name || 'Cheapest Premiums',
      };
    } else {
      const { data } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return json({ error: 'No SMTP config saved. Save settings first or pass them in the request.' }, 400);
      cfg = data;
    }

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
        to: body.to,
        subject: '✅ SMTP Test — Cheapest Premiums',
        content: 'Your SMTP setup is working.',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;">
          <h2 style="color:#10b981;">SMTP Test Successful 🎉</h2>
          <p>Your email server <b>${cfg.host}:${cfg.port}</b> is configured correctly.</p>
          <p>From: <b>${cfg.from_name} &lt;${cfg.from_email}&gt;</b></p>
          <p style="color:#6b7280;font-size:13px;">Sent from Admin Panel · Cheapest Premiums</p>
        </div>`,
      });
      await client.close();
      return json({ success: true, message: `Test email sent to ${body.to}` });
    } catch (e) {
      try { await client.close(); } catch { /* noop */ }
      const msg = e instanceof Error ? e.message : String(e);
      console.error('SMTP test failed:', msg);
      return json({ success: false, error: msg }, 200);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }

  function json(b: any, s = 200) {
    return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
