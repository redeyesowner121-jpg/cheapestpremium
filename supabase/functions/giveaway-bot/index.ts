// ===== GIVEAWAY BOT - Full-featured bot mirroring main bot + giveaway system =====

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, t, BOT_USERNAME } from "../telegram-bot/constants.ts";
import { sendMessage, answerCallbackQuery } from "../telegram-bot/telegram-api.ts";
import {
  upsertTelegramUser, isBanned, isAdminBot,
  getUserData, ensureWallet,
  getConversationState, deleteConversationState, setConversationState,
  checkChannelMembership, notifyAllAdmins, getRequiredChannels,
} from "../telegram-bot/db-helpers.ts";
import {
  showLanguageSelection,
  handleViewCategories, handleCategoryProducts, handleProductDetail,
  handleMyOrders, handleMyWallet, handleReferEarn, handleSupport,
  handleGetOffers, forwardUserMessageToAdmin, handleLoginCode,
  handleWalletDeposit, handleWalletWithdraw,
} from "../telegram-bot/menu-handlers.ts";
import {
  handleBuyProduct, handleBuyVariation, handleWalletPay, handleAdminAction,
  showBinancePayment, showUpiPayment, showRazorpayUpiPayment, showManualUpiPayment,
  handleBinanceVerify, handleRazorpayVerify,
} from "../telegram-bot/payment-handlers.ts";
import {
  handleResaleStart, handleResaleVariationStart, handleStartWithRef,
} from "../telegram-bot/resale-handlers.ts";
import {
  handleAdminMenu, handleReport, handleEditPrice, handleOutStock,
  handleUsersCommand, handleHistoryCommand, handleBanCommand,
  handleMakeReseller, handleAddAdmin, handleRemoveAdmin,
  handleListAdmins, handleAllUsers, handleAddBalance, handleDeductBalance,
  handleListChannels, handleAddChannel, handleRemoveChannel,
  handleBotSettings, handleSetMinReferral,
  handleAdminProductsMenu, handleAdminUsersMenu, handleAdminWalletMenu,
  handleAdminChannelsMenu, handleAdminOwnerMenu,
  handleAdminSettingsMenu, handleSettingsCategory, promptSettingEdit, saveSetting,
  handleAITrainingMenu, startTrainingCategory, handleViewKnowledge,
  startDeleteKnowledge, executeDeleteKnowledge,
} from "../telegram-bot/admin-handlers.ts";
import { handleConversationStep } from "../telegram-bot/conversation-handlers.ts";
import { handleAIQuery } from "../telegram-bot/ai-handler.ts";
import { handleAdminCallbacks } from "../telegram-bot/callbacks/admin-callbacks.ts";
import { handlePaymentCallbacks } from "../telegram-bot/callbacks/payment-callbacks.ts";
import { handleMenuCallbacks } from "../telegram-bot/callbacks/menu-callbacks.ts";

// ===== GIVEAWAY-SPECIFIC HELPERS =====

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

// Show giveaway main menu (main bot menu + giveaway buttons)
async function showGiveawayMainMenu(token: string, supabase: any, chatId: number, lang: string, userId: number) {
  const points = await getPoints(supabase, userId);
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;

  const { data: settingsData } = await supabase.from("app_settings").select("key, value").in("key", ["app_name"]);
  const settings: Record<string, string> = {};
  settingsData?.forEach((s: any) => { settings[s.key] = s.value; });
  const storeName = settings.app_name || "RKR Premium Store";

  const welcomeText = lang === "bn"
    ? `🎁 <b>${storeName} গিভওয়ে বট!</b>\n\n💰 পয়েন্ট: <b>${pts}</b> | 👥 রেফারেল: <b>${refs}</b>\n\n✨ রেফার করো → পয়েন্ট অর্জন করো → ফ্রি প্রোডাক্ট জিতো!\n\nনিচে একটি অপশন বেছে নিন:`
    : `🎁 <b>${storeName} Giveaway Bot!</b>\n\n💰 Points: <b>${pts}</b> | 👥 Referrals: <b>${refs}</b>\n\n✨ Refer friends → Earn points → Win free products!\n\nChoose an option below:`;

  await sendMessage(token, chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products" }, { text: "💰 My Points", callback_data: "gw_points" }],
        [{ text: "📎 Referral Link", callback_data: "gw_referral" }, { text: "📜 Redemptions", callback_data: "gw_history" }],
        [{ text: t("view_products", lang), callback_data: "view_products" }],
        [
          { text: t("my_orders", lang), callback_data: "my_orders" },
          { text: t("my_wallet", lang), callback_data: "my_wallet" },
        ],
        [
          { text: t("refer_earn", lang), callback_data: "refer_earn" },
          { text: t("support", lang), callback_data: "support" },
        ],
        [{ text: "Website Login", callback_data: "website_login" }],
      ],
    },
  });
}

// Show join channels + main bot start requirement
async function showGiveawayJoinChannels(token: string, supabase: any, chatId: number, lang: string, userId: number) {
  const channels = await getRequiredChannels(supabase);
  const buttons: any[][] = channels.map((ch: string) => {
    const name = ch.startsWith("@") ? ch : `@${ch}`;
    return [{ text: `Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }];
  });

  // Add main bot start button
  buttons.push([{ text: `🤖 Start Main Bot (@${BOT_USERNAME})`, url: `https://t.me/${BOT_USERNAME}?start=ref_${userId}` }]);
  buttons.push([{ text: lang === "bn" ? "✅ যাচাই করুন" : "✅ Verify", callback_data: "gw_verify_join" }]);

  const text = lang === "bn"
    ? `🔒 <b>প্রথমে নিচের ধাপগুলি সম্পূর্ণ করুন!</b>\n\n1️⃣ সব চ্যানেলে যোগ দিন\n2️⃣ মেইন বট স্টার্ট করুন\n\nসম্পন্ন হলে "✅ যাচাই করুন" ক্লিক করুন।`
    : `🔒 <b>Complete these steps first!</b>\n\n1️⃣ Join all channels\n2️⃣ Start the Main Bot\n\nAfter completing, click "✅ Verify".`;

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// Handle giveaway-specific callbacks
async function handleGiveawayCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

  if (data === "gw_verify_join") {
    const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
    if (!joined) {
      await sendMessage(BOT_TOKEN, chatId, t("not_joined", lang));
    } else {
      await sendMessage(BOT_TOKEN, chatId, t("verified", lang));
      await ensureWallet(supabase, userId);
      await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId);
    }
    return true;
  }

  if (data === "gw_main" || data === "back_main") {
    await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId);
    return true;
  }

  if (data === "gw_products") {
    const { data: products } = await supabase
      .from("giveaway_products")
      .select("*, product:products(name, image_url), variation:product_variations(name)")
      .eq("is_active", true);

    if (!products || products.length === 0) {
      await sendMessage(BOT_TOKEN, chatId,
        lang === "bn" ? "😔 <b>এখন কোনো গিভওয়ে প্রোডাক্ট নেই।</b>\n\nপরে আবার চেক করুন!" : "😔 <b>No giveaway products available right now.</b>\n\nCheck back later!", {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
      });
      return true;
    }

    let productText = lang === "bn" ? "🎁 <b>গিভওয়ে প্রোডাক্টস:</b>\n\n" : "🎁 <b>Available Giveaway Products:</b>\n\n";
    const buttons: any[][] = [];
    for (const p of products) {
      const name = (p as any).product?.name || "Unknown";
      const varName = (p as any).variation?.name ? ` (${(p as any).variation.name})` : "";
      const stockText = p.stock !== null ? `📦 ${p.stock} left` : "📦 Unlimited";
      productText += `🏷️ <b>${name}${varName}</b>\n   🎯 ${p.points_required} points | ${stockText}\n\n`;
      buttons.push([{ text: `🎁 ${name}${varName} (${p.points_required} pts)`, callback_data: `gw_redeem_${p.id}` }]);
    }
    buttons.push([{ text: "🔙 Back", callback_data: "gw_main" }]);

    await sendMessage(BOT_TOKEN, chatId, productText, { reply_markup: { inline_keyboard: buttons } });
    return true;
  }

  if (data?.startsWith("gw_redeem_")) {
    const productId = data.replace("gw_redeem_", "");
    const [userPoints, product] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("*, product:products(name), variation:product_variations(name)")
        .eq("id", productId).single().then((r: any) => r.data),
    ]);

    if (!product || !product.is_active) {
      await sendMessage(BOT_TOKEN, chatId, "❌ This product is no longer available.");
      return true;
    }

    if (product.stock !== null && product.stock <= 0) {
      await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ এই প্রোডাক্টটি স্টকে নেই!" : "❌ This product is out of stock!");
      return true;
    }

    const pts = userPoints?.points || 0;
    if (pts < product.points_required) {
      const needed = product.points_required - pts;
      await sendMessage(BOT_TOKEN, chatId,
        lang === "bn"
          ? `❌ <b>পর্যাপ্ত পয়েন্ট নেই!</b>\n\n🎯 প্রয়োজন: ${product.points_required} pts\n💰 আপনার পয়েন্ট: ${pts} pts\n📌 আরো ${needed} পয়েন্ট দরকার\n\n👥 আরো বন্ধুদের রেফার করুন!`
          : `❌ <b>Not enough points!</b>\n\n🎯 Required: ${product.points_required} pts\n💰 Your points: ${pts} pts\n📌 Need ${needed} more points\n\n👥 Refer more friends to earn points!`, {
        reply_markup: { inline_keyboard: [[{ text: "📎 Referral Link", callback_data: "gw_referral" }, { text: "🔙 Back", callback_data: "gw_products" }]] }
      });
      return true;
    }

    const name = (product as any).product?.name || "Unknown";
    const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";
    await sendMessage(BOT_TOKEN, chatId,
      lang === "bn"
        ? `🎁 <b>রিডিম কনফার্ম করুন?</b>\n\n🏷️ ${name}${varName}\n🎯 খরচ: ${product.points_required} pts\n💰 আপনার ব্যালেন্স: ${pts} pts\n\nরিডিমের পর: ${pts - product.points_required} pts`
        : `🎁 <b>Confirm Redeem?</b>\n\n🏷️ ${name}${varName}\n🎯 Cost: ${product.points_required} pts\n💰 Your balance: ${pts} pts\n\nAfter redeem: ${pts - product.points_required} pts`, {
      reply_markup: { inline_keyboard: [
        [{ text: "✅ Confirm", callback_data: `gw_confirm_${productId}` }],
        [{ text: "❌ Cancel", callback_data: "gw_products" }],
      ]}
    });
    return true;
  }

  if (data?.startsWith("gw_confirm_")) {
    const productId = data.replace("gw_confirm_", "");
    const [userPoints, product] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("*, product:products(name), variation:product_variations(name)")
        .eq("id", productId).single().then((r: any) => r.data),
    ]);

    if (!product || !product.is_active) {
      await sendMessage(BOT_TOKEN, chatId, "❌ Product no longer available.");
      return true;
    }

    const pts = userPoints?.points || 0;
    if (pts < product.points_required) {
      await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ পর্যাপ্ত পয়েন্ট নেই!" : "❌ Not enough points!");
      return true;
    }

    // Deduct points & reduce stock
    await supabase.from("giveaway_points")
      .update({ points: pts - product.points_required, updated_at: new Date().toISOString() })
      .eq("telegram_id", userId);

    if (product.stock !== null) {
      await supabase.from("giveaway_products")
        .update({ stock: product.stock - 1, updated_at: new Date().toISOString() })
        .eq("id", productId);
    }

    await supabase.from("giveaway_redemptions").insert({
      telegram_id: userId,
      giveaway_product_id: productId,
      points_spent: product.points_required,
      status: "pending",
    });

    const name = (product as any).product?.name || "Unknown";
    const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";
    const firstName = telegramUser.first_name || "User";
    const username = telegramUser.username || null;

    await sendMessage(BOT_TOKEN, chatId,
      lang === "bn"
        ? `✅ <b>রিডেম্পশন রিকোয়েস্ট জমা!</b>\n\n🏷️ ${name}${varName}\n🎯 খরচ: ${product.points_required} pts\n💰 বাকি: ${pts - product.points_required} pts\n\n⏳ অ্যাডমিন রিভিউ করে ডেলিভারি করবে!`
        : `✅ <b>Redemption Request Submitted!</b>\n\n🏷️ ${name}${varName}\n🎯 Points spent: ${product.points_required}\n💰 Remaining: ${pts - product.points_required} pts\n\n⏳ Admin will review and deliver your product soon!`, {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "gw_main" }]] }
    });

    // Notify admins via main bot
    const MAIN_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const notifyToken = MAIN_BOT_TOKEN || BOT_TOKEN;
    await notifyAllAdmins(notifyToken, supabase,
      `🎁 <b>New Giveaway Redemption!</b>\n\n👤 ${firstName} ${username ? `(@${username})` : ""}\n🆔 <code>${userId}</code>\n🏷️ ${name}${varName}\n🎯 ${product.points_required} pts\n\n📱 Check Admin Panel → Giveaway Bot → Redemptions`
    );
    return true;
  }

  if (data === "gw_referral") {
    const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
    const botUsername = botInfo.result?.username || "giveaway_bot";
    const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
    const points = await getPoints(supabase, userId);

    await sendMessage(BOT_TOKEN, chatId,
      lang === "bn"
        ? `📎 <b>আপনার রেফারেল লিংক:</b>\n\n<code>${refLink}</code>\n\n👆 ক্লিক করে কপি করো এবং বন্ধুদের শেয়ার করো!\n\n💰 <b>পয়েন্ট:</b> ${points?.points || 0}\n👥 <b>মোট রেফারেল:</b> ${points?.total_referrals || 0}\n\n🎯 প্রতি রেফারে পয়েন্ট পাবে!`
        : `📎 <b>Your Referral Link:</b>\n\n<code>${refLink}</code>\n\n👆 Click to copy and share with friends!\n\n💰 <b>Points:</b> ${points?.points || 0}\n👥 <b>Total Referrals:</b> ${points?.total_referrals || 0}\n\n🎯 Earn points for every referral!`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join this giveaway bot and win free products!")}` }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  if (data === "gw_points") {
    const points = await getPoints(supabase, userId);
    await sendMessage(BOT_TOKEN, chatId,
      lang === "bn"
        ? `💰 <b>আপনার পয়েন্ট</b>\n\n🎯 পয়েন্ট: <b>${points?.points || 0}</b>\n👥 মোট রেফারেল: <b>${points?.total_referrals || 0}</b>\n\n📎 আরো পয়েন্ট অর্জনে রেফারেল লিংক শেয়ার করুন!`
        : `💰 <b>Your Points</b>\n\n🎯 Points: <b>${points?.points || 0}</b>\n👥 Total Referrals: <b>${points?.total_referrals || 0}</b>\n\n📎 Share your referral link to earn more!`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Referral Link", callback_data: "gw_referral" }],
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

    let histText = lang === "bn" ? "📜 <b>আপনার রিডেম্পশন:</b>\n\n" : "📜 <b>Your Redemptions:</b>\n\n";
    if (!redeems || redeems.length === 0) {
      histText += lang === "bn" ? "কোনো রিডেম্পশন নেই। পয়েন্ট অর্জন শুরু করুন!" : "No redemptions yet. Start earning points!";
    } else {
      for (const r of redeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const statusIcon = r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳";
        histText += `${statusIcon} <b>${name}</b> — ${r.points_spent} pts (${r.status})\n`;
      }
    }

    await sendMessage(BOT_TOKEN, chatId, histText, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
    });
    return true;
  }

  return false;
}

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const BOT_TOKEN = Deno.env.get("GIVEAWAY_BOT_TOKEN");
  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "GIVEAWAY_BOT_TOKEN not set" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const update = await req.json();

    // ===== CALLBACK QUERIES =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      const telegramUser = cq.from;
      const userId = telegramUser.id;

      const [userData] = await Promise.all([
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
        answerCallbackQuery(BOT_TOKEN, cq.id),
      ]);

      if (userData.is_banned) return jsonOk();
      const lang = userData.language || "en";

      // Giveaway-specific callbacks first (includes back_main override)
      if (await handleGiveawayCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) return jsonOk();

      // Language selection (override to show giveaway menu after)
      if (data === "lang_en" || data === "lang_bn") {
        const { setUserLang } = await import("../telegram-bot/db-helpers.ts");
        const selectedLang = data === "lang_en" ? "en" : "bn";
        await setUserLang(supabase, userId, selectedLang);
        await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
        const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
        if (!joined) {
          await showGiveawayJoinChannels(BOT_TOKEN, supabase, chatId, selectedLang, userId);
        } else {
          await ensureWallet(supabase, userId);
          await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, selectedLang, userId);
        }
        return jsonOk();
      }

      if (data === "verify_join" || data === "gw_verify_join") {
        const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
        if (!joined) {
          await sendMessage(BOT_TOKEN, chatId, t("not_joined", lang));
        } else {
          await sendMessage(BOT_TOKEN, chatId, t("verified", lang));
          await ensureWallet(supabase, userId);
          await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId);
        }
        return jsonOk();
      }

      // Admin callbacks
      if (await handleAdminCallbacks(BOT_TOKEN, supabase, chatId, userId, data)) return jsonOk();
      // Payment callbacks
      if (await handlePaymentCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) return jsonOk();

      // Menu callbacks (but override back_main to show giveaway menu)
      // We handle back_main in giveaway callbacks above, so the menu callbacks won't catch it
      if (await handleMenuCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) return jsonOk();

      return jsonOk();
    }

    // ===== TEXT/PHOTO MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUser = msg.from;
      const userId = telegramUser.id;
      const text = msg.text || "";
      const firstName = telegramUser.first_name || "User";

      const [userData] = await Promise.all([
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
      ]);

      if (userData.is_banned) return jsonOk();
      const lang = userData.language || "en";

      // Reset conversation state on commands
      if (text.startsWith("/")) {
        await deleteConversationState(supabase, userId);
      } else {
        const convState = await getConversationState(supabase, userId);
        if (convState) {
          await handleConversationStep(BOT_TOKEN, supabase, chatId, userId, msg, convState);
          return jsonOk();
        }
      }

      // Commands
      if (text.startsWith("/")) {
        const parts = text.split(" ");
        const command = parts[0].toLowerCase().split("@")[0];

        switch (command) {
          case "/start": {
            const payload = parts[1] || "";

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
                    await sendMessage(BOT_TOKEN, referrerId,
                      lang === "bn"
                        ? `🎉 <b>নতুন রেফারেল!</b>\n\n👤 <b>${firstName}</b> আপনার লিংক দিয়ে জয়েন করেছে!\n🎯 +${ppr} পয়েন্ট যোগ হয়েছে!\n\nআরো রেফার করুন!`
                        : `🎉 <b>New Referral!</b>\n\n👤 <b>${firstName}</b> joined through your link!\n🎯 +${ppr} points added!\n\nKeep referring to earn more!`
                    );
                  } catch {}
                }
              }
            }

            // Also handle main bot referral deep links
            if (payload.startsWith("buy_")) {
              await sendMessage(BOT_TOKEN, chatId,
                lang === "bn" ? "🔒 রিসেল লিংক শুধু রিসেলার বটে কাজ করে।" : "🔒 Resale links only work in the reseller bot."
              );
              return jsonOk();
            }

            await getPoints(supabase, userId);

            if (!userData.language) { await showLanguageSelection(BOT_TOKEN, chatId); return jsonOk(); }

            const isUserAdmin = await isAdminBot(supabase, userId);
            const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
            await ensureWallet(supabase, userId);

            if (!isUserAdmin && !joined) {
              await showGiveawayJoinChannels(BOT_TOKEN, supabase, chatId, lang, userId);
              return jsonOk();
            }

            await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId);
            break;
          }
          case "/menu":
            await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId); break;
          case "/points":
          case "/balance": {
            const points = await getPoints(supabase, userId);
            await sendMessage(BOT_TOKEN, chatId,
              lang === "bn"
                ? `💰 <b>পয়েন্ট:</b> ${points?.points || 0}\n👥 <b>মোট রেফারেল:</b> ${points?.total_referrals || 0}`
                : `💰 <b>Points:</b> ${points?.points || 0}\n👥 <b>Total Referrals:</b> ${points?.total_referrals || 0}`, {
              reply_markup: { inline_keyboard: [[{ text: "📎 Referral Link", callback_data: "gw_referral" }]] }
            });
            break;
          }
          case "/products":
          case "/shop":
            await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); break;
          case "/orders":
            await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); break;
          case "/wallet":
            await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang); break;
          case "/deposit":
            await handleWalletDeposit(BOT_TOKEN, supabase, chatId, userId, lang); break;
          case "/withdraw":
            await handleWalletWithdraw(BOT_TOKEN, supabase, chatId, userId, lang); break;
          case "/support":
          case "/help":
            await handleSupport(BOT_TOKEN, supabase, chatId, lang); break;
          case "/refer":
          case "/referral":
          case "/share": {
            // Show giveaway referral link instead of main bot referral
            const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
            const botUsername = botInfo.result?.username || "giveaway_bot";
            const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
            await sendMessage(BOT_TOKEN, chatId,
              lang === "bn"
                ? `📎 <b>আপনার রেফারেল লিংক:</b>\n\n<code>${refLink}</code>\n\n👆 ক্লিক করে কপি করো!`
                : `📎 <b>Your Referral Link:</b>\n\n<code>${refLink}</code>\n\n👆 Click to copy!`, {
              reply_markup: { inline_keyboard: [
                [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join and win free products!")}` }],
              ]}
            });
            break;
          }
          case "/offers":
            await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); break;
          case "/login":
            await handleLoginCode(BOT_TOKEN, supabase, chatId, userId, lang); break;
          case "/stats": {
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
            const statsText = lang === "bn"
              ? `📊 <b>আপনার পরিসংখ্যান</b>\n\n💰 ব্যালেন্স: <b>₹${bal}</b>\n💵 মোট আয়: <b>₹${earned}</b>\n📦 মোট অর্ডার: <b>${orderCount || 0}</b>\n🎯 গিভওয়ে পয়েন্ট: <b>${pts}</b>\n👥 গিভওয়ে রেফারেল: <b>${refs}</b>\n🏷️ রেফারেল কোড: <code>${refCode}</code>`
              : `📊 <b>Your Stats</b>\n\n💰 Balance: <b>₹${bal}</b>\n💵 Total Earned: <b>₹${earned}</b>\n📦 Total Orders: <b>${orderCount || 0}</b>\n🎯 Giveaway Points: <b>${pts}</b>\n👥 Giveaway Referrals: <b>${refs}</b>\n🏷️ Referral Code: <code>${refCode}</code>`;
            await sendMessage(BOT_TOKEN, chatId, statsText, {
              reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "gw_main" }]] }
            });
            break;
          }
          case "/users": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); break;
          }
          case "/admin":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAdminMenu(BOT_TOKEN, supabase, chatId, userId); break;
          case "/broadcast":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "broadcast_message", {});
            await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message to broadcast.\nSend /cancel to cancel."); break;
          default: {
            const searchTerm = command.replace("/", "").trim();
            if (searchTerm.length >= 2) {
              const { data: matchedProducts } = await supabase
                .from("products")
                .select("id, name")
                .eq("is_active", true)
                .ilike("name", `%${searchTerm}%`)
                .limit(10);

              if (matchedProducts?.length === 1) {
                await handleProductDetail(BOT_TOKEN, supabase, chatId, matchedProducts[0].id, lang, userId);
              } else if (matchedProducts?.length > 1) {
                const searchText = lang === "bn"
                  ? `🔍 <b>"${searchTerm}" এর জন্য ${matchedProducts.length}টি পণ্য পাওয়া গেছে:</b>\n\n`
                  : `🔍 <b>Found ${matchedProducts.length} products for "${searchTerm}":</b>\n\n`;
                const buttons = matchedProducts.map((p: any) => [{ text: p.name, callback_data: `product_${p.id}` }]);
                buttons.push([{ text: t("back_main", lang), callback_data: "gw_main" }]);
                await sendMessage(BOT_TOKEN, chatId, searchText, { reply_markup: { inline_keyboard: buttons } });
              } else {
                await sendMessage(BOT_TOKEN, chatId,
                  lang === "bn" ? `❌ "/${searchTerm}" নামে কোনো পণ্য পাওয়া যায়নি।` : `❌ No product found matching "/${searchTerm}".`
                );
              }
            }
            break;
          }
        }
        return jsonOk();
      }

      // Non-command text → AI assistant
      await handleAIQuery(BOT_TOKEN, supabase, chatId, userId, text, lang);
      return jsonOk();
    }

    return jsonOk();
  } catch (error) {
    console.error("Giveaway bot error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
