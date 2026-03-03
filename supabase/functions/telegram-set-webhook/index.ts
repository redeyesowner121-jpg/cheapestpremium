const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const RESALE_BOT_TOKEN = Deno.env.get("RESALE_BOT_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

  try {
    const results: any[] = [];

    // Set webhook for main bot
    const mainWebhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const mainRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: mainWebhookUrl,
          allowed_updates: ["message", "callback_query"],
        }),
      }
    );
    const mainData = await mainRes.json();
    console.log("Main bot webhook result:", mainData);
    results.push({ bot: "main", webhook_url: mainWebhookUrl, telegram_response: mainData });

    // Set webhook for resale bot (with delay + retry)
    if (RESALE_BOT_TOKEN) {
      const resaleWebhookUrl = `${SUPABASE_URL}/functions/v1/resale-bot`;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
        
        const resaleRes = await fetch(
          `https://api.telegram.org/bot${RESALE_BOT_TOKEN}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: resaleWebhookUrl,
              allowed_updates: ["message", "callback_query"],
            }),
          }
        );
        const resaleData = await resaleRes.json();
        console.log(`Resale bot webhook attempt ${attempt + 1}:`, resaleData);
        
        if (resaleData.ok) {
          results.push({ bot: "resale", webhook_url: resaleWebhookUrl, telegram_response: resaleData });
          break;
        }
        
        if (attempt === 2) {
          results.push({ bot: "resale", webhook_url: resaleWebhookUrl, telegram_response: resaleData });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error setting webhook:", error);
    return new Response(
      JSON.stringify({ error: "Failed to set webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
