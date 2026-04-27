export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function mergeVerifiedTelegramEmailAccount(supabase: any, telegramId: number, email: string | null) {
  if (!email || email.endsWith("@bot.local")) return;
  const { error } = await supabase.rpc("merge_telegram_email_account", {
    _telegram_id: telegramId,
    _email: email,
  });
  if (error) console.error("merge_telegram_email_account failed:", error);
}
