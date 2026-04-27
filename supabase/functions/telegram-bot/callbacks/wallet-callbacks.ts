// ===== Wallet/Withdrawal/Send-money callbacks =====
import { sendMessage } from "../telegram-api.ts";
import {
  setConversationState, getConversationState, getWallet,
  getUserLang, deleteConversationState, notifyAllAdmins,
} from "../db-helpers.ts";
import {
  handleMyWallet, handleWalletDeposit, handleWalletWithdraw,
} from "../menu-handlers.ts";

export async function handleWalletCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, lang: string
): Promise<boolean> {
  if (data === "my_wallet") { await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "wallet_deposit") { await handleWalletDeposit(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "wallet_withdraw") { await handleWalletWithdraw(BOT_TOKEN, supabase, chatId, userId, lang); return true; }

  if (data === "withdraw_upi" || data === "withdraw_binance") {
    const method = data === "withdraw_upi" ? "upi" : "binance";
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

  if (data.startsWith("withdraw_amt_")) {
    const amount = parseInt(data.replace("withdraw_amt_", ""));
    const convState = await getConversationState(supabase, userId);
    if (!convState || convState.step !== "withdraw_enter_amount") return true;

    const wallet = await getWallet(supabase, userId);
    const balance = wallet?.balance || 0;
    const ulang = (await getUserLang(supabase, userId)) || "en";
    if (amount > balance) {
      await sendMessage(BOT_TOKEN, chatId, ulang === "bn" ? `⚠️ অপর্যাপ্ত ব্যালেন্স। ব্যালেন্স: ₹${balance}` : `⚠️ Insufficient. Balance: ₹${balance}`);
      return true;
    }

    const { data: wdReq } = await supabase.from("withdrawal_requests").insert({
      telegram_id: userId, amount, method: convState.data.method,
      account_details: convState.data.accountDetails, status: "pending",
    }).select("id").single();
    await deleteConversationState(supabase, userId);

    const methodLabel = convState.data.method === "upi" ? "UPI" : "Binance";
    await sendMessage(BOT_TOKEN, chatId,
      ulang === "bn"
        ? `✅ <b>উইথড্র রিকোয়েস্ট জমা!</b>\n\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n\n⏳ অ্যাডমিন প্রসেস করবে।`
        : `✅ <b>Withdrawal Submitted!</b>\n\n💰 ₹${amount} | 💳 ${methodLabel}\n📋 <code>${convState.data.accountDetails}</code>\n\n⏳ Admin will process soon.`,
      { reply_markup: { inline_keyboard: [[{ text: ulang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
    );
    const wdId = wdReq?.id?.slice(0, 8) || "N/A";
    await notifyAllAdmins(BOT_TOKEN, supabase,
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

  if (data.startsWith("send_amt_")) {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "send_awaiting_amount") {
      const amt = parseInt(data.replace("send_amt_", ""), 10);
      const uLang = (await getUserLang(supabase, userId)) || "en";
      const { handleSendAmountStep } = await import("../send-handler.ts");
      await handleSendAmountStep(BOT_TOKEN, supabase, chatId, userId, amt, convState.data, uLang);
    }
    return true;
  }

  if (data === "send_confirm_yes") {
    const uLang = (await getUserLang(supabase, userId)) || "en";
    const { executeSendTransfer } = await import("../send-handler.ts");
    await executeSendTransfer(BOT_TOKEN, supabase, chatId, userId, uLang);
    return true;
  }

  return false;
}
