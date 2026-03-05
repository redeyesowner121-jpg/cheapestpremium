import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";

const MAIN_BOT_USERNAME = "Cheapest_Premiums_bot";
const RESALE_BOT_USERNAME = "Cheap_reseller_bot";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function setWebhook(token: string, url: string, retries = 1) {
  let lastResponse: any = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    lastResponse = await res.json();
    if (lastResponse?.ok) return lastResponse;
  }

  return lastResponse;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!SUPABASE_URL) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const resolved = await resolveTelegramBotTokens({
      configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
      configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
      expectedMainUsername: MAIN_BOT_USERNAME,
      expectedResaleUsername: RESALE_BOT_USERNAME,
    });

    const results: any[] = [];

    if (!resolved.mainBotToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Main bot token not found",
          token_usernames: resolved.tokenUsernames,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mainWebhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const mainResponse = await setWebhook(resolved.mainBotToken, mainWebhookUrl, 2);
    console.log("Main bot webhook result:", mainResponse);
    results.push({
      bot: "main",
      webhook_url: mainWebhookUrl,
      telegram_response: mainResponse,
    });

    if (resolved.resaleBotToken) {
      if (resolved.resaleBotToken === resolved.mainBotToken) {
        results.push({
          bot: "resale",
          skipped: true,
          reason: "main_and_resale_tokens_are_identical",
        });
      } else {
        const resaleWebhookUrl = `${SUPABASE_URL}/functions/v1/resale-bot`;
        const resaleResponse = await setWebhook(resolved.resaleBotToken, resaleWebhookUrl, 3);
        console.log("Resale bot webhook result:", resaleResponse);
        results.push({
          bot: "resale",
          webhook_url: resaleWebhookUrl,
          telegram_response: resaleResponse,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_usernames: resolved.tokenUsernames,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error setting webhook:", error);
    return new Response(
      JSON.stringify({ error: "Failed to set webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
