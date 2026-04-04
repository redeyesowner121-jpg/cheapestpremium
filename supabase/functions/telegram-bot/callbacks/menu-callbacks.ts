// ===== MENU & NAVIGATION CALLBACK ROUTING =====
import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import {
  setUserLang, ensureWallet, checkChannelMembership,
  isAdminBot, setConversationState, getConversationState,
  notifyAllAdmins, deleteConversationState,
} from "../db-helpers.ts";
import {
  showJoinChannels, showMainMenu, handleSupport,
  handleViewCategories, handleCategoryProducts, handleProductDetail,
  handleMyOrders, handleMyWallet, handleReferEarn,
  handleGetOffers, handleLoginCode,
  handleWalletDeposit, handleWalletWithdraw,
} from "../menu-handlers.ts";
import {
  handleBuyProduct, handleBuyVariation, handleAdminAction,
} from "../payment-handlers.ts";
import {
  handleResaleStart, handleResaleVariationStart,
} from "../resale-handlers.ts";
import {
  executeDeleteKnowledge, handleViewKnowledge,
  startDeleteKnowledge, startTrainingCategory, handleAllUsers,
} from "../admin-handlers.ts";

export async function handleMenuCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

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
    return true;
  }

  if (data === "verify_join") {
    const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
    if (!joined) {
      await sendMessage(BOT_TOKEN, chatId, t("not_joined", lang));
    } else {
      await sendMessage(BOT_TOKEN, chatId, t("verified", lang));
      await ensureWallet(supabase, userId);
      await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
    }
    return true;
  }

  if (data === "forward_to_admin") {
    await setConversationState(supabase, userId, "chatting_with_admin", {});
    await notifyAllAdmins(BOT_TOKEN, supabase,
      `📩 User @${telegramUser.username || telegramUser.first_name} (${userId}) wants admin help.`,
      { reply_markup: { inline_keyboard: [[{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }]] } }
    );
    await sendMessage(BOT_TOKEN, chatId, lang === "bn"
      ? "✅ আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন।\n\n💬 এখন আপনি সরাসরি মেসেজ পাঠাতে পারেন। চ্যাট শেষ করতে /endchat লিখুন।"
      : "✅ Your question has been forwarded to admin. You'll get a reply soon.\n\n💬 You can now send messages directly. Type /endchat to end chat."
    );
    return true;
  }

  if (data.startsWith("admin_chat_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const targetUserId = parseInt(data.replace("admin_chat_", ""));
    await setConversationState(supabase, userId, "admin_reply", { targetUserId });
    await sendMessage(BOT_TOKEN, chatId, `💬 <b>Chat mode with user <code>${targetUserId}</code></b>\n\nType messages to send. Each message will be delivered to the user.\n\nSend /endchat to end the conversation.`);
    return true;
  }

  if (data.startsWith("ai_teach_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const targetUserId = parseInt(data.replace("ai_teach_", ""));
    const userState = await getConversationState(supabase, targetUserId);
    const originalQuestion = userState?.step === "awaiting_admin_answer" ? userState.data.originalQuestion : null;
    const questionLang = userState?.data?.questionLang || "en";
    await setConversationState(supabase, userId, "admin_teaching_ai", { targetUserId, originalQuestion: originalQuestion || "Unknown question", questionLang });
    await sendMessage(BOT_TOKEN, chatId, `📝 <b>Teach AI Mode</b>\n\n❓ User's Question: <b>${originalQuestion || "Unknown"}</b>\n\n✍️ Type your answer. This will:\n1. Be sent to the user\n2. Be saved so AI can answer similar questions in future\n\nSend /cancel to cancel.`);
    return true;
  }

  // AI Training callbacks
  if (data.startsWith("aitrain_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    if (data.startsWith("aitrain_del_")) { await executeDeleteKnowledge(BOT_TOKEN, supabase, chatId, data.replace("aitrain_del_", "")); return true; }
    if (data.startsWith("aitrain_view_")) { await handleViewKnowledge(BOT_TOKEN, supabase, chatId, parseInt(data.replace("aitrain_view_", "")) || 0); return true; }
    if (data === "aitrain_view") { await handleViewKnowledge(BOT_TOKEN, supabase, chatId, 0); return true; }
    if (data === "aitrain_delete") { await startDeleteKnowledge(BOT_TOKEN, supabase, chatId, userId); return true; }
    const category = data.replace("aitrain_", "");
    await startTrainingCategory(BOT_TOKEN, supabase, chatId, userId, category);
    return true;
  }

  // Admin order actions
  if (data.startsWith("admin_confirm_") || data.startsWith("admin_reject_") || data.startsWith("admin_ship_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const parts = data.split("_");
    const action = parts[1];
    const orderId = data.substring(data.indexOf("_", data.indexOf("_") + 1) + 1);
    const statusMap: Record<string, string> = { confirm: "confirmed", reject: "rejected", ship: "shipped" };
    await handleAdminAction(BOT_TOKEN, supabase, orderId, statusMap[action] || "confirmed", chatId);
    return true;
  }

  // Products & Categories
  if (data === "view_products") { await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data.startsWith("cat_")) { await handleCategoryProducts(BOT_TOKEN, supabase, chatId, decodeURIComponent(data.replace("cat_", "")), lang); return true; }
  if (data.startsWith("product_")) { await handleProductDetail(BOT_TOKEN, supabase, chatId, data.replace("product_", ""), lang, userId); return true; }
  if (data.startsWith("buyvar_")) { await handleBuyVariation(BOT_TOKEN, supabase, chatId, data.replace("buyvar_", ""), telegramUser, lang); return true; }
  if (data.startsWith("buy_")) { await handleBuyProduct(BOT_TOKEN, supabase, chatId, data.replace("buy_", ""), telegramUser, lang); return true; }

  // Menu items
  if (data === "my_orders") { await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "my_wallet") { await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "wallet_deposit") { await handleWalletDeposit(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "wallet_withdraw") { await handleWalletWithdraw(BOT_TOKEN, supabase, chatId, userId, lang); return true; }

  // Withdrawal method selection
  if (data === "withdraw_upi" || data === "withdraw_binance") {
    const method = data === "withdraw_upi" ? "upi" : "binance";
    const { getWallet } = await import("../db-helpers.ts");
    const wallet = await getWallet(supabase, userId);
    const balance = wallet?.balance || 0;

    await setConversationState(supabase, userId, "withdraw_enter_details", { method });

    const prompt = method === "upi"
      ? (lang === "bn"
        ? `📱 <b>UPI উইথড্র</b>\n\n💵 ব্যালেন্স: <b>₹${balance}</b>\n\n✏️ আপনার UPI ID লিখুন (যেমন: <code>example@paytm</code>)`
        : `📱 <b>UPI Withdrawal</b>\n\n💵 Balance: <b>₹${balance}</b>\n\n✏️ Enter your UPI ID (e.g. <code>example@paytm</code>)`)
      : (lang === "bn"
        ? `💎 <b>Binance উইথড্র</b>\n\n💵 ব্যালেন্স: <b>₹${balance}</b>\n\n✏️ আপনার Binance Pay ID লিখুন`
        : `💎 <b>Binance Withdrawal</b>\n\n💵 Balance: <b>₹${balance}</b>\n\n✏️ Enter your Binance Pay ID`);

    await sendMessage(BOT_TOKEN, chatId, prompt, {
      reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "বাতিল" : "Cancel", callback_data: "wallet_withdraw" }]] },
    });
    return true;
  }
  if (data === "refer_earn") { await handleReferEarn(BOT_TOKEN, supabase, chatId, userId, lang); return true; }

  // Withdrawal quick amount buttons
  if (data.startsWith("withdraw_amt_")) {
    const amount = parseInt(data.replace("withdraw_amt_", ""));
    const { getWallet, getUserLang: gul, deleteConversationState: dcs, getConversationState: gcs } = await import("../db-helpers.ts");
    const convState = await gcs(supabase, userId);
    if (!convState || convState.step !== "withdraw_enter_amount") {
      await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again.");
      return true;
    }
    const wallet = await getWallet(supabase, userId);
    const balance = wallet?.balance || 0;
    const ulang = (await gul(supabase, userId)) || "en";
    if (amount > balance) {
      await sendMessage(BOT_TOKEN, chatId, ulang === "bn" ? `⚠️ অপর্যাপ্ত ব্যালেন্স। ব্যালেন্স: ₹${balance}` : `⚠️ Insufficient. Balance: ₹${balance}`);
      return true;
    }

    await supabase.from("withdrawal_requests").insert({
      telegram_id: userId, amount, method: convState.data.method,
      account_details: convState.data.accountDetails, status: "pending",
    });
    await dcs(supabase, userId);

    const methodLabel = convState.data.method === "upi" ? "UPI" : "Binance";
    await sendMessage(BOT_TOKEN, chatId,
      ulang === "bn"
        ? `✅ <b>উইথড্র রিকোয়েস্ট জমা!</b>\n\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n\n⏳ অ্যাডমিন প্রসেস করবে।`
        : `✅ <b>Withdrawal Submitted!</b>\n\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n\n⏳ Admin will process soon.`,
      { reply_markup: { inline_keyboard: [[{ text: ulang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
    );
    const { notifyAllAdmins: naa } = await import("../db-helpers.ts");
    await naa(BOT_TOKEN, supabase,
      `💸 <b>Withdrawal Request</b>\n\n👤 <code>${userId}</code>\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>`
    );
    return true;
  }
  if (data === "support") { await handleSupport(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "get_offers") { await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "website_login") { await handleLoginCode(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "back_main") { await showMainMenu(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "back_products") { await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); return true; }

  // Resale
  if (data.startsWith("resale_")) { await handleResaleStart(BOT_TOKEN, supabase, chatId, userId, data.replace("resale_", ""), null, lang); return true; }
  if (data.startsWith("resalevar_")) { await handleResaleVariationStart(BOT_TOKEN, supabase, chatId, userId, data.replace("resalevar_", ""), lang); return true; }

  // All users pagination
  if (data.startsWith("allusers_page_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    await handleAllUsers(BOT_TOKEN, supabase, chatId, parseInt(data.replace("allusers_page_", "")));
    return true;
  }

  return false;
}
