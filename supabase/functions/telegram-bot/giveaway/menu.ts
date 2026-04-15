// ===== GIVEAWAY MENU & START HANDLERS =====

import { sendMessage } from "../telegram-api.ts";
import { ensureWallet, getSettings } from "../db-helpers.ts";
import { showLanguageSelection } from "../menu/menu-navigation.ts";
import { getPoints, getGiveawaySetting, checkGiveawayChannels, MAIN_BOT_REF_LINK, GIVEAWAY_REQUIRED_CHANNELS } from "./helpers.ts";

export async function showGiveawayMainMenu(token: string, supabase: any, chatId: number, _lang: string, userId: number) {
  const points = await getPoints(supabase, userId);
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;
  const settings = await getSettings(supabase);
  const storeName = settings.app_name || "RKR Premium Store";

  const welcomeText = `🎁 <b>${storeName} — Giveaway</b>\n\n💰 <b>${pts}</b> Points  ·  👥 <b>${refs}</b> Referrals\n\nRefer friends, earn points, win free products!`;

  await sendMessage(token, chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎁 Giveaway Products", callback_data: "gw_products", style: "success" },
          { text: "💰 My Points", callback_data: "gw_points", style: "primary" },
        ],
        [
          { text: "📜 Redemptions", callback_data: "gw_history", style: "primary" },
          { text: "📎 Refer & Earn", callback_data: "gw_referral", style: "success" },
        ],
        [
          { text: "⭐ Reviews", callback_data: "gw_reviews", style: "primary" },
          { text: "📞 Support", callback_data: "support", style: "danger" },
        ],
        [{ text: "🌐 Website Login", callback_data: "website_login", style: "primary" }],
      ],
    },
  });
}

export async function showGiveawayJoinChannels(token: string, supabase: any, chatId: number, _lang: string, userId: number) {
  const channelButtons = GIVEAWAY_REQUIRED_CHANNELS.map(ch => {
    const name = ch.name.replace("@", "");
    return [{ text: `Join ${ch.name}`, url: `https://t.me/${name}` }];
  });
  const buttons: any[][] = [
    ...channelButtons,
    [{ text: "🤖 Start Main Bot", url: MAIN_BOT_REF_LINK }],
    [{ text: "✅ Verify", callback_data: "gw_verify_join", style: "success" }],
  ];

  const channelList = GIVEAWAY_REQUIRED_CHANNELS.map((ch, i) => `${i + 1}. Join ${ch.name}`).join("\n");
  const text = `🔒 <b>Complete these steps to get started:</b>\n\n${channelList}\n${GIVEAWAY_REQUIRED_CHANNELS.length + 1}. Start the Main Bot\n\nThen tap ✅ Verify below.`;

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function handleGiveawayStart(
  token: string, supabase: any, chatId: number, userId: number,
  telegramUser: any, payload: string, lang: string, userData: any
) {
  const firstName = telegramUser.first_name || "User";

  if (payload.startsWith("ref_")) {
    const referrerId = parseInt(payload.replace("ref_", ""));
    if (referrerId && referrerId !== userId) {
      const { data: existing } = await supabase
        .from("giveaway_referrals").select("id").eq("referred_telegram_id", userId).single();

      if (!existing) {
        const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");
        await supabase.from("giveaway_referrals").insert({
          referrer_telegram_id: referrerId, referred_telegram_id: userId, points_awarded: ppr,
        });
        const referrerPoints = await getPoints(supabase, referrerId);
        await supabase.from("giveaway_points").update({
          points: (referrerPoints?.points || 0) + ppr,
          total_referrals: (referrerPoints?.total_referrals || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", referrerId);
        try {
          await sendMessage(token, referrerId, `🎉 <b>New Referral!</b>\n\n👤 ${firstName} joined via your link.\n🎯 +${ppr} points added.`);
        } catch {}
      }
    }
  }

  await getPoints(supabase, userId);

  if (!userData.language) { await showLanguageSelection(token, chatId); return; }

  const { isAdminBot } = await import("../db-helpers.ts");
  const isUserAdmin = await isAdminBot(supabase, userId);
  const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
  const joined = await checkGiveawayChannels(MAIN_TOKEN, userId);
  await ensureWallet(supabase, userId);

  if (!isUserAdmin && !joined) {
    await showGiveawayJoinChannels(token, supabase, chatId, lang, userId);
    return;
  }

  await showGiveawayMainMenu(token, supabase, chatId, lang, userId);
}

export async function showGiveawayStats(token: string, supabase: any, chatId: number, userId: number, _lang: string) {
  const [wallet, points] = await Promise.all([
    supabase.from("telegram_wallets").select("balance, total_earned, is_reseller, referral_code").eq("telegram_id", userId).single().then((r: any) => r.data),
    getPoints(supabase, userId),
  ]);
  const { count: orderCount } = await supabase.from("telegram_orders").select("id", { count: "exact", head: true }).eq("telegram_user_id", userId);
  const bal = wallet?.balance || 0;
  const earned = wallet?.total_earned || 0;
  const refCode = wallet?.referral_code || "N/A";
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;

  const statsText = `📊 <b>Your Stats</b>\n\n💰 Balance: ₹<b>${bal}</b>\n💵 Total Earned: ₹<b>${earned}</b>\n📦 Orders: <b>${orderCount || 0}</b>\n🎯 Giveaway Points: <b>${pts}</b>\n👥 Referrals: <b>${refs}</b>\n🏷️ Code: <code>${refCode}</code>`;

  await sendMessage(token, chatId, statsText, {
    reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "gw_main", style: "primary" }]] }
  });
}

export async function showGiveawayReferralLink(token: string, supabase: any, chatId: number, userId: number, _lang: string) {
  const botInfo = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
  const botUsername = botInfo.result?.username || "giveaway_bot";
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  
  const points = await getPoints(supabase, userId);
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;
  const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");

  const text = `📎 <b>Refer & Earn</b>\n\n🔗 Your link:\n<code>${refLink}</code>\n\n💰 Points: <b>${pts}</b>  ·  👥 Referrals: <b>${refs}</b>\n🎯 Per referral: <b>${ppr} pts</b>\n\nShare with friends to win free products!`;

  await sendMessage(token, chatId, text, {
    reply_markup: { inline_keyboard: [
      [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join and win free products!")}`, style: "success" }],
      [{ text: "🔙 Back", callback_data: "gw_main" }],
    ]}
  });
}
