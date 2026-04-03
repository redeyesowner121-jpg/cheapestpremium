// ===== MAIN ENTRY POINT =====
// All logic is split into separate modules for maintainability.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  showBinancePayment, showUpiPayment, showRazorpayUpiPayment, showManualUpiPayment, handleBinanceVerify, handleRazorpayVerify,
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

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
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

      setTimeout(() => {
        window.location.href = upiUrl;
      }, 50);

      setTimeout(() => {
        if (fallbackEl) fallbackEl.style.display = 'block';
      }, 1200);

      function copyUpi(e) {
        e.preventDefault();
        const text = upiUrl;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text);
          alert('UPI link copied');
          return;
        }
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        alert('UPI link copied');
      }
      window.copyUpi = copyUpi;
    </script>
  </body>
</html>`;

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const { mainBotToken: BOT_TOKEN, tokenUsernames } = await resolveTelegramBotTokens({
    configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
    configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
    expectedMainUsername: BOT_USERNAME,
    expectedResaleUsername: RESALE_BOT_USERNAME,
  });

  if (!BOT_TOKEN) {
    return new Response("Bot token not configured", { status: 500 });
  }

  if (
    tokenUsernames.configuredMainTokenUsername &&
    tokenUsernames.configuredMainTokenUsername.toLowerCase() !== BOT_USERNAME.toLowerCase()
  ) {
    console.warn(
      `TELEGRAM_BOT_TOKEN is mapped to @${tokenUsernames.configuredMainTokenUsername}; using resolved token for @${BOT_USERNAME}`
    );
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

      // Parallel: fetch user data + upsert + answer callback (fire-and-forget)
      const [userData] = await Promise.all([
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
        answerCallbackQuery(BOT_TOKEN, cq.id),
      ]);

      if (userData.is_banned) return jsonOk();
      const lang = userData.language || "en";

      // ===== ADMIN MENU CALLBACKS =====
      if (data.startsWith("adm_")) {
        if (!await isAdminBot(supabase, userId)) { return jsonOk(); }

        // Main admin menu
        if (data === "adm_back") { await handleAdminMenu(BOT_TOKEN, supabase, chatId, userId); return jsonOk(); }

        // Sub-menus
        if (data === "adm_products") { await handleAdminProductsMenu(BOT_TOKEN, chatId); return jsonOk(); }
        if (data === "adm_users") { await handleAdminUsersMenu(BOT_TOKEN, chatId); return jsonOk(); }
        if (data === "adm_wallet") { await handleAdminWalletMenu(BOT_TOKEN, chatId); return jsonOk(); }
        if (data === "adm_analytics") { await handleReport(BOT_TOKEN, supabase, chatId); return jsonOk(); }
        if (data === "adm_channels") { await handleAdminChannelsMenu(BOT_TOKEN, chatId); return jsonOk(); }
        if (data === "adm_settings") { await handleAdminSettingsMenu(BOT_TOKEN, chatId); return jsonOk(); }
        if (data === "adm_owner") {
          if (!isSuperAdmin(userId)) { return jsonOk(); }
          await handleAdminOwnerMenu(BOT_TOKEN, chatId);
          return jsonOk();
        }

        // Broadcast
        if (data === "adm_broadcast") {
          await setConversationState(supabase, userId, "broadcast_message", {});
          await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel.");
          return jsonOk();
        }

        // Product sub-actions
        if (data === "adm_add_product") {
          await setConversationState(supabase, userId, "add_photo", {});
          await sendMessage(BOT_TOKEN, chatId, "📸 <b>Add Product (Step 1/4)</b>\n\nSend the product photo.\n/cancel to cancel.");
          return jsonOk();
        }
        if (data === "adm_edit_price") {
          await setConversationState(supabase, userId, "admin_edit_price", {});
          await sendMessage(BOT_TOKEN, chatId, "✏️ <b>Edit Price</b>\n\nProduct নাম এবং নতুন দাম লিখুন:\n<code>Netflix 199</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_out_stock") {
          await setConversationState(supabase, userId, "admin_out_stock", {});
          await sendMessage(BOT_TOKEN, chatId, "❌ <b>Out of Stock</b>\n\nProduct নাম লিখুন:\n<code>Netflix</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }

        // User sub-actions
        if (data === "adm_recent_users") { await handleUsersCommand(BOT_TOKEN, supabase, chatId); return jsonOk(); }
        if (data === "adm_all_users") { await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); return jsonOk(); }
        if (data === "adm_history") {
          await setConversationState(supabase, userId, "admin_history", {});
          await sendMessage(BOT_TOKEN, chatId, "📜 <b>Order History</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_make_reseller") {
          await setConversationState(supabase, userId, "admin_make_reseller", {});
          await sendMessage(BOT_TOKEN, chatId, "🔄 <b>Make Reseller</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_ban") {
          await setConversationState(supabase, userId, "admin_ban_user", {});
          await sendMessage(BOT_TOKEN, chatId, "🚫 <b>Ban User</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_unban") {
          await setConversationState(supabase, userId, "admin_unban_user", {});
          await sendMessage(BOT_TOKEN, chatId, "✅ <b>Unban User</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }

        // Wallet sub-actions
        if (data === "adm_add_balance") {
          await setConversationState(supabase, userId, "admin_add_balance", {});
          await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Balance</b>\n\nUser ID এবং Amount লিখুন:\n<code>123456789 500</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_deduct_balance") {
          await setConversationState(supabase, userId, "admin_deduct_balance", {});
          await sendMessage(BOT_TOKEN, chatId, "➖ <b>Deduct Balance</b>\n\nUser ID এবং Amount লিখুন:\n<code>123456789 500</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }

        // Channel sub-actions
        if (data === "adm_list_channels") { await handleListChannels(BOT_TOKEN, supabase, chatId); return jsonOk(); }
        if (data === "adm_add_channel") {
          await setConversationState(supabase, userId, "admin_add_channel", {});
          await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Channel</b>\n\nChannel username লিখুন:\n<code>@channel_name</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_remove_channel") {
          await setConversationState(supabase, userId, "admin_remove_channel", {});
          await sendMessage(BOT_TOKEN, chatId, "➖ <b>Remove Channel</b>\n\nChannel username লিখুন:\n<code>@channel_name</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }

        // Owner sub-actions
        if (data === "adm_add_admin") {
          await setConversationState(supabase, userId, "admin_add_admin", {});
          await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Admin</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_remove_admin") {
          await setConversationState(supabase, userId, "admin_remove_admin", {});
          await sendMessage(BOT_TOKEN, chatId, "➖ <b>Remove Admin</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
          return jsonOk();
        }
        if (data === "adm_list_admins") { await handleListAdmins(BOT_TOKEN, supabase, chatId); return jsonOk(); }

        // Settings categories
        if (data === "adm_set_payment") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "payment"); return jsonOk(); }
        if (data === "adm_set_bonus") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "bonus"); return jsonOk(); }
        if (data === "adm_set_store") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "store"); return jsonOk(); }
        if (data === "adm_set_bot") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "bot"); return jsonOk(); }
        if (data === "adm_set_security") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "security"); return jsonOk(); }

        // Individual setting edit
        if (data.startsWith("adm_edit_set_")) {
          const settingKey = data.replace("adm_edit_set_", "");
          await setConversationState(supabase, userId, "admin_edit_setting", { settingKey });
          await promptSettingEdit(BOT_TOKEN, supabase, chatId, settingKey);
          return jsonOk();
        }

        // AI Training
        if (data === "adm_ai_training") { await handleAITrainingMenu(BOT_TOKEN, supabase, chatId); return jsonOk(); }

        return jsonOk();
      }

      // Language selection
      if (data === "lang_en" || data === "lang_bn") {
        const selectedLang = data === "lang_en" ? "en" : "bn";
        await setUserLang(supabase, userId, selectedLang);
        await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
        const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
        if (!joined) {
          await showJoinChannels(BOT_TOKEN, supabase, chatId, selectedLang);
        } else {
          await ensureWallet(supabase, userId);
          await showMainMenu(BOT_TOKEN, supabase, chatId, selectedLang);
        }
        return jsonOk();
      }

      // Verify join
      if (data === "verify_join") {
        const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
        if (!joined) {
          await sendMessage(BOT_TOKEN, chatId, t("not_joined", lang));
        } else {
          await sendMessage(BOT_TOKEN, chatId, t("verified", lang));
          await ensureWallet(supabase, userId);
          await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
        }
        return jsonOk();
      }

      // Forward to admin
      if (data === "forward_to_admin") {
        await setConversationState(supabase, userId, "chatting_with_admin", {});
        await notifyAllAdmins(BOT_TOKEN, supabase,
          `📩 User @${telegramUser.username || telegramUser.first_name} (${userId}) wants admin help.`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }]],
            },
          }
        );
        await sendMessage(BOT_TOKEN, chatId, lang === "bn"
          ? "✅ আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন।\n\n💬 এখন আপনি সরাসরি মেসেজ পাঠাতে পারেন। চ্যাট শেষ করতে /endchat লিখুন।"
          : "✅ Your question has been forwarded to admin. You'll get a reply soon.\n\n💬 You can now send messages directly. Type /endchat to end chat."
        );
        return jsonOk();
      }

      // Admin chat reply
      if (data.startsWith("admin_chat_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        const targetUserId = parseInt(data.replace("admin_chat_", ""));
        await setConversationState(supabase, userId, "admin_reply", { targetUserId });
        await sendMessage(BOT_TOKEN, chatId, `💬 <b>Chat mode with user <code>${targetUserId}</code></b>\n\nType messages to send. Each message will be delivered to the user.\n\nSend /endchat to end the conversation.`);
        return jsonOk();
      }

      // AI Teach (from unanswered question)
      if (data.startsWith("ai_teach_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        const targetUserId = parseInt(data.replace("ai_teach_", ""));
        const userState = await getConversationState(supabase, targetUserId);
        const originalQuestion = userState?.step === "awaiting_admin_answer" ? userState.data.originalQuestion : null;
        const questionLang = userState?.data?.questionLang || "en";

        await setConversationState(supabase, userId, "admin_teaching_ai", {
          targetUserId,
          originalQuestion: originalQuestion || "Unknown question",
          questionLang,
        });
        await sendMessage(BOT_TOKEN, chatId,
          `📝 <b>Teach AI Mode</b>\n\n❓ User's Question: <b>${originalQuestion || "Unknown"}</b>\n\n✍️ Type your answer. This will:\n1. Be sent to the user\n2. Be saved so AI can answer similar questions in future\n\nSend /cancel to cancel.`
        );
        return jsonOk();
      }

      // AI Training callbacks
      if (data.startsWith("aitrain_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        
        // Delete knowledge entry
        if (data.startsWith("aitrain_del_")) {
          const entryId = data.replace("aitrain_del_", "");
          await executeDeleteKnowledge(BOT_TOKEN, supabase, chatId, entryId);
          return jsonOk();
        }
        
        // View knowledge with pagination
        if (data.startsWith("aitrain_view_")) {
          const page = parseInt(data.replace("aitrain_view_", "")) || 0;
          await handleViewKnowledge(BOT_TOKEN, supabase, chatId, page);
          return jsonOk();
        }
        if (data === "aitrain_view") {
          await handleViewKnowledge(BOT_TOKEN, supabase, chatId, 0);
          return jsonOk();
        }
        
        // Delete menu
        if (data === "aitrain_delete") {
          await startDeleteKnowledge(BOT_TOKEN, supabase, chatId, userId);
          return jsonOk();
        }
        
        // Start training for a category
        const category = data.replace("aitrain_", "");
        await startTrainingCategory(BOT_TOKEN, supabase, chatId, userId, category);
        return jsonOk();
      }

      // Admin actions (confirm/reject/ship)
      if (data.startsWith("admin_confirm_") || data.startsWith("admin_reject_") || data.startsWith("admin_ship_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        const parts = data.split("_");
        const action = parts[1];
        const orderId = data.substring(data.indexOf("_", data.indexOf("_") + 1) + 1);
        const statusMap: Record<string, string> = { confirm: "confirmed", reject: "rejected", ship: "shipped" };
        await handleAdminAction(BOT_TOKEN, supabase, orderId, statusMap[action] || "confirmed", chatId);
        return jsonOk();
      }

      // View products (categories)
      if (data === "view_products") { await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); return jsonOk(); }

      // Category click
      if (data.startsWith("cat_")) {
        const category = decodeURIComponent(data.replace("cat_", ""));
        await handleCategoryProducts(BOT_TOKEN, supabase, chatId, category, lang);
        return jsonOk();
      }

      // Product detail
      if (data.startsWith("product_")) { await handleProductDetail(BOT_TOKEN, supabase, chatId, data.replace("product_", ""), lang, userId); return jsonOk(); }

      // Variation buy
      if (data.startsWith("buyvar_")) { await handleBuyVariation(BOT_TOKEN, supabase, chatId, data.replace("buyvar_", ""), telegramUser, lang); return jsonOk(); }

      // Buy product (no variation)
      if (data.startsWith("buy_")) { await handleBuyProduct(BOT_TOKEN, supabase, chatId, data.replace("buy_", ""), telegramUser, lang); return jsonOk(); }

      // Wallet pay confirm
      if (data === "walletpay_confirm") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "wallet_pay_confirm") {
          await deleteConversationState(supabase, userId);
          await handleWalletPay(BOT_TOKEN, supabase, chatId, userId, convState.data.price, convState.data.productName, lang, convState.data.productId);
        } else {
          await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ সেশন মেয়াদ উত্তীর্ণ। আবার চেষ্টা করুন।" : "❌ Session expired. Please try again.");
        }
        return jsonOk();
      }

      // Payment method choice: Binance
      if (data === "paymethod_binance") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "choose_payment_method") {
          await showBinancePayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
        } else {
          await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
        }
        return jsonOk();
      }

      // Payment method choice: UPI - show Auto/Manual sub-choice
      if (data === "paymethod_upi") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "choose_payment_method") {
          await showUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
        } else {
          await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
        }
        return jsonOk();
      }

      // UPI Auto (Razorpay)
      if (data === "upi_auto") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "choose_upi_method") {
          await showRazorpayUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
        } else {
          await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
        }
        return jsonOk();
      }

      // UPI Manual (Screenshot)
      if (data === "upi_manual") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "choose_upi_method") {
          await showManualUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
        } else {
          await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
        }
        return jsonOk();
      }

      // Binance verify payment
      if (data === "binance_verify") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "binance_payment_pending") {
          await handleBinanceVerify(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
        } else {
          await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
        }
        return jsonOk();
      }

      // Razorpay verify payment
      if (data === "razorpay_verify") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "razorpay_payment_pending") {
          await handleRazorpayVerify(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
        } else {
          await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
        }
        return jsonOk();
      }

      // Razorpay cancel
      if (data === "razorpay_cancel") {
        await deleteConversationState(supabase, userId);
        await sendMessage(BOT_TOKEN, chatId, "Payment cancelled.");
        await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      // Binance cancel
      if (data === "binance_cancel") {
        await deleteConversationState(supabase, userId);
        await sendMessage(BOT_TOKEN, chatId, "Payment cancelled.");
        await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      // My orders
      if (data === "my_orders") { await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
      // My wallet
      if (data === "my_wallet") { await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
      // Wallet operations
      if (data === "wallet_deposit") { await handleWalletDeposit(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
      if (data === "wallet_withdraw") { await handleWalletWithdraw(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
      // Refer & earn
      if (data === "refer_earn") { await handleReferEarn(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
      // Support
      if (data === "support") { await handleSupport(BOT_TOKEN, supabase, chatId, lang); return jsonOk(); }
      // Offers
      if (data === "get_offers") { await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); return jsonOk(); }
      // Back to main
      if (data === "back_main") { await showMainMenu(BOT_TOKEN, supabase, chatId, lang); return jsonOk(); }
      if (data === "back_products") { await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); return jsonOk(); }

      // Resale
      if (data.startsWith("resale_")) { await handleResaleStart(BOT_TOKEN, supabase, chatId, userId, data.replace("resale_", ""), null, lang); return jsonOk(); }
      if (data.startsWith("resalevar_")) { await handleResaleVariationStart(BOT_TOKEN, supabase, chatId, userId, data.replace("resalevar_", ""), lang); return jsonOk(); }

      // All users pagination
      if (data.startsWith("allusers_page_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        await handleAllUsers(BOT_TOKEN, supabase, chatId, parseInt(data.replace("allusers_page_", "")));
        return jsonOk();
      }

      return jsonOk();
    }

    // ===== TEXT/PHOTO MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUser = msg.from;
      const userId = telegramUser.id;
      const text = msg.text || "";

      // Parallel: fetch user data + upsert in one go
      const [userData] = await Promise.all([
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
      ]);

      if (userData.is_banned) return jsonOk();
      const lang = userData.language || "en";

      // Allow /start and all admin/slash commands to reset stuck conversation state
      if (text.startsWith("/")) {
        await deleteConversationState(supabase, userId);
      } else {
        // Check conversation state first (only for non-command messages)
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

            if (payload.startsWith("ref_")) {
              await handleStartWithRef(BOT_TOKEN, supabase, userId, telegramUser, payload.replace("ref_", ""), lang);
            } else if (payload.startsWith("buy_")) {
              const linkCode = payload.replace("buy_", "");
              const resaleUrl = `https://t.me/${RESALE_BOT_USERNAME}?start=buy_${linkCode}`;

              await sendMessage(
                BOT_TOKEN,
                chatId,
                lang === "bn"
                  ? `🔒 এই রিসেল লিংক শুধুমাত্র রিসেলার বটে খোলে।\n\n👉 এখানে যান: <code>${resaleUrl}</code>`
                  : `🔒 This resale link works only in the reseller bot.\n\n👉 Open here: <code>${resaleUrl}</code>`,
                {
                  reply_markup: {
                    inline_keyboard: [[{ text: lang === "bn" ? "🚀 রিসেলার বটে যান" : "🚀 Open Reseller Bot", url: resaleUrl }]],
                  },
                }
              );
              return jsonOk();
            }

            if (!userData.language) { await showLanguageSelection(BOT_TOKEN, chatId); return jsonOk(); }

            // Parallel: admin check + channel check + wallet ensure
            const [isUserAdmin, joined] = await Promise.all([
              isAdminBot(supabase, userId),
              checkChannelMembership(BOT_TOKEN, userId, supabase),
              ensureWallet(supabase, userId),
            ]);
            if (!isUserAdmin && !joined) { await showJoinChannels(BOT_TOKEN, supabase, chatId, lang); return jsonOk(); }

            await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
            break;
          }
          // Admin commands
          case "/admin":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAdminMenu(BOT_TOKEN, supabase, chatId, userId); break;
          case "/broadcast":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "broadcast_message", {});
            await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel."); break;
          default: {
            // Unknown command → try as product name search (e.g. /Netflix, /Spotify)
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
                let text = lang === "bn"
                  ? `🔍 <b>"${searchTerm}" এর জন্য ${matchedProducts.length}টি পণ্য পাওয়া গেছে:</b>\n\n`
                  : `🔍 <b>Found ${matchedProducts.length} products for "${searchTerm}":</b>\n\n`;
                const buttons = matchedProducts.map((p: any) => [
                  { text: p.name, callback_data: `product_${p.id}` },
                ]);
                buttons.push([{ text: t("back_main", lang), callback_data: "back_main" }]);
                await sendMessage(BOT_TOKEN, chatId, text, { reply_markup: { inline_keyboard: buttons } });
              } else {
                await sendMessage(BOT_TOKEN, chatId,
                  lang === "bn"
                    ? `❌ "/${searchTerm}" নামে কোনো পণ্য পাওয়া যায়নি।`
                    : `❌ No product found matching "/${searchTerm}".`
                );
              }
            }
            break;
          }
        }
        return jsonOk();
      }

      // Non-command text → route to AI assistant
      await handleAIQuery(BOT_TOKEN, supabase, chatId, userId, text, lang);
      return jsonOk();
    }

    return jsonOk();
  } catch (error) {
    console.error("Telegram bot error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonOk() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
