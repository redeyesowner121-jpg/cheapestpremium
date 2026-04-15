// ===== GIVEAWAY ADMIN HANDLERS =====

import { sendMessage } from "../telegram-api.ts";
import { getPoints, GIVEAWAY_REQUIRED_CHANNELS } from "./helpers.ts";

export async function showGiveawayAdminMenu(token: string, supabase: any, chatId: number) {
  const [usersRes, pointsRes, referralsRes, redemptionsRes, productsRes] = await Promise.all([
    supabase.from("giveaway_points").select("id", { count: "exact", head: true }),
    supabase.from("giveaway_points").select("points").order("points", { ascending: false }),
    supabase.from("giveaway_referrals").select("id", { count: "exact", head: true }),
    supabase.from("giveaway_redemptions").select("id", { count: "exact", head: true }),
    supabase.from("giveaway_products").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const totalUsers = usersRes.count || 0;
  const totalReferrals = referralsRes.count || 0;
  const totalRedemptions = redemptionsRes.count || 0;
  const activeProducts = productsRes.count || 0;
  const allPoints = pointsRes.data || [];
  const totalPoints = allPoints.reduce((sum: number, p: any) => sum + (p.points || 0), 0);
  const channelList = GIVEAWAY_REQUIRED_CHANNELS.map(ch => ch.name).join(", ");

  const text = `🎁 <b>Giveaway Bot — Admin Panel</b>\n\n` +
    `👥 Total Users: <b>${totalUsers}</b>\n` +
    `🎯 Total Points in Circulation: <b>${totalPoints}</b>\n` +
    `👥 Active Referrals: <b>${totalReferrals}</b>\n` +
    `📦 Active Products: <b>${activeProducts}</b>\n` +
    `🎁 Total Redemptions: <b>${totalRedemptions}</b>\n\n` +
    `📢 Required Channels: ${channelList}`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Manage Channels", callback_data: "gwa_channels" }],
        [{ text: "📊 Top Users", callback_data: "gwa_top_users" }],
        [{ text: "🔙 Main Menu", callback_data: "gw_main" }],
      ],
    },
  });
}

export async function handleGiveawayAdminCallbacks(
  token: string, supabase: any, chatId: number, userId: number, data: string
): Promise<boolean> {
  if (data === "gwa_channels") {
    const channelList = GIVEAWAY_REQUIRED_CHANNELS.map((ch, i) => `${i + 1}. ${ch.name}`).join("\n");
    const text = `📢 <b>Required Channels</b>\n\n${channelList || "None"}\n\n` +
      `To add/remove channels, use:\n<code>/gw_add_channel @channel</code>\n<code>/gw_remove_channel @channel</code>`;
    await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gwa_admin", color: "red" }]] } });
    return true;
  }

  if (data === "gwa_admin") { await showGiveawayAdminMenu(token, supabase, chatId); return true; }

  if (data === "gwa_top_users") {
    const { data: topUsers } = await supabase.from("giveaway_points").select("telegram_id, points, total_referrals").order("points", { ascending: false }).limit(15);
    let text = "📊 <b>Top Giveaway Users</b>\n\n";
    if (!topUsers?.length) {
      text += "No users yet.";
    } else {
      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        const { data: userInfo } = await supabase.from("telegram_bot_users").select("username, first_name").eq("telegram_id", u.telegram_id).maybeSingle();
        const name = userInfo?.username ? `@${userInfo.username}` : userInfo?.first_name || String(u.telegram_id);
        text += `${i + 1}. ${name} — 🎯${u.points} pts, 👥${u.total_referrals} refs\n`;
      }
    }
    await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gwa_admin", color: "red" }]] } });
    return true;
  }

  return false;
}

export async function handleGiveawayChannelLeave(token: string, supabase: any, chatMember: any) {
  try {
    const newStatus = chatMember.new_chat_member?.status;
    const oldStatus = chatMember.old_chat_member?.status;
    const wasMember = ["member", "administrator", "creator"].includes(oldStatus);
    const isGone = ["left", "kicked"].includes(newStatus);
    if (!wasMember || !isGone) return;

    const leavingUserId = chatMember.new_chat_member?.user?.id;
    if (!leavingUserId) return;

    const leavingUser = chatMember.new_chat_member?.user;
    const displayName = leavingUser?.username ? `@${leavingUser.username}` : leavingUser?.first_name || "Unknown";

    const { data: referral } = await supabase.from("giveaway_referrals").select("referrer_telegram_id, points_awarded").eq("referred_telegram_id", leavingUserId).single();
    if (!referral) return;

    const referrerId = referral.referrer_telegram_id;
    const pointsToDeduct = referral.points_awarded || 2;
    const referrerPoints = await getPoints(supabase, referrerId);
    const newPoints = Math.max(0, (referrerPoints?.points || 0) - pointsToDeduct);
    const newReferrals = Math.max(0, (referrerPoints?.total_referrals || 0) - 1);

    await supabase.from("giveaway_points").update({ points: newPoints, total_referrals: newReferrals, updated_at: new Date().toISOString() }).eq("telegram_id", referrerId);
    await supabase.from("giveaway_referrals").delete().eq("referred_telegram_id", leavingUserId);

    try {
      await sendMessage(token, referrerId, `⚠️ <b>Referral Points Deducted!</b>\n\n❌ Your referral <b>${displayName}</b> (ID: <code>${leavingUserId}</code>) has left the channel.\n\n🎯 <b>-${pointsToDeduct}</b> points deducted.\n💰 Current Points: <b>${newPoints}</b>`);
    } catch {}
  } catch (err) { console.error("handleGiveawayChannelLeave error:", err); }
}
