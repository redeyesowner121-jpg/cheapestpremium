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
  handlePendingKnowledge,
} from "../admin-handlers.ts";

export async function handleMenuCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

  // ===== Live 2FA OTP generation =====
  // callback_data format: `otp_<BASE32_SECRET>`
  if (data.startsWith("otp_")) {
    const secret = data.slice(4);
    const { generateTOTP } = await import("../payment/credential-otp.ts");
    const result = await generateTOTP(secret);
    if (!result) {
      await sendMessage(BOT_TOKEN, chatId, lang === "bn"
        ? "❌ 2FA সিক্রেট ভ্যালিড নয়। অ্যাডমিনের সাথে যোগাযোগ করুন।"
        : "❌ Invalid 2FA secret. Please contact admin.");
      return true;
    }
    const msg = lang === "bn"
      ? `🔐 <b>লাইভ 2FA OTP</b>\n\n` +
        `কোড: <code>${result.code}</code>\n` +
        `⏳ ${result.secondsLeft} সেকেন্ডে এক্সপায়ার হবে\n\n` +
        `⚠️ এই কোডটি ChatGPT/সাইটে দ্রুত পেস্ট করুন। নতুন OTP-র জন্য বাটনে আবার ক্লিক করুন।`
      : `🔐 <b>Live 2FA OTP</b>\n\n` +
        `Code: <code>${result.code}</code>\n` +
        `⏳ Expires in ${result.secondsLeft}s\n\n` +
        `⚠️ Paste this code into ChatGPT/site quickly. Tap the button again for a new OTP.`;
    await sendMessage(BOT_TOKEN, chatId, msg);
    return true;
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
      // Auto-create website account
      try {
        const { resolveProfileUserId } = await import("../../_shared/profile-id-resolver.ts");
        await resolveProfileUserId(supabase, userId);
      } catch (e) {
        console.error("Auto-create website profile failed:", e);
      }
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

      // Auto-create website account for this telegram user
      try {
        const { resolveProfileUserId } = await import("../../_shared/profile-id-resolver.ts");
        await resolveProfileUserId(supabase, userId);
      } catch (e) {
        console.error("Auto-create website profile failed:", e);
      }

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

  // Knowledge approval callbacks
  if (data.startsWith("knowledge_approve_") || data.startsWith("knowledge_reject_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const isApprove = data.startsWith("knowledge_approve_");
    const knowledgeId = data.replace(/^knowledge_(approve|reject)_/, "");
    
    if (isApprove) {
      await supabase.from("telegram_ai_knowledge").update({ status: "approved" }).eq("id", knowledgeId);
      await sendMessage(BOT_TOKEN, chatId,
        `✅ <b>Knowledge Approved!</b>\n\n🧠 AI will now use this answer.`,
        { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }], [{ text: "⬅️ Back", callback_data: "adm_back", color: "red" }]] } }
      );
    } else {
      await supabase.from("telegram_ai_knowledge").delete().eq("id", knowledgeId);
      await sendMessage(BOT_TOKEN, chatId,
        `❌ <b>Knowledge Rejected & Deleted</b>\n\nThis answer will not be added to AI knowledge.`,
        { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }], [{ text: "⬅️ Back", callback_data: "adm_back", color: "red" }]] } }
      );
    }
    return true;
  }

  // AI Training callbacks
  if (data.startsWith("aitrain_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    if (data.startsWith("aitrain_del_")) { await executeDeleteKnowledge(BOT_TOKEN, supabase, chatId, data.replace("aitrain_del_", "")); return true; }
    if (data.startsWith("aitrain_view_")) { await handleViewKnowledge(BOT_TOKEN, supabase, chatId, parseInt(data.replace("aitrain_view_", "")) || 0); return true; }
    if (data === "aitrain_view") { await handleViewKnowledge(BOT_TOKEN, supabase, chatId, 0); return true; }
    if (data === "aitrain_delete") { await startDeleteKnowledge(BOT_TOKEN, supabase, chatId, userId); return true; }
    if (data === "aitrain_pending") { await handlePendingKnowledge(BOT_TOKEN, supabase, chatId); return true; }
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

  // Admin resend delivery (repeat ID-Pass/Links)
  if (data.startsWith("admin_resend_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const orderId = data.replace("admin_resend_", "");
    const { handleAdminResend } = await import("../payment/admin-actions.ts");
    await handleAdminResend(BOT_TOKEN, supabase, orderId, chatId);
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
      // Silently ignore stale withdrawal callback
      return true;
    }
    const wallet = await getWallet(supabase, userId);
    const balance = wallet?.balance || 0;
    const ulang = (await gul(supabase, userId)) || "en";
    if (amount > balance) {
      await sendMessage(BOT_TOKEN, chatId, ulang === "bn" ? `⚠️ অপর্যাপ্ত ব্যালেন্স। ব্যালেন্স: ₹${balance}` : `⚠️ Insufficient. Balance: ₹${balance}`);
      return true;
    }

    const { data: wdReq } = await supabase.from("withdrawal_requests").insert({
      telegram_id: userId, amount, method: convState.data.method,
      account_details: convState.data.accountDetails, status: "pending",
    }).select("id").single();
    await dcs(supabase, userId);

    const methodLabel = convState.data.method === "upi" ? "UPI" : "Binance";
    await sendMessage(BOT_TOKEN, chatId,
      ulang === "bn"
        ? `✅ <b>উইথড্র রিকোয়েস্ট জমা!</b>\n\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n\n⏳ অ্যাডমিন প্রসেস করবে।`
        : `✅ <b>Withdrawal Submitted!</b>\n\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n\n⏳ Admin will process soon.`,
      { reply_markup: { inline_keyboard: [[{ text: ulang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
    );
    const { notifyAllAdmins: naa } = await import("../db-helpers.ts");
    const wdId = wdReq?.id?.slice(0, 8) || "N/A";
    await naa(BOT_TOKEN, supabase,
      `💸 <b>New Withdrawal Request</b>\n\n👤 <code>${userId}</code>\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n🆔 <code>${wdId}</code>`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Accept", callback_data: `wd_accept_${wdReq?.id}` },
              { text: "❌ Reject", callback_data: `wd_reject_${wdReq?.id}` },
            ],
            [{ text: "📦 Delivered", callback_data: `wd_delivered_${wdReq?.id}` }],
          ],
        },
      }
    );
    return true;
  }
  if (data === "support") { await handleSupport(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "show_reviews") {
    const { sendMessage } = await import("../telegram-api.ts");
    await sendMessage(BOT_TOKEN, chatId,
      lang === "bn"
        ? "⭐ <b>রিভিউ ও প্রুফস</b>\n\nআমাদের সব রিভিউ, পেমেন্ট প্রুফ এবং সাকসেস স্টোরি দেখতে নিচের চ্যানেলে যাও:\n\n👉 @RKRxProofs"
        : "⭐ <b>Reviews & Proofs</b>\n\nCheck out all our reviews, payment proofs and success stories on our channel:\n\n👉 @RKRxProofs",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "📢 চ্যানেলে যাও" : "📢 Open Channel", url: "https://t.me/RKRxProofs" }],
            [{ text: `⬅️ ${lang === "bn" ? "ফিরে যাও" : "Back"}`, callback_data: "back_main" }],
          ],
        },
      });
    return true;
  }
  if (data === "get_offers") { await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "website_login") { await handleLoginCode(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "set_email") {
    const { handleSetEmailCommand } = await import("../email-handler.ts");
    await handleSetEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }
  if (data === "my_email") {
    const { handleMyEmailCommand } = await import("../email-handler.ts");
    await handleMyEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }
  if (data === "remove_email") {
    const { removeEmail } = await import("../email-handler.ts");
    await removeEmail(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }
  if (data === "resend_email_otp") {
    const { resendEmailOtp } = await import("../email-handler.ts");
    await resendEmailOtp(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }

  // /send quick amount buttons
  if (data.startsWith("send_amt_")) {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "send_awaiting_amount") {
      const amt = parseInt(data.replace("send_amt_", ""), 10);
      const { getUserLang } = await import("../db-helpers.ts");
      const uLang = (await getUserLang(supabase, userId)) || "en";
      const { handleSendAmountStep } = await import("../send-handler.ts");
      await handleSendAmountStep(BOT_TOKEN, supabase, chatId, userId, amt, convState.data, uLang);
    }
    return true;
  }
  // /send confirm
  if (data === "send_confirm_yes") {
    const { getUserLang } = await import("../db-helpers.ts");
    const uLang = (await getUserLang(supabase, userId)) || "en";
    const { executeSendTransfer } = await import("../send-handler.ts");
    await executeSendTransfer(BOT_TOKEN, supabase, chatId, userId, uLang);
    return true;
  }

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
