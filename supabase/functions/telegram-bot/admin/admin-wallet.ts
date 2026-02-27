// ===== ADMIN WALLET MANAGEMENT =====

import { sendMessage } from "../telegram-api.ts";
import { getWallet, ensureWallet } from "../db-helpers.ts";

export async function handleAddBalance(token: string, supabase: any, chatId: number, tgId: number, amount: number) {
  if (!tgId || isNaN(amount) || amount <= 0) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/add_balance 123456 500</code>");
    return;
  }

  const { data: wallet } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", tgId).single();
  if (!wallet) {
    await ensureWallet(supabase, tgId);
  }

  const { error } = await supabase.from("telegram_wallets").update({
    balance: (wallet?.balance || 0) + amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", tgId);

  if (error) {
    await sendMessage(token, chatId, `❌ Failed: ${error.message}`);
    return;
  }

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: tgId,
    amount,
    type: "admin_credit",
    description: `Admin added ₹${amount}`,
  });

  const newBalance = (wallet?.balance || 0) + amount;
  await sendMessage(token, chatId, `✅ <b>Balance Added!</b>\n\n👤 User: <code>${tgId}</code>\n💰 Added: ₹${amount}\n💵 New Balance: ₹${newBalance}`);

  try {
    await sendMessage(token, tgId, `🎉 ₹${amount} has been added to your wallet by admin!\n\n💰 New Balance: ₹${newBalance}`);
  } catch { /* user may have blocked bot */ }
}

export async function handleDeductBalance(token: string, supabase: any, chatId: number, tgId: number, amount: number) {
  if (!tgId || isNaN(amount) || amount <= 0) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/deduct_balance 123456 500</code>");
    return;
  }

  const wallet = await getWallet(supabase, tgId);
  if (!wallet) {
    await sendMessage(token, chatId, `❌ User <code>${tgId}</code> has no wallet.`);
    return;
  }

  if (wallet.balance < amount) {
    await sendMessage(token, chatId, `❌ Insufficient balance. User has ₹${wallet.balance}.`);
    return;
  }

  await supabase.from("telegram_wallets").update({
    balance: wallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", tgId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: tgId,
    amount: -amount,
    type: "admin_deduction",
    description: `Admin deducted ₹${amount}`,
  });

  const newBalance = wallet.balance - amount;
  await sendMessage(token, chatId, `✅ <b>Balance Deducted!</b>\n\n👤 User: <code>${tgId}</code>\n💸 Deducted: ₹${amount}\n💵 New Balance: ₹${newBalance}`);

  try {
    await sendMessage(token, tgId, `⚠️ ₹${amount} has been deducted from your wallet by admin.\n\n💰 New Balance: ₹${newBalance}`);
  } catch { /* user may have blocked bot */ }
}
