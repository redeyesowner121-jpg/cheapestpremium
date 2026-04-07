// ===== GIVEAWAY BOT - Proxy to main telegram-bot with giveaway flag =====
// This function forwards all updates to the main telegram-bot function
// with a header indicating giveaway mode, so all main bot features work.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const body = await req.text();

    // Forward to main telegram-bot with giveaway flag
    const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-bot?bot=giveaway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "X-Bot-Mode": "giveaway",
      },
      body,
    });

    const result = await response.text();
    return new Response(result, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Giveaway bot proxy error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
