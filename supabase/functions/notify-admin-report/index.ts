import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'red.eyes.owner121@gmail.com';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/microsoft_outlook';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { order_id, reason, details, report_id } = await req.json();
    if (!order_id || !reason) {
      return new Response(JSON.stringify({ error: 'order_id and reason required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch order context + reporter
    const { data: order } = await supabase
      .from('orders')
      .select('id, product_name, total_price, user_id, profiles:user_id(name, email)')
      .eq('id', order_id)
      .maybeSingle();

    const reporterName = (order as any)?.profiles?.name || 'A user';
    const reporterEmail = (order as any)?.profiles?.email || 'unknown';
    const productName = order?.product_name || 'Unknown product';

    // Find admin user(s)
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    // In-app notification for each admin
    if (admins?.length) {
      const notifs = admins.map((a) => ({
        user_id: a.user_id,
        title: '🚩 New Order Report',
        message: `${reporterName} reported "${productName}" — Reason: ${reason}${details ? ` | ${details}` : ''} (Order: ${order_id.slice(0, 8)})`,
        type: 'order',
      }));
      await supabase.from('notifications').insert(notifs);
    }

    // Send email via Outlook
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OUTLOOK_KEY = Deno.env.get('MICROSOFT_OUTLOOK_API_KEY_2') || Deno.env.get('MICROSOFT_OUTLOOK_API_KEY');

    let emailSent = false;
    let emailError: string | null = null;
    if (LOVABLE_API_KEY && OUTLOOK_KEY) {
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
      const res = await fetch(`${GATEWAY_URL}/me/sendMail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': OUTLOOK_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: `🚩 Order Report: ${reason} — ${productName}`,
            body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: ADMIN_EMAIL } }],
          },
          saveToSentItems: true,
        }),
      });
      if (res.ok) {
        emailSent = true;
      } else {
        emailError = `${res.status}: ${await res.text()}`;
        console.error('Outlook send failed:', emailError);
      }
    } else {
      emailError = 'Missing connector keys';
    }

    return new Response(JSON.stringify({ success: true, emailSent, emailError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify-admin-report error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
