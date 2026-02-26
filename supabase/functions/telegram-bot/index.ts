// ===== MAIN ENTRY POINT =====
// All logic is split into separate modules for maintainability.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./constants.ts";
import { answerCallbackQuery } from "./telegram-api.ts";
import {
  isSuperAdmin, isAdminBot, upsertTelegramUser, isBanned,
  getUserLang, setUserLang, ensureWallet, checkChannelMembership,
  getConversationState, deleteConversationState, setConversationState,
  notifyAllAdmins,
} from "./db-helpers.ts";
import {
  showLanguageSelection, showJoinChannels, showMainMenu,
  handleViewCategories, handleCategoryProducts, handleProductDetail,
  handleMyOrders, handleMyWallet, handleReferEarn, handleSupport,
  handleGetOffers, forwardUserMessageToAdmin,
} from "./menu-handlers.ts";
import {
  handleBuyProduct, handleBuyVariation, handleWalletPay, handleAdminAction,
} from "./payment-handlers.ts";
import {
  handleResaleStart, handleResaleVariationStart, handleResaleBuy, handleStartWithRef,
} from "./resale-handlers.ts";
import {
  handleAdminMenu, handleReport, handleEditPrice, handleOutStock,
  handleUsersCommand, handleHistoryCommand, handleBanCommand,
  handleMakeReseller, handleAddAdmin, handleRemoveAdmin,
  handleListAdmins, handleAllUsers,
} from "./admin-handlers.ts";
import { handleConversationStep } from "./conversation-handlers.ts";
import { handleAIQuery } from "./ai-handler.ts";
import { t } from "./constants.ts";
import { sendMessage } from "./telegram-api.ts";

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) return new Response("Bot token not configured", { status: 500 });

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

      if (await isBanned(supabase, userId)) {
        await answerCallbackQuery(BOT_TOKEN, cq.id);
        return jsonOk();
      }

      await upsertTelegramUser(supabase, telegramUser);
      await answerCallbackQuery(BOT_TOKEN, cq.id);

      const lang = (await getUserLang(supabase, userId)) || "en";

      // Language selection
      if (data === "lang_en" || data === "lang_bn") {
        const selectedLang = data === "lang_en" ? "en" : "bn";
        await setUserLang(supabase, userId, selectedLang);
        await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
        const joined = await checkChannelMembership(BOT_TOKEN, userId);
        if (!joined) {
          await showJoinChannels(BOT_TOKEN, chatId, selectedLang);
        } else {
          await ensureWallet(supabase, userId);
          await showMainMenu(BOT_TOKEN, supabase, chatId, selectedLang);
        }
        return jsonOk();
      }

      // Verify join
      if (data === "verify_join") {
        const joined = await checkChannelMembership(BOT_TOKEN, userId);
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
          await handleWalletPay(BOT_TOKEN, supabase, chatId, userId, convState.data.price, convState.data.productName, lang);
        } else {
          await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ সেশন মেয়াদ উত্তীর্ণ। আবার চেষ্টা করুন।" : "❌ Session expired. Please try again.");
        }
        return jsonOk();
      }

      // My orders
      if (data === "my_orders") { await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
      // My wallet
      if (data === "my_wallet") { await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang); return jsonOk(); }
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

      if (await isBanned(supabase, userId)) return jsonOk();

      await upsertTelegramUser(supabase, telegramUser);

      // Check conversation state first
      const convState = await getConversationState(supabase, userId);
      if (convState) {
        await handleConversationStep(BOT_TOKEN, supabase, chatId, userId, msg, convState);
        return jsonOk();
      }

      // Commands
      if (text.startsWith("/")) {
        const parts = text.split(" ");
        const command = parts[0].toLowerCase().split("@")[0];
        const lang = (await getUserLang(supabase, userId)) || "en";

        switch (command) {
          case "/start": {
            const payload = parts[1] || "";
            await ensureWallet(supabase, userId);

            if (payload.startsWith("ref_")) {
              await handleStartWithRef(supabase, userId, payload.replace("ref_", ""));
            } else if (payload.startsWith("buy_")) {
              await handleResaleBuy(BOT_TOKEN, supabase, chatId, userId, telegramUser, payload.replace("buy_", ""), lang);
              return jsonOk();
            }

            const userLang = await getUserLang(supabase, userId);
            if (!userLang) { await showLanguageSelection(BOT_TOKEN, chatId); return jsonOk(); }

            const joined = await checkChannelMembership(BOT_TOKEN, userId);
            if (!joined) { await showJoinChannels(BOT_TOKEN, chatId, userLang); return jsonOk(); }

            await showMainMenu(BOT_TOKEN, supabase, chatId, userLang);
            break;
          }
          case "/products":
          case "/categories":
            await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); break;
          case "/myorders":
          case "/orders":
            await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); break;
          case "/help":
            await sendMessage(BOT_TOKEN, chatId,
              lang === "bn"
                ? "📖 <b>কমান্ড:</b>\n/start - মূল মেনু\n/products - পণ্য দেখুন\n/myorders - আমার অর্ডার\n/help - সাহায্য"
                : "📖 <b>Commands:</b>\n/start - Main menu\n/products - View products\n/myorders - My orders\n/help - Show help"
            ); break;
          // Admin commands
          case "/admin":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAdminMenu(BOT_TOKEN, supabase, chatId); break;
          case "/broadcast":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "broadcast_message", {});
            await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel."); break;
          case "/report":
          case "/stats":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleReport(BOT_TOKEN, supabase, chatId); break;
          case "/add_product":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "add_photo", {});
            await sendMessage(BOT_TOKEN, chatId, "📸 <b>Add Product (Step 1/4)</b>\n\nSend the product photo.\n/cancel to cancel."); break;
          case "/edit_price":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleEditPrice(BOT_TOKEN, supabase, chatId, text.substring("/edit_price".length).trim()); break;
          case "/out_stock":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleOutStock(BOT_TOKEN, supabase, chatId, text.substring("/out_stock".length).trim()); break;
          case "/users":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleUsersCommand(BOT_TOKEN, supabase, chatId); break;
          case "/history":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleHistoryCommand(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0); break;
          case "/ban":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleBanCommand(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0, true); break;
          case "/unban":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleBanCommand(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0, false); break;
          case "/make_reseller":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleMakeReseller(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0); break;
          case "/add_admin":
            if (!isSuperAdmin(userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAddAdmin(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0); break;
          case "/remove_admin":
            if (!isSuperAdmin(userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleRemoveAdmin(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0); break;
          case "/admins":
            if (!isSuperAdmin(userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleListAdmins(BOT_TOKEN, supabase, chatId); break;
          case "/allusers":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); break;
          default: break;
        }
        return jsonOk();
      }

      // Non-command messages
      const lang = (await getUserLang(supabase, userId)) || "en";

      if (!await getUserLang(supabase, userId)) { await showLanguageSelection(BOT_TOKEN, chatId); return jsonOk(); }

      const joined = await checkChannelMembership(BOT_TOKEN, userId);
      if (!joined) { await showJoinChannels(BOT_TOKEN, chatId, lang); return jsonOk(); }

      // Photos forwarded to admin
      if (msg.photo) { await forwardUserMessageToAdmin(BOT_TOKEN, supabase, msg, telegramUser, lang); return jsonOk(); }

      // AI auto-reply for non-admin text
      if (!await isAdminBot(supabase, userId) && text && text.trim().length > 0) {
        await handleAIQuery(BOT_TOKEN, supabase, chatId, userId, text, lang);
        return jsonOk();
      }

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
