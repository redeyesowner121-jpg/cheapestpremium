// ===== GIVEAWAY HANDLERS for main bot =====

import { sendMessage } from "./telegram-api.ts";
import { t, BOT_USERNAME } from "./constants.ts";
import {
  checkChannelMembership, ensureWallet, notifyAllAdmins,
  getRequiredChannels, getSettings, setUserLang,
} from "./db-helpers.ts";
import { showLanguageSelection } from "./menu/menu-navigation.ts";

// ===== HELPERS =====

async function getPoints(supabase: any, tgId: number) {
  const { data } = await supabase.from("giveaway_points").select("*").eq("telegram_id", tgId).single();
  if (data) return data;
  const { data: newData } = await supabase.from("giveaway_points").insert({ telegram_id: tgId }).select().single();
  return newData;
}

async function getGiveawaySetting(supabase: any, key: string) {
  const { data } = await supabase.from("giveaway_settings").select("value").eq("key", key).single();
  return data?.value;
}

// Fixed referral link for main bot
const MAIN_BOT_REF_LINK = "https://t.me/Air1_Premium_bot?start=ref_REFJFF7FC";

// Giveaway-specific required channels
const GIVEAWAY_REQUIRED_CHANNELS = [
  { id: "@rkrxott", name: "@rkrxott" },
  { id: "@rkrxmethods", name: "@rkrxmethods" },
];

export async function checkGiveawayChannels(mainToken: string, userId: number): Promise<boolean> {
  const { getChatMember } = await import("./telegram-api.ts");
  const results = await Promise.all(
    GIVEAWAY_REQUIRED_CHANNELS.map(async (ch) => {
      const status = await getChatMember(mainToken, ch.id, userId);
      console.log(`Channel check ${ch.name} (${ch.id}) for user ${userId}: ${status}`);
      return status;
    })
  );
  return results.every(status => ["member", "administrator", "creator"].includes(status));
}

// ===== GIVEAWAY MAIN MENU =====

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

// ===== GIVEAWAY JOIN CHANNELS =====

export async function showGiveawayJoinChannels(token: string, supabase: any, chatId: number, _lang: string, userId: number) {
  // Dynamic channel buttons from GIVEAWAY_REQUIRED_CHANNELS
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

// ===== GIVEAWAY /start HANDLER =====

export async function handleGiveawayStart(
  token: string, supabase: any, chatId: number, userId: number,
  telegramUser: any, payload: string, lang: string, userData: any
) {
  const firstName = telegramUser.first_name || "User";

  // Handle giveaway referral
  if (payload.startsWith("ref_")) {
    const referrerId = parseInt(payload.replace("ref_", ""));
    if (referrerId && referrerId !== userId) {
      const { data: existing } = await supabase
        .from("giveaway_referrals")
        .select("id")
        .eq("referred_telegram_id", userId)
        .single();

      if (!existing) {
        const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");
        await supabase.from("giveaway_referrals").insert({
          referrer_telegram_id: referrerId,
          referred_telegram_id: userId,
          points_awarded: ppr,
        });

        const referrerPoints = await getPoints(supabase, referrerId);
        await supabase.from("giveaway_points")
          .update({
            points: (referrerPoints?.points || 0) + ppr,
            total_referrals: (referrerPoints?.total_referrals || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("telegram_id", referrerId);

        try {
          await sendMessage(token, referrerId,
            `🎉 <b>New Referral!</b>\n\n👤 ${firstName} joined via your link.\n🎯 +${ppr} points added.`
          );
        } catch {}
      }
    }
  }

  await getPoints(supabase, userId);

  if (!userData.language) { await showLanguageSelection(token, chatId); return; }

  const { isAdminBot } = await import("./db-helpers.ts");
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

// ===== GIVEAWAY STATS =====

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
    reply_markup: { inline_keyboard: [[{ text: "Main Menu", callback_data: "gw_main" }]] }
  });
}

// ===== GIVEAWAY REFERRAL LINK =====

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
      [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join and win free products!")}` }],
      [{ text: "🔙 Back", callback_data: "gw_main" }],
    ]}
  });
}

// ===== GIVEAWAY CALLBACK HANDLERS =====

export async function handleGiveawayCallbacks(
  token: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, _lang: string
): Promise<boolean> {

  if (data === "gw_verify_join") {
    const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    const joined = await checkGiveawayChannels(MAIN_TOKEN, userId);
    if (!joined) {
      await sendMessage(token, chatId, "❌ You haven't joined all channels yet. Please join both channels and try again.");
    } else {
      const wallet = await ensureWallet(supabase, userId);
      
      const { data: existingBonus } = await supabase
        .from("telegram_wallet_transactions")
        .select("id")
        .eq("telegram_id", userId)
        .eq("description", "Giveaway Bot Welcome Bonus")
        .single();

      if (!existingBonus) {
        const currentBal = wallet?.balance || 0;
        await supabase.from("telegram_wallets")
          .update({ balance: currentBal + 1, updated_at: new Date().toISOString() })
          .eq("telegram_id", userId);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: userId,
          amount: 1,
          type: "bonus",
          description: "Giveaway Bot Welcome Bonus",
        });

        await sendMessage(token, chatId,
          `✅ <b>Verified Successfully!</b>\n\n🎉 +₹1 added to your wallet!\n\n💰 You can withdraw it, refer & redeem premium or earn money! 💸`
        );
      } else {
        await sendMessage(token, chatId, "✅ Verified! Welcome aboard!");
      }

      await showGiveawayMainMenu(token, supabase, chatId, "en", userId);
    }
    return true;
  }

  if (data === "gw_main") {
    await showGiveawayMainMenu(token, supabase, chatId, "en", userId);
    return true;
  }

  if (data === "gw_products") {
    const { data: giveawayItems } = await supabase
      .from("giveaway_products")
      .select("id, product_id")
      .eq("is_active", true);

    const productIds = Array.from(
      new Set((giveawayItems || []).map((item: any) => item.product_id).filter(Boolean))
    );

    if (productIds.length === 0) {
      await sendMessage(token, chatId, "😔 <b>No giveaway products available.</b>", {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
      });
      return true;
    }

    const { data: productRows } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds)
      .order("name", { ascending: true });

    console.log("Giveaway products menu", { giveawayItems: giveawayItems?.length || 0, uniqueProducts: productIds.length, loadedProducts: productRows?.length || 0 });

    if (!productRows || productRows.length === 0) {
      await sendMessage(token, chatId, "😔 <b>No giveaway products available.</b>", {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
      });
      return true;
    }

    const buttons: any[][] = productRows.map((product: any) => [
      { text: `🎁 ${product.name}`, callback_data: `gw_pdetail_${product.id}` }
    ]);
    buttons.push([{ text: "🔙 Back", callback_data: "gw_main" }]);

    await sendMessage(token, chatId, "🎁 <b>Giveaway Products</b>\n\nChoose a product:", {
      reply_markup: { inline_keyboard: buttons }
    });
    return true;
  }

  if (data?.startsWith("gw_pdetail_")) {
    const productId = data.replace("gw_pdetail_", "");

    const [productRes, giveawayRes, variationRes] = await Promise.all([
      supabase.from("products").select("id, name, image_url, description").eq("id", productId).maybeSingle(),
      supabase.from("giveaway_products")
        .select("id, product_id, variation_id, points_required, stock, is_active")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase.from("product_variations")
        .select("id, name")
        .eq("product_id", productId)
        .order("created_at", { ascending: true }),
    ]);

    const product = productRes.data;
    const items = giveawayRes.data || [];
    const variationMap = new Map((variationRes.data || []).map((variation: any) => [variation.id, variation.name]));

    console.log("Giveaway product detail", { productId, productFound: !!product, options: items.length, variations: variationMap.size });

    if (!product) {
      await sendMessage(token, chatId, "❌ Product not found.");
      return true;
    }

    if (items.length === 0) {
      await sendMessage(token, chatId, "❌ No giveaway options available for this product.");
      return true;
    }

    const buttons: any[][] = items.map((item: any) => {
      const variationName = item.variation_id ? variationMap.get(item.variation_id) || "Selected variation" : "Standard";
      const stockText = item.stock !== null ? (item.stock > 0 ? `📦${item.stock}` : "❌Sold") : "∞";
      return [{
        text: `${variationName} — ${item.points_required} pts (${stockText})`,
        callback_data: `gw_redeem_${item.id}`,
      }];
    });
    buttons.push([{ text: "🔙 Back", callback_data: "gw_products" }]);

    const caption = `🎁 <b>${product.name}</b>\n\n${product.description || ""}\n\nChoose a variation to redeem:`;

    if (product.image_url) {
      const { sendPhoto } = await import("./telegram-api.ts");
      await sendPhoto(token, chatId, product.image_url, caption, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
    }
    return true;
  }

  if (data?.startsWith("gw_redeem_")) {
    const gpId = data.replace("gw_redeem_", "");
    const [userPoints, giveawayItemRes] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("id, product_id, variation_id, points_required, stock, is_active")
        .eq("id", gpId)
        .maybeSingle(),
    ]);

    const giveawayItem = giveawayItemRes.data;
    if (!giveawayItem || !giveawayItem.is_active) {
      await sendMessage(token, chatId, "❌ Product no longer available.");
      return true;
    }
    if (giveawayItem.stock !== null && giveawayItem.stock <= 0) {
      await sendMessage(token, chatId, "❌ Out of stock!");
      return true;
    }

    const [productRes, variationRes] = await Promise.all([
      supabase.from("products").select("name, image_url").eq("id", giveawayItem.product_id).maybeSingle(),
      giveawayItem.variation_id
        ? supabase.from("product_variations").select("name").eq("id", giveawayItem.variation_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const pts = userPoints?.points || 0;
    const name = productRes.data?.name || "Unknown";
    const varName = variationRes.data?.name ? ` (${variationRes.data.name})` : "";

    if (pts < giveawayItem.points_required) {
      const needed = giveawayItem.points_required - pts;
      await sendMessage(token, chatId,
        `❌ <b>Not enough points!</b>\n\n🎯 Need: ${giveawayItem.points_required} pts\n💰 Yours: ${pts} pts\n📌 ${needed} more needed`, {
          reply_markup: { inline_keyboard: [[{ text: "📎 Refer & Earn", callback_data: "gw_referral" }, { text: "🔙 Back", callback_data: `gw_pdetail_${giveawayItem.product_id}` }]] }
        }
      );
      return true;
    }

    await sendMessage(token, chatId,
      `🎁 <b>Confirm Redeem?</b>\n\n🏷️ ${name}${varName}\n🎯 Cost: ${giveawayItem.points_required} pts\n💰 Balance: ${pts} pts\nAfter: ${pts - giveawayItem.points_required} pts`, {
        reply_markup: { inline_keyboard: [
          [{ text: "✅ Confirm", callback_data: `gw_confirm_${gpId}`, style: "success" }],
          [{ text: "❌ Cancel", callback_data: `gw_pdetail_${giveawayItem.product_id}`, style: "danger" }],
        ]}
      }
    );
    return true;
  }

  if (data?.startsWith("gw_confirm_")) {
    const giveawayItemId = data.replace("gw_confirm_", "");
    const [userPoints, giveawayItemRes] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("id, product_id, variation_id, points_required, stock, is_active")
        .eq("id", giveawayItemId)
        .maybeSingle(),
    ]);

    const giveawayItem = giveawayItemRes.data;
    if (!giveawayItem || !giveawayItem.is_active || (userPoints?.points || 0) < giveawayItem.points_required) {
      await sendMessage(token, chatId, "❌ Cannot redeem.");
      return true;
    }

    const [productRes, variationRes] = await Promise.all([
      supabase.from("products").select("name").eq("id", giveawayItem.product_id).maybeSingle(),
      giveawayItem.variation_id
        ? supabase.from("product_variations").select("name").eq("id", giveawayItem.variation_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const pts = userPoints?.points || 0;
    await supabase.from("giveaway_points")
      .update({ points: pts - giveawayItem.points_required, updated_at: new Date().toISOString() })
      .eq("telegram_id", userId);

    if (giveawayItem.stock !== null) {
      await supabase.from("giveaway_products")
        .update({ stock: Math.max(0, giveawayItem.stock - 1), updated_at: new Date().toISOString() })
        .eq("id", giveawayItemId);
    }

    const name = productRes.data?.name || "Unknown";
    const varName = variationRes.data?.name ? ` (${variationRes.data.name})` : "";
    const firstName = telegramUser.first_name || "User";
    const username = telegramUser.username || null;

    // Auto-accept: fetch access_link for instant delivery
    let accessLink: string | null = null;
    if (giveawayItem.variation_id) {
      const { data: varData } = await supabase.from("product_variations")
        .select("name, price").eq("id", giveawayItem.variation_id).maybeSingle();
      // Variations don't have access_link, use product's
    }
    const { data: productFull } = await supabase.from("products")
      .select("access_link").eq("id", giveawayItem.product_id).maybeSingle();
    accessLink = productFull?.access_link || null;

    // Insert as already completed
    await supabase.from("giveaway_redemptions").insert({
      telegram_id: userId,
      giveaway_product_id: giveawayItemId,
      points_spent: giveawayItem.points_required,
      status: "completed",
    });

    // Send delivery to user
    if (accessLink) {
      const isCredentials = accessLink.includes("ID:") && accessLink.includes("Password:");
      if (isCredentials) {
        await sendMessage(token, chatId,
          `✅ <b>Redemption Complete!</b>\n\n🏷️ ${name}${varName}\n🎯 ${giveawayItem.points_required} pts spent\n💰 Remaining: ${pts - giveawayItem.points_required} pts\n\n🔑 <b>Your Credentials:</b>\n<code>${accessLink}</code>`, {
            reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "gw_main" }]] }
          }
        );
      } else {
        await sendMessage(token, chatId,
          `✅ <b>Redemption Complete!</b>\n\n🏷️ ${name}${varName}\n🎯 ${giveawayItem.points_required} pts spent\n💰 Remaining: ${pts - giveawayItem.points_required} pts\n\n🔗 <b>Your Access Link:</b>\n${accessLink}`, {
            reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "gw_main" }]] }
          }
        );
      }
    } else {
      await sendMessage(token, chatId,
        `✅ <b>Redemption Complete!</b>\n\n🏷️ ${name}${varName}\n🎯 ${giveawayItem.points_required} pts spent\n💰 Remaining: ${pts - giveawayItem.points_required} pts\n\n📦 Your product has been delivered!`, {
          reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "gw_main" }]] }
        }
      );
    }

    const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;

    try {
      const { logProof, formatGiveawayRedeem } = await import("./proof-logger.ts");
      await logProof(MAIN_TOKEN, formatGiveawayRedeem(userId, `${name}${varName}`, giveawayItem.points_required));
    } catch {}

    return true;
  }

  if (data === "gw_referral") {
    await showGiveawayReferralLink(token, supabase, chatId, userId, "en");
    return true;
  }

  if (data === "gw_points") {
    const points = await getPoints(supabase, userId);
    const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");
    await sendMessage(token, chatId,
      `💰 <b>Your Points</b>\n\n🎯 Points: <b>${points?.points || 0}</b>\n👥 Total Referrals: <b>${points?.total_referrals || 0}</b>\n\n📌 Per Referral: <b>${ppr} points</b>`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Refer & Earn", callback_data: "gw_referral" }],
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  if (data === "gw_history") {
    const { data: redeems } = await supabase
      .from("giveaway_redemptions")
      .select("*, giveaway_product:giveaway_products(product:products(name))")
      .eq("telegram_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    let histText = "📜 <b>My Redemptions:</b>\n\n";
    if (!redeems?.length) {
      histText += "No redemptions yet.\n\n🎁 Redeem giveaway products!";
    } else {
      for (const r of redeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const icon = r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳";
        const date = new Date(r.created_at).toLocaleDateString();
        histText += `${icon} <b>${name}</b> — ${r.points_spent} pts (${r.status})\n   📅 ${date}\n\n`;
      }
    }
    await sendMessage(token, chatId, histText, {
      reply_markup: { inline_keyboard: [
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  if (data === "gw_reviews") {
    const { data: approvedRedeems } = await supabase
      .from("giveaway_redemptions")
      .select("*, giveaway_product:giveaway_products(product:products(name))")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10);

    let reviewText = "⭐ <b>Reviews / Successful Redemptions:</b>\n\n";
    if (!approvedRedeems?.length) {
      reviewText += "No successful redemptions yet.";
    } else {
      for (const r of approvedRedeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const date = new Date(r.created_at).toLocaleDateString();
        reviewText += `✅ <b>${name}</b> — ${r.points_spent} pts\n   🆔 ${String(r.telegram_id).slice(0, 4)}**** | 📅 ${date}\n\n`;
      }
    }
    reviewText += "\n🎁 You too can win free products by referring!";

    await sendMessage(token, chatId, reviewText, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Refer & Earn", callback_data: "gw_referral" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  return false;
}

// ===== GIVEAWAY ADMIN MENU =====

export async function showGiveawayAdminMenu(token: string, supabase: any, chatId: number) {
  // Gather giveaway-specific stats
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

  // Total points in circulation
  const allPoints = pointsRes.data || [];
  const totalPoints = allPoints.reduce((sum: number, p: any) => sum + (p.points || 0), 0);

  // Get current channels
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
        [{ text: "📢 Manage Channels", callback_data: "gwa_channels", style: "primary" }],
        [{ text: "📊 Top Users", callback_data: "gwa_top_users", style: "success" }],
        [{ text: "🔙 Main Menu", callback_data: "gw_main" }],
      ],
    },
  });
}

// ===== GIVEAWAY ADMIN CALLBACKS =====

export async function handleGiveawayAdminCallbacks(
  token: string, supabase: any, chatId: number, userId: number, data: string
): Promise<boolean> {

  if (data === "gwa_channels") {
    const channelList = GIVEAWAY_REQUIRED_CHANNELS.map((ch, i) => `${i + 1}. ${ch.name}`).join("\n");
    const text = `📢 <b>Required Channels</b>\n\n${channelList || "None"}\n\n` +
      `To add/remove channels, use:\n<code>/gw_add_channel @channel</code>\n<code>/gw_remove_channel @channel</code>`;
    await sendMessage(token, chatId, text, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gwa_admin" }]] }
    });
    return true;
  }

  if (data === "gwa_admin") {
    await showGiveawayAdminMenu(token, supabase, chatId);
    return true;
  }

  if (data === "gwa_top_users") {
    const { data: topUsers } = await supabase
      .from("giveaway_points")
      .select("telegram_id, points, total_referrals")
      .order("points", { ascending: false })
      .limit(15);

    let text = "📊 <b>Top Giveaway Users</b>\n\n";
    if (!topUsers?.length) {
      text += "No users yet.";
    } else {
      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        const { data: userInfo } = await supabase
          .from("telegram_bot_users")
          .select("username, first_name")
          .eq("telegram_id", u.telegram_id)
          .maybeSingle();
        const name = userInfo?.username ? `@${userInfo.username}` : userInfo?.first_name || String(u.telegram_id);
        text += `${i + 1}. ${name} — 🎯${u.points} pts, 👥${u.total_referrals} refs\n`;
      }
    }
    await sendMessage(token, chatId, text, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gwa_admin" }]] }
    });
    return true;
  }

  return false;
}

// ===== HANDLE CHANNEL LEAVE — DEDUCT REFERRAL POINTS =====

export async function handleGiveawayChannelLeave(token: string, supabase: any, chatMember: any) {
  try {
    const newStatus = chatMember.new_chat_member?.status;
    const oldStatus = chatMember.old_chat_member?.status;

    // Only handle when user actually leaves (was member/admin, now left/kicked)
    const wasMember = ["member", "administrator", "creator"].includes(oldStatus);
    const isGone = ["left", "kicked"].includes(newStatus);
    if (!wasMember || !isGone) return;

    const leavingUserId = chatMember.new_chat_member?.user?.id;
    if (!leavingUserId) return;

    const leavingUser = chatMember.new_chat_member?.user;
    const displayName = leavingUser?.username
      ? `@${leavingUser.username}`
      : leavingUser?.first_name || "Unknown";

    // Check if this user was referred by someone
    const { data: referral } = await supabase
      .from("giveaway_referrals")
      .select("referrer_telegram_id, points_awarded")
      .eq("referred_telegram_id", leavingUserId)
      .single();

    if (!referral) return; // Not a referred user

    const referrerId = referral.referrer_telegram_id;
    const pointsToDeduct = referral.points_awarded || 2;

    // Deduct points from referrer
    const referrerPoints = await getPoints(supabase, referrerId);
    const newPoints = Math.max(0, (referrerPoints?.points || 0) - pointsToDeduct);
    const newReferrals = Math.max(0, (referrerPoints?.total_referrals || 0) - 1);

    await supabase.from("giveaway_points")
      .update({
        points: newPoints,
        total_referrals: newReferrals,
        updated_at: new Date().toISOString(),
      })
      .eq("telegram_id", referrerId);

    // Delete the referral record so it can't be deducted again
    await supabase.from("giveaway_referrals")
      .delete()
      .eq("referred_telegram_id", leavingUserId);

    // Notify the referrer
    try {
      await sendMessage(token, referrerId,
        `⚠️ <b>Referral Points Deducted!</b>\n\n❌ Your referral <b>${displayName}</b> (ID: <code>${leavingUserId}</code>) has left the channel.\n\n🎯 <b>-${pointsToDeduct}</b> points deducted.\n💰 Current Points: <b>${newPoints}</b>`
      );
    } catch { /* referrer may have blocked bot */ }

    console.log(`Giveaway: Deducted ${pointsToDeduct} pts from ${referrerId} — referral ${leavingUserId} left channel`);
  } catch (err) {
    console.error("handleGiveawayChannelLeave error:", err);
  }
}
