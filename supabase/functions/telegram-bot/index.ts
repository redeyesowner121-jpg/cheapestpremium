// ===== MAIN ENTRY POINT =====
// All logic is split into separate modules for maintainability.
// Supports giveaway mode via ?bot=giveaway query parameter.
// Supports child bot mode via ?child=<id> query parameter.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initPremiumEmoji } from "./premium-emoji.ts";
import { corsHeaders, t, UPI_ID, UPI_NAME, BOT_USERNAME, RESALE_BOT_USERNAME } from "./constants.ts";
import { answerCallbackQuery } from "./telegram-api.ts";
import {
  isSuperAdmin, isAdminBot, upsertTelegramUser, isBanned,
  getUserLang, setUserLang, ensureWallet, checkChannelMembership,
  getConversationState, deleteConversationState, setConversationState,
  notifyAllAdmins, getUserData,
} from "./db-helpers.ts";
import {
  showLanguageSelection, showJoinChannels, showMainMenu,
  handleViewCategories, handleCategoryProducts, handleProductDetail,
  handleMyOrders, handleMyWallet, handleReferEarn, handleSupport,
  handleGetOffers, forwardUserMessageToAdmin, handleLoginCode,
  handleWalletDeposit, handleWalletWithdraw,
} from "./menu-handlers.ts";
import {
  handleBuyProduct, handleBuyVariation, handleWalletPay, handleAdminAction,
  showBinancePayment, showUpiPayment, showRazorpayUpiPayment, showManualUpiPayment, handleRazorpayVerify,
} from "./payment-handlers.ts";
import {
  handleResaleStart, handleResaleVariationStart, handleStartWithRef,
} from "./resale-handlers.ts";
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
} from "./admin-handlers.ts";
import { handleConversationStep } from "./conversation-handlers.ts";
import { handleAIQuery } from "./ai-handler.ts";
import { sendMessage } from "./telegram-api.ts";
import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";
import { handleAdminCallbacks } from "./callbacks/admin-callbacks.ts";
import { handlePaymentCallbacks } from "./callbacks/payment-callbacks.ts";
import { handleMenuCallbacks } from "./callbacks/menu-callbacks.ts";
import {
  handleGiveawayCallbacks, handleGiveawayStart,
  showGiveawayMainMenu, showGiveawayReferralLink, showGiveawayStats,
  showGiveawayAdminMenu, handleGiveawayAdminCallbacks,
} from "./giveaway-handlers.ts";
import { setChildBotContext, clearChildBotContext } from "./child-context.ts";

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Detect modes
  const url = new URL(req.url);
  const isGiveaway = url.searchParams.get("bot") === "giveaway" || req.headers.get("X-Bot-Mode") === "giveaway";
  const childBotId = url.searchParams.get("child");

  // Create supabase client early (needed for child bot lookup)
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Clear child context from any previous request
  clearChildBotContext();

  // ===== CHILD BOT MODE =====
  let BOT_TOKEN: string | null = null;
  let isChildMode = false;

  if (childBotId) {
    const { data: childBot } = await supabase.from("child_bots").select("*").eq("id", childBotId).single();
    if (!childBot || !childBot.is_active) return jsonOk();
    BOT_TOKEN = childBot.bot_token;
    isChildMode = true;
    setChildBotContext({
      id: childBot.id,
      bot_token: childBot.bot_token,
      owner_telegram_id: childBot.owner_telegram_id,
      revenue_percent: childBot.revenue_percent,
      bot_username: childBot.bot_username,
    });
    // Per-child premium emoji override (falls back to global if not set)
    await initPremiumEmoji(supabase, childBotId);
  } else {
    // Global premium emoji toggle
    await initPremiumEmoji(supabase);
    if (req.method === "GET" && !isGiveaway) {
    if (url.searchParams.get("action") === "upi_redirect") {
      const pa = url.searchParams.get("pa") || UPI_ID;
      const pn = url.searchParams.get("pn") || UPI_NAME;
      const am = url.searchParams.get("am") || "0";
      const cu = url.searchParams.get("cu") || "INR";
      const tn = (url.searchParams.get("tn") || "Payment").slice(0, 80);
      const upiUrl = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${encodeURIComponent(am)}&cu=${encodeURIComponent(cu)}&tn=${encodeURIComponent(tn)}`;
      const qrUrl = `https://quickchart.io/qr?size=320&text=${encodeURIComponent(upiUrl)}`;

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Open UPI Payment</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f8; margin: 0; padding: 24px; color: #111827; }
      .card { max-width: 420px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 10px 28px rgba(0,0,0,0.08); padding: 20px; text-align: center; }
      .btn { display: inline-block; margin-top: 12px; padding: 12px 16px; border-radius: 10px; text-decoration: none; font-weight: 600; }
      .btn-primary { background: #111827; color: white; }
      .btn-secondary { background: #e5e7eb; color: #111827; }
      .hint { font-size: 13px; color: #6b7280; margin-top: 10px; }
      img { width: 220px; height: 220px; border-radius: 12px; margin-top: 12px; }
      #fallback { display: none; margin-top: 14px; }
      code { word-break: break-all; font-size: 12px; display: block; margin-top: 10px; background: #f3f4f6; padding: 10px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Opening UPI app…</h2>
      <p class="hint">If your app doesn't open automatically, use the button below or scan QR.</p>
      <div id="fallback">
        <a class="btn btn-primary" href="${upiUrl}">💳 Open UPI App</a><br/>
        <a class="btn btn-secondary" href="#" onclick="copyUpi(event)">📋 Copy UPI Link</a>
        <img src="${qrUrl}" alt="UPI QR Code" />
        <code id="upiText">${upiUrl}</code>
      </div>
    </div>
    <script>
      const upiUrl = ${JSON.stringify("" + upiUrl)};
      const fallbackEl = document.getElementById('fallback');
      setTimeout(() => { window.location.href = upiUrl; }, 50);
      setTimeout(() => { if (fallbackEl) fallbackEl.style.display = 'block'; }, 1200);
      function copyUpi(e) {
        e.preventDefault();
        if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(upiUrl); alert('UPI link copied'); return; }
        const temp = document.createElement('textarea'); temp.value = upiUrl; document.body.appendChild(temp); temp.select(); document.execCommand('copy'); document.body.removeChild(temp); alert('UPI link copied');
      }
      window.copyUpi = copyUpi;
    </script>
  </body>
</html>`;

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
    }
  }

  // Resolve bot token (if not child mode)
  if (!BOT_TOKEN) {
    if (isGiveaway) {
      BOT_TOKEN = Deno.env.get("GIVEAWAY_BOT_TOKEN") || null;
    } else {
      const tokenResult = await resolveTelegramBotTokens({
        configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN") ?? null,
        configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN") ?? null,
        expectedMainUsername: BOT_USERNAME,
        expectedResaleUsername: RESALE_BOT_USERNAME,
      });
      BOT_TOKEN = tokenResult.mainBotToken;

      if (tokenResult.tokenUsernames.configuredMainTokenUsername &&
          tokenResult.tokenUsernames.configuredMainTokenUsername.toLowerCase() !== BOT_USERNAME.toLowerCase()) {
        console.warn(`TELEGRAM_BOT_TOKEN mapped to @${tokenResult.tokenUsernames.configuredMainTokenUsername}; using resolved for @${BOT_USERNAME}`);
      }
    }
  }

  if (!BOT_TOKEN) {
    return new Response("Bot token not configured", { status: 500 });
  }

  try {
    const update = await req.json();

    // ===== CALLBACK QUERIES =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      const telegramUser = cq.from;
      const userId = telegramUser.id;

      const upsertPromises: Promise<any>[] = [
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
        answerCallbackQuery(BOT_TOKEN, cq.id),
      ];

      // Also upsert child bot user if in child mode
      if (isChildMode && childBotId) {
        upsertPromises.push(
          Promise.resolve(supabase.from("child_bot_users").upsert({
            child_bot_id: childBotId,
            telegram_id: userId,
            username: telegramUser.username || null,
            first_name: telegramUser.first_name || null,
            last_active: new Date().toISOString(),
          }, { onConflict: "child_bot_id,telegram_id" }))
        );
      }

      const [userData] = await Promise.all(upsertPromises);

      if (userData.is_banned) { clearChildBotContext(); return jsonOk(); }
      const lang = userData.language || "en";

      // Giveaway-specific callbacks (before menu callbacks to override back_main)
      if (isGiveaway && await handleGiveawayAdminCallbacks(BOT_TOKEN, supabase, chatId, userId, data)) { clearChildBotContext(); return jsonOk(); }
      if (isGiveaway && await handleGiveawayCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) { clearChildBotContext(); return jsonOk(); }

      // For giveaway mode, override back_main to show giveaway menu
      if (isGiveaway && data === "back_main") {
        await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId);
        clearChildBotContext();
        return jsonOk();
      }

      // Giveaway language selection override
      if (isGiveaway && (data === "lang_en" || data === "lang_bn")) {
        const selectedLang = data === "lang_en" ? "en" : "bn";
        await setUserLang(supabase, userId, selectedLang);
        await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
        const MAIN_TOKEN_FOR_CHECK = Deno.env.get("TELEGRAM_BOT_TOKEN") || BOT_TOKEN;
        const { checkGiveawayChannels } = await import("./giveaway-handlers.ts");
        const joined = await checkGiveawayChannels(MAIN_TOKEN_FOR_CHECK, userId);
        if (!joined) {
          const { showGiveawayJoinChannels } = await import("./giveaway-handlers.ts");
          await showGiveawayJoinChannels(BOT_TOKEN, supabase, chatId, selectedLang, userId);
        } else {
          await ensureWallet(supabase, userId);
          await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, selectedLang, userId);
        }
        clearChildBotContext();
        return jsonOk();
      }

      // Standard callbacks
      if (await handleAdminCallbacks(BOT_TOKEN, supabase, chatId, userId, data)) { clearChildBotContext(); return jsonOk(); }
      if (await handlePaymentCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) { clearChildBotContext(); return jsonOk(); }

      // Escrow callbacks
      if (data === "escrow_menu") {
        const { handleEscrowCommand } = await import("./escrow-handler.ts");
        await handleEscrowCommand(BOT_TOKEN, supabase, chatId, userId);
        clearChildBotContext(); return jsonOk();
      }
      if (data === "escrow_new") {
        const { escrowStartCreate } = await import("./escrow-handler.ts");
        await escrowStartCreate(BOT_TOKEN, supabase, chatId, userId);
        clearChildBotContext(); return jsonOk();
      }
      if (data === "escrow_list_active" || data === "escrow_list_closed") {
        const { escrowListDeals } = await import("./escrow-handler.ts");
        await escrowListDeals(BOT_TOKEN, supabase, chatId, userId, data === "escrow_list_active" ? "active" : "closed", cq.message.message_id);
        clearChildBotContext(); return jsonOk();
      }
      if (data.startsWith("escrow_view_")) {
        const { escrowViewDeal } = await import("./escrow-handler.ts");
        await escrowViewDeal(BOT_TOKEN, supabase, chatId, userId, data.slice(12), cq.message.message_id);
        clearChildBotContext(); return jsonOk();
      }
      if (data.startsWith("escrow_deliver_skip_")) {
        const { escrowDeliverSkip } = await import("./escrow-handler.ts");
        await escrowDeliverSkip(BOT_TOKEN, supabase, chatId, userId, data.slice(20), cq.id);
        clearChildBotContext(); return jsonOk();
      }
      const escrowActionMatch = data.match(/^escrow_(accept|decline|cancel|buyer_cancel|deliver|release|dispute|chat)_(.+)$/);
      if (escrowActionMatch) {
        const { escrowAction } = await import("./escrow-handler.ts");
        await escrowAction(BOT_TOKEN, supabase, chatId, userId, escrowActionMatch[1], escrowActionMatch[2], cq.id, cq.message.message_id);
        clearChildBotContext(); return jsonOk();
      }

      if (await handleMenuCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) { clearChildBotContext(); return jsonOk(); }

      clearChildBotContext();
      return jsonOk();
    }

    // ===== TEXT/PHOTO MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUser = msg.from;
      const userId = telegramUser.id;
      const text = msg.text || "";

      const upsertPromises: Promise<any>[] = [
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
      ];

      if (isChildMode && childBotId) {
        upsertPromises.push(
          Promise.resolve(supabase.from("child_bot_users").upsert({
            child_bot_id: childBotId,
            telegram_id: userId,
            username: telegramUser.username || null,
            first_name: telegramUser.first_name || null,
            last_active: new Date().toISOString(),
          }, { onConflict: "child_bot_id,telegram_id" }))
        );
      }

      const [userData] = await Promise.all(upsertPromises);

      if (userData.is_banned) { clearChildBotContext(); return jsonOk(); }
      const lang = userData.language || "en";

      // Reset conversation state on commands
      if (text.startsWith("/")) {
        await deleteConversationState(supabase, userId);
      } else {
        const convState = await getConversationState(supabase, userId);
        if (convState) {
          await handleConversationStep(BOT_TOKEN, supabase, chatId, userId, msg, convState);
          clearChildBotContext();
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

            if (isGiveaway) {
              await handleGiveawayStart(BOT_TOKEN, supabase, chatId, userId, telegramUser, payload, lang, userData);
              clearChildBotContext();
              return jsonOk();
            }

            // Child bot mode: skip resale redirect
            if (!isChildMode && payload.startsWith("ref_")) {
              await handleStartWithRef(BOT_TOKEN, supabase, userId, telegramUser, payload.replace("ref_", ""), lang);
            } else if (!isChildMode && payload.startsWith("buy_")) {
              const linkCode = payload.replace("buy_", "");
              const resaleUrl = `https://t.me/${RESALE_BOT_USERNAME}?start=buy_${linkCode}`;
              await sendMessage(BOT_TOKEN, chatId,
                lang === "bn"
                  ? `🔒 এই রিসেল লিংক শুধুমাত্র রিসেলার বটে খোলে।\n\n👉 এখানে যান: <code>${resaleUrl}</code>`
                  : `🔒 This resale link works only in the reseller bot.\n\n👉 Open here: <code>${resaleUrl}</code>`,
                { reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "🚀 রিসেলার বটে যান" : "🚀 Open Reseller Bot", url: resaleUrl }]] } }
              );
              clearChildBotContext();
              return jsonOk();
            } else if (payload.startsWith("ref_")) {
              // Child bot referral
              await handleStartWithRef(BOT_TOKEN, supabase, userId, telegramUser, payload.replace("ref_", ""), lang);
            }

            if (!userData.language) { await showLanguageSelection(BOT_TOKEN, chatId); clearChildBotContext(); return jsonOk(); }

            // Check if user has active payment/deposit session — don't interrupt it
            const activeConvState = await getConversationState(supabase, userId);
            const paymentSteps = [
              "choose_payment_method", "wallet_pay_confirm", "binance_payment_pending",
              "binance_awaiting_screenshot", "razorpay_payment_pending", "choose_upi_method",
              "awaiting_quantity_choice", "awaiting_custom_quantity", "awaiting_screenshot",
              "deposit_binance_awaiting_screenshot", "deposit_razorpay_pending", "deposit_upi_pending",
              "deposit_enter_amount", "deposit_choose_method",
            ];
            if (activeConvState && paymentSteps.includes(activeConvState.step)) {
              await sendMessage(BOT_TOKEN, chatId,
                lang === "bn"
                  ? "⚠️ তোমার একটি পেমেন্ট সেশন চলছে। বাতিল করতে /cancel পাঠাও।"
                  : "⚠️ You have an active payment session. Send /cancel to abort it first."
              );
              clearChildBotContext();
              return jsonOk();
            }

            const [isUserAdmin, joined] = await Promise.all([
              isAdminBot(supabase, userId),
              checkChannelMembership(BOT_TOKEN, userId, supabase),
              ensureWallet(supabase, userId),
            ]);

            // Auto-create website account on /start
            try {
              const { resolveProfileUserId } = await import("../_shared/profile-id-resolver.ts");
              await resolveProfileUserId(supabase, userId);
            } catch (e) {
              console.error("Auto-create website profile on /start failed:", e);
            }

            if (!isUserAdmin && !joined) { await showJoinChannels(BOT_TOKEN, supabase, chatId, lang); clearChildBotContext(); return jsonOk(); }

            await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
            break;
          }
          case "/menu":
            if (isGiveaway) { await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId); }
            else { await showMainMenu(BOT_TOKEN, supabase, chatId, lang); }
            break;
          case "/points":
          case "/balance":
            if (isGiveaway) {
              const gp = await supabase.from("giveaway_points").select("*").eq("telegram_id", userId).single();
              const pts = gp.data?.points || 0;
              const refs = gp.data?.total_referrals || 0;
              await sendMessage(BOT_TOKEN, chatId,
                `💰 <b>Points:</b> ${pts}\n👥 <b>Referrals:</b> ${refs}`, {
                reply_markup: { inline_keyboard: [[{ text: "📎 Referral Link", callback_data: "gw_referral" }]] }
              });
            }
            break;
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
            await handleSupport(BOT_TOKEN, supabase, chatId, lang); break;
          case "/setemail":
          case "/email": {
            const { handleSetEmailCommand } = await import("./email-handler.ts");
            const inline = parts.slice(1).join(" ").trim();
            await handleSetEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang, inline);
            break;
          }
          case "/myemail": {
            const { handleMyEmailCommand } = await import("./email-handler.ts");
            await handleMyEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang);
            break;
          }
          case "/help": {
            // Direct connect to admin (same flow as "Forward to Admin" button)
            await setConversationState(supabase, userId, "chatting_with_admin", {});
            const uname = telegramUser.username ? `@${telegramUser.username}` : (telegramUser.first_name || "User");
            await notifyAllAdmins(BOT_TOKEN, supabase,
              `📩 User ${uname} (<code>${userId}</code>) wants admin help.`,
              { reply_markup: { inline_keyboard: [[{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }]] } }
            );
            await sendMessage(BOT_TOKEN, chatId, lang === "bn"
              ? "✅ আপনি এখন সরাসরি অ্যাডমিনের সাথে চ্যাটে আছেন। আপনার মেসেজ লিখুন — শীঘ্রই উত্তর পাবেন।\n\n💬 চ্যাট শেষ করতে /endchat লিখুন।"
              : "✅ You are now directly connected to admin. Type your message — you'll get a reply soon.\n\n💬 Type /endchat to end the chat."
            );
            break;
          }
          case "/refer":
          case "/referral":
          case "/share":
            if (isGiveaway) { await showGiveawayReferralLink(BOT_TOKEN, supabase, chatId, userId, lang); }
            else { await handleReferEarn(BOT_TOKEN, supabase, chatId, userId, lang); }
            break;
          case "/offers":
            await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); break;
          case "/login":
            // Child bots don't provide website login
            if (isChildMode) {
              await sendMessage(BOT_TOKEN, chatId, "❌ This command is not available.");
            } else {
              await handleLoginCode(BOT_TOKEN, supabase, chatId, userId, lang);
            }
            break;
          case "/redeem": {
            if (isGiveaway) break;
            const { handleRedeemCommand } = await import("./redeem-handler.ts");
            const inlineCode = parts.slice(1).join(" ").trim();
            await handleRedeemCommand(BOT_TOKEN, supabase, chatId, userId, lang, inlineCode);
            break;
          }
          case "/send": {
            if (isGiveaway) break;
            const { handleSendCommand } = await import("./send-handler.ts");
            await handleSendCommand(BOT_TOKEN, supabase, chatId, userId, lang);
            break;
          }
          case "/escrow": {
            if (isGiveaway || isChildMode) break;
            const { handleEscrowCommand } = await import("./escrow-handler.ts");
            await handleEscrowCommand(BOT_TOKEN, supabase, chatId, userId);
            break;
          }
          case "/users": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); break;
          }
          case "/stats": {
            if (isGiveaway) {
              await showGiveawayStats(BOT_TOKEN, supabase, chatId, userId, lang);
            } else {
              const { data: wallet } = await supabase.from("telegram_wallets").select("balance, total_earned, is_reseller, referral_code").eq("telegram_id", userId).single();
              const { count: orderCount } = await supabase.from("telegram_orders").select("id", { count: "exact", head: true }).eq("telegram_user_id", userId);
              const { count: referralCount } = await supabase.from("telegram_wallets").select("id", { count: "exact", head: true }).eq("referred_by", userId);
              const bal = wallet?.balance || 0;
              const earned = wallet?.total_earned || 0;
              const refCode = wallet?.referral_code || "N/A";
              const isReseller = wallet?.is_reseller ? "✅" : "❌";
              const statsText = lang === "bn"
                ? `📊 <b>আপনার পরিসংখ্যান</b>\n\n💰 ব্যালেন্স: <b>₹${bal}</b>\n💵 মোট আয়: <b>₹${earned}</b>\n📦 মোট অর্ডার: <b>${orderCount || 0}</b>\n👥 রেফারেল: <b>${referralCount || 0}</b>\n🏷️ রেফারেল কোড: <code>${refCode}</code>\n🔄 রিসেলার: ${isReseller}`
                : `📊 <b>Your Stats</b>\n\n💰 Balance: <b>₹${bal}</b>\n💵 Total Earned: <b>₹${earned}</b>\n📦 Total Orders: <b>${orderCount || 0}</b>\n👥 Referrals: <b>${referralCount || 0}</b>\n🏷️ Referral Code: <code>${refCode}</code>\n🔄 Reseller: ${isReseller}`;
              await sendMessage(BOT_TOKEN, chatId, statsText, {
                reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] }
              });
            }
            break;
          }
          case "/admin":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            if (isGiveaway) {
              await showGiveawayAdminMenu(BOT_TOKEN, supabase, chatId);
            } else {
              await handleAdminMenu(BOT_TOKEN, supabase, chatId, userId);
            }
            break;
          case "/chat": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            const targetId = parseInt(parts[1]);
            if (!targetId) {
              await sendMessage(BOT_TOKEN, chatId, "⚠️ Usage: <code>/chat {user_id}</code>\n\nExample: <code>/chat 123456789</code>");
              break;
            }
            await setConversationState(supabase, userId, "admin_reply", { targetUserId: targetId });
            await sendMessage(BOT_TOKEN, chatId,
              `💬 <b>Chat Mode</b>\n\nYou are now chatting with user <code>${targetId}</code>.\n\nType your message or send a photo.\nSend /endchat to stop.`
            );
            break;
          }
          case "/broadcast":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "broadcast_message", {});
            await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel."); break;
          default: {
            const searchTerm = command.replace("/", "").trim();
            if (searchTerm.length >= 2) {
              const { data: matchedProducts } = await supabase
                .from("products")
                .select("id, name")
                .eq("is_active", true)
                .ilike("name", `%${searchTerm}%`)
                .limit(10);

              if (matchedProducts && matchedProducts.length === 1) {
                await handleProductDetail(BOT_TOKEN, supabase, chatId, matchedProducts[0].id, lang, userId);
              } else if (matchedProducts && matchedProducts.length > 1) {
                let searchText = lang === "bn"
                  ? `🔍 <b>"${searchTerm}" এর জন্য ${matchedProducts.length}টি পণ্য পাওয়া গেছে:</b>\n\n`
                  : `🔍 <b>Found ${matchedProducts.length} products for "${searchTerm}":</b>\n\n`;
                const buttons = matchedProducts.map((p: any) => [{ text: p.name, callback_data: `product_${p.id}` }]);
                buttons.push([{ text: `🔴 ${t("back_main", lang)}`, callback_data: isGiveaway ? "gw_main" : "back_main" }]);
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
        clearChildBotContext();
        return jsonOk();
      }

      // Non-command text → route to AI assistant
      await handleAIQuery(BOT_TOKEN, supabase, chatId, userId, text, lang);
      clearChildBotContext();
      return jsonOk();
    }

    // ===== CHAT MEMBER UPDATES (channel leave/join) =====
    if (update.chat_member && isGiveaway) {
      const { handleGiveawayChannelLeave } = await import("./giveaway-handlers.ts");
      await handleGiveawayChannelLeave(BOT_TOKEN, supabase, update.chat_member);
      clearChildBotContext();
      return jsonOk();
    }

    clearChildBotContext();
    return jsonOk();
  } catch (error) {
    console.error("Telegram bot error:", error);
    clearChildBotContext();
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
