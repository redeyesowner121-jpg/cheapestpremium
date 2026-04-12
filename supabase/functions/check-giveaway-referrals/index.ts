// One-time cleanup: Check all giveaway referrals, deduct points for users who left channels

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GIVEAWAY_REQUIRED_CHANNELS = ["@rkrxott", "@rkrxmethods"];

async function getChatMember(token: string, chatId: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json();
    return data.result?.status || "left";
  } catch {
    return "left";
  }
}

async function sendMessage(token: string, chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const GIVEAWAY_TOKEN = Deno.env.get("GIVEAWAY_BOT_TOKEN")!;

  // Get all referrals
  const { data: referrals } = await supabase
    .from("giveaway_referrals")
    .select("id, referrer_telegram_id, referred_telegram_id, points_awarded");

  if (!referrals?.length) {
    return new Response(JSON.stringify({ message: "No referrals found", deducted: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let deductedCount = 0;
  const results: any[] = [];

  for (const ref of referrals) {
    // Check if referred user is still in ALL required channels
    const statuses = await Promise.all(
      GIVEAWAY_REQUIRED_CHANNELS.map(ch => getChatMember(MAIN_TOKEN, ch, ref.referred_telegram_id))
    );

    const isMember = statuses.every(s => ["member", "administrator", "creator"].includes(s));

    if (!isMember) {
      // Get referred user info
      const { data: userInfo } = await supabase
        .from("telegram_bot_users")
        .select("username, first_name")
        .eq("telegram_id", ref.referred_telegram_id)
        .single();

      const displayName = userInfo?.username ? `@${userInfo.username}` : userInfo?.first_name || "Unknown";
      const pointsToDeduct = ref.points_awarded || 2;

      // Get current referrer points
      const { data: referrerPoints } = await supabase
        .from("giveaway_points")
        .select("points, total_referrals")
        .eq("telegram_id", ref.referrer_telegram_id)
        .single();

      const newPoints = Math.max(0, (referrerPoints?.points || 0) - pointsToDeduct);
      const newReferrals = Math.max(0, (referrerPoints?.total_referrals || 0) - 1);

      // Deduct points
      await supabase.from("giveaway_points")
        .update({ points: newPoints, total_referrals: newReferrals, updated_at: new Date().toISOString() })
        .eq("telegram_id", ref.referrer_telegram_id);

      // Delete referral record
      await supabase.from("giveaway_referrals").delete().eq("id", ref.id);

      // Notify referrer via giveaway bot
      await sendMessage(GIVEAWAY_TOKEN, ref.referrer_telegram_id,
        `⚠️ <b>Referral Points Deducted!</b>\n\n❌ Your referral <b>${displayName}</b> (ID: <code>${ref.referred_telegram_id}</code>) has left the channel.\n\n🎯 <b>-${pointsToDeduct}</b> points deducted.\n💰 Current Points: <b>${newPoints}</b>`
      );

      deductedCount++;
      results.push({
        referrer: ref.referrer_telegram_id,
        referred: ref.referred_telegram_id,
        name: displayName,
        deducted: pointsToDeduct,
        statuses,
      });

      // Small delay to avoid Telegram rate limits
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return new Response(JSON.stringify({
    total_referrals: referrals.length,
    deducted: deductedCount,
    still_active: referrals.length - deductedCount,
    details: results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
