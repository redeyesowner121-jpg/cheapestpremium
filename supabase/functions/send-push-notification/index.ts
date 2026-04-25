// Send Web Push notifications via VAPID (no Firebase, no 3rd party)
// Body: { user_ids?: string[], user_id?: string, title: string, body: string, url?: string, data?: object }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = 'BIYBmye4KnM4FCClZKwscI5WaSjXpqco3JA4Dqg2vjteZRYyBDd04uUXL5MBsk5-6E1LnqWnBsuIqdQasQ7_oGk';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@cheapest-premiums.in';
    if (!VAPID_PRIVATE_KEY) throw new Error('VAPID_PRIVATE_KEY not configured');

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const userIds: string[] = body.user_ids || (body.user_id ? [body.user_id] : []);
    if (!body.title || userIds.length === 0) {
      return new Response(JSON.stringify({ error: 'title and user_id(s) required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', userIds);
    if (error) throw error;

    const payload = JSON.stringify({
      title: body.title,
      body: body.body || '',
      url: body.url || '/',
      data: body.data || {},
    });

    const results = await Promise.allSettled(
      (subs || []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          return { id: s.id, ok: true };
        } catch (err: any) {
          // Stale subscription: clean up
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
          }
          return { id: s.id, ok: false, status: err.statusCode, error: String(err.message || err) };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && (r as any).value.ok).length;
    return new Response(JSON.stringify({ success: true, sent, total: subs?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('send-push error', e);
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
