import { sendMessage } from "../telegram-api.ts";
import { getWallet, deleteConversationState, getUserLang } from "../db-helpers.ts";
import { logProof } from "../proof-logger.ts";
import { DAILY_SEND_LIMIT, getDailySendCount, getTimeIST, maskName } from "./send-helpers.ts";

export async function executeSendTransfer(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const { getConversationState } = await import("../db-helpers.ts");
  const state = await getConversationState(supabase, userId);
  if (!state || state.step !== "send_confirm") {
    await sendMessage(token, chatId, lang === "bn" ? "❌ সেশন শেষ হয়ে গেছে।" : "❌ Session expired.");
    return;
  }

  const { recipientId, recipientName, amount } = state.data;

  const dailyCount = await getDailySendCount(supabase, userId);
  if (dailyCount >= DAILY_SEND_LIMIT) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ আজকের সেন্ড লিমিট (${DAILY_SEND_LIMIT}) শেষ।` : `❌ Daily send limit (${DAILY_SEND_LIMIT}) reached.`);
    return;
  }

  const senderWallet = await getWallet(supabase, userId);
  if (!senderWallet || senderWallet.balance < amount) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, lang === "bn" ? "❌ অপর্যাপ্ত ব্যালেন্স।" : "❌ Insufficient balance.");
    return;
  }

  const receiverWallet = await getWallet(supabase, recipientId);
  if (!receiverWallet) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, lang === "bn" ? "❌ প্রাপকের ওয়ালেট পাওয়া যায়নি।" : "❌ Recipient wallet not found.");
    return;
  }

  await supabase.from("telegram_wallets").update({
    balance: senderWallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  await supabase.from("telegram_wallets").update({
    balance: receiverWallet.balance + amount,
    total_earned: (receiverWallet.total_earned || 0) + amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", recipientId);

  let senderName = "User";
  try {
    const { data: su } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", userId).maybeSingle();
    if (su?.first_name) senderName = su.first_name;
  } catch {}

  await supabase.from("telegram_wallet_transactions").insert([
    { telegram_id: userId, type: "transfer_out", amount: -amount, description: `Sent to ${recipientName} (${recipientId})` },
    { telegram_id: recipientId, type: "transfer_in", amount: amount, description: `Received from ${senderName} (${userId})` },
  ]);

  await deleteConversationState(supabase, userId);

  const newBalance = senderWallet.balance - amount;
  const remaining = DAILY_SEND_LIMIT - dailyCount - 1;

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>সফলভাবে সেন্ড হয়েছে!</b>\n\n👤 প্রাপক: <b>${recipientName}</b>\n💰 পরিমাণ: <b>₹${amount}</b>\n💳 নতুন ব্যালেন্স: <b>₹${newBalance}</b>\n\n📊 আজ আর ${remaining} বার সেন্ড করতে পারবেন।`
      : `✅ <b>Transfer Successful!</b>\n\n👤 Recipient: <b>${recipientName}</b>\n💰 Amount: <b>₹${amount}</b>\n💳 New Balance: <b>₹${newBalance}</b>\n\n📊 ${remaining} send(s) remaining today.`,
    { reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
  );

  const receiverLang = (await getUserLang(supabase, recipientId)) || "en";
  await sendMessage(token, recipientId,
    receiverLang === "bn"
      ? `💰 <b>ব্যালেন্স পেয়েছেন!</b>\n\n👤 প্রেরক: <b>${senderName}</b>\n💵 পরিমাণ: <b>₹${amount}</b>\n💳 নতুন ব্যালেন্স: <b>₹${(receiverWallet.balance || 0) + amount}</b>`
      : `💰 <b>Balance Received!</b>\n\n👤 From: <b>${senderName}</b>\n💵 Amount: <b>₹${amount}</b>\n💳 New Balance: <b>₹${(receiverWallet.balance || 0) + amount}</b>`,
    { reply_markup: { inline_keyboard: [[{ text: receiverLang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
  );

  try {
    const proofText = `┌─────────────────────┐\n` +
      `   💸 <b>P2P TRANSFER</b>\n` +
      `└─────────────────────┘\n\n` +
      `👤 From: <b>${maskName(senderName)}</b>\n` +
      `👤 To: <b>${maskName(recipientName)}</b>\n` +
      `💰 Amount: <b>₹${amount}</b>\n` +
      `🕐 ${getTimeIST()}\n\n` +
      `💎 <i>Trusted P2P transfer!</i>`;
    await logProof(token, proofText);
  } catch {}

  try {
    const { resolveProfileUserId } = await import("../../_shared/profile-id-resolver.ts");
    const senderProfileId = await resolveProfileUserId(supabase, userId);
    const receiverProfileId = await resolveProfileUserId(supabase, recipientId);

    if (senderProfileId) {
      const { data: sp } = await supabase.from("profiles").select("wallet_balance").eq("id", senderProfileId).single();
      if (sp) {
        await supabase.from("profiles").update({ wallet_balance: Math.max(0, (sp.wallet_balance || 0) - amount) }).eq("id", senderProfileId);
      }
    }
    if (receiverProfileId) {
      const { data: rp } = await supabase.from("profiles").select("wallet_balance").eq("id", receiverProfileId).single();
      if (rp) {
        await supabase.from("profiles").update({ wallet_balance: (rp.wallet_balance || 0) + amount }).eq("id", receiverProfileId);
      }
    }
  } catch (e) {
    console.error("Send: profile sync error:", e);
  }
}
