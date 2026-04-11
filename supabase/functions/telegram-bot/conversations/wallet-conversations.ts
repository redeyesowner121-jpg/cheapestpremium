// ===== DEPOSIT & WITHDRAWAL CONVERSATION HANDLERS =====

import { sendMessage } from "../telegram-api.ts";
import {
  deleteConversationState, setConversationState, getUserLang,
  getWallet, notifyAllAdmins,
} from "../db-helpers.ts";

export async function handleDepositSteps(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  // DEPOSIT: Enter amount (method already selected)
  if (state.step === "deposit_enter_amount") {
    const amount = parseFloat(text);
    const lang2 = (await getUserLang(supabase, userId)) || "en";
    if (isNaN(amount) || amount <= 0) {
      await sendMessage(token, chatId, lang2 === "bn" ? "⚠️ সঠিক পরিমাণ লিখুন।" : "⚠️ Please enter a valid amount.");
      return true;
    }
    const method = state.data?.method;
    if (method === "binance") {
      const { showDepositBinance } = await import("../payment/deposit-handlers.ts");
      await showDepositBinance(token, supabase, chatId, userId, amount, lang2);
    } else if (method === "upi") {
      const { showDepositUpi } = await import("../payment/deposit-handlers.ts");
      await showDepositUpi(token, supabase, chatId, userId, amount, lang2);
    } else {
      // Fallback
      const { showDepositMethodChoice } = await import("../payment/deposit-handlers.ts");
      await showDepositMethodChoice(token, supabase, chatId, userId, amount, lang2);
    }
    return true;
  }

  // DEPOSIT: Awaiting screenshot (manual UPI)
  if (state.step === "deposit_awaiting_screenshot") {
    const lang2 = (await getUserLang(supabase, userId)) || "en";
    const { handleDepositScreenshot } = await import("../payment/deposit-handlers.ts");
    await handleDepositScreenshot(token, supabase, chatId, userId, msg, state.data, lang2);
    return true;
  }

  return false;
}

export async function handleWithdrawSteps(token: string, supabase: any, chatId: number, userId: number, text: string, state: { step: string; data: Record<string, any> }) {
  // WITHDRAW: Enter account details
  if (state.step === "withdraw_enter_details") {
    const lang2 = (await getUserLang(supabase, userId)) || "en";
    const details = text.trim();
    if (!details || details.length < 3) {
      await sendMessage(token, chatId, lang2 === "bn" ? "⚠️ সঠিক ID লিখুন।" : "⚠️ Please enter a valid ID.");
      return true;
    }
    await setConversationState(supabase, userId, "withdraw_enter_amount", { ...state.data, accountDetails: details });
    const wallet = await getWallet(supabase, userId);
    const balance = wallet?.balance || 0;
    await sendMessage(token, chatId,
      lang2 === "bn"
        ? `✅ ${state.data.method === "upi" ? "UPI" : "Binance"} ID: <code>${details}</code>\n\n💰 ব্যালেন্স: <b>₹${balance}</b>\n\n✏️ কত টাকা উইথড্র করতে চান? (সর্বনিম্ন ₹50)`
        : `✅ ${state.data.method === "upi" ? "UPI" : "Binance"} ID: <code>${details}</code>\n\n💰 Balance: <b>₹${balance}</b>\n\n✏️ How much to withdraw? (Min ₹50)`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "₹100", callback_data: "withdraw_amt_100" },
              { text: "₹500", callback_data: "withdraw_amt_500" },
              { text: "₹1000", callback_data: "withdraw_amt_1000" },
            ],
            [{ text: lang2 === "bn" ? "বাতিল" : "Cancel", callback_data: "my_wallet" }],
          ],
        },
      }
    );
    return true;
  }

  // WITHDRAW: Enter amount
  if (state.step === "withdraw_enter_amount") {
    const lang2 = (await getUserLang(supabase, userId)) || "en";
    const amount = parseFloat(text);
    const wallet = await getWallet(supabase, userId);
    const balance = wallet?.balance || 0;
    if (isNaN(amount) || amount < 50) {
      await sendMessage(token, chatId, lang2 === "bn" ? "⚠️ সর্বনিম্ন ₹50 লিখুন।" : "⚠️ Minimum withdrawal is ₹50.");
      return true;
    }
    if (amount > balance) {
      await sendMessage(token, chatId, lang2 === "bn" ? `⚠️ অপর্যাপ্ত ব্যালেন্স। আপনার ব্যালেন্স: ₹${balance}` : `⚠️ Insufficient balance. Your balance: ₹${balance}`);
      return true;
    }

    const { data: wdReq } = await supabase.from("withdrawal_requests").insert({
      telegram_id: userId, amount, method: state.data.method,
      account_details: state.data.accountDetails, status: "pending",
    }).select("id").single();

    await deleteConversationState(supabase, userId);

    const methodLabel = state.data.method === "upi" ? "UPI" : "Binance";
    await sendMessage(token, chatId,
      lang2 === "bn"
        ? `✅ <b>উইথড্র রিকোয়েস্ট জমা হয়েছে!</b>\n\n💰 পরিমাণ: <b>₹${amount}</b>\n💳 পদ্ধতি: <b>${methodLabel}</b>\n📋 ID: <code>${state.data.accountDetails}</code>\n\n⏳ অ্যাডমিন শীঘ্রই প্রসেস করবে। আপডেট পাবেন।`
        : `✅ <b>Withdrawal Request Submitted!</b>\n\n💰 Amount: <b>₹${amount}</b>\n💳 Method: <b>${methodLabel}</b>\n📋 ID: <code>${state.data.accountDetails}</code>\n\n⏳ Admin will process it soon. You'll be notified.`,
      { reply_markup: { inline_keyboard: [[{ text: lang2 === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
    );

    const wdId = wdReq?.id?.slice(0, 8) || "N/A";
    await notifyAllAdmins(token, supabase,
      `💸 <b>New Withdrawal Request</b>\n\n👤 User: <code>${userId}</code>\n💰 Amount: <b>₹${amount}</b>\n💳 Method: <b>${methodLabel}</b>\n📋 ${methodLabel} ID: <code>${state.data.accountDetails}</code>\n🆔 Request: <code>${wdId}</code>\n⏳ Status: Pending`,
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

  return false;
}
