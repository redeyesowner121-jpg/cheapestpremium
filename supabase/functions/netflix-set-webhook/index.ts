// One-time Netflix bot webhook setup
import { corsHeaders } from "@supabase/supabase-js/cors";

const TOKEN = Deno.env.get("NETFLIX_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const webhookUrl = `${SUPABASE_URL}/functions/v1/netflix-bot`;
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  const data = await r.json();
  return new Response(JSON.stringify({ webhookUrl, telegram: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
