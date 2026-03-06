// ===== WALLET PAY & REFERRAL BONUS =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getSettings, getWallet, notifyAllAdmins } from "../db-helpers.ts";

export async function handleWalletPay(token: string, supabase: any, chatId: number, userId: number, amount: number, productName: string, lang: string, productId?: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet || wallet.balance < amount) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ পর্যাপ্ত ব্যালেন্স নেই।" : "❌ Insufficient wallet balance.");
    return;
  }

  await supabase.from("telegram_wallets").update({
    balance: wallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId,
    type: "purchase_deduction",
    amount: -amount,
    description: `Purchase: ${productName}`,
  });

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    username: `wallet_pay`,
    product_name: productName,
    product_id: productId || null,
    amount: amount,
    status: "confirmed",
  }).select("id").single();

  await sendMessage(token, chatId,
    t("wallet_paid", lang).replace("{amount}", String(amount)).replace("{product}", productName)
  );

  if (productId) {
    const { data: product } = await supabase.from("products").select("access_link").eq("id", productId).single();
    if (product?.access_link) {
      await sendMessage(token, chatId,
        lang === "bn"
          ? `🔗 <b>আপনার প্রোডাক্ট লিংক:</b>\n\n${product.access_link}\n\n⚠️ এই লিংক শুধুমাত্র আপনার জন্য। শেয়ার করবেন না।`
          : `🔗 <b>Your Product Access Link:</b>\n\n${product.access_link}\n\n⚠️ This link is for you only. Do not share.`
      );
    }
  }

  await notifyAllAdmins(token, supabase,
    `💰 <b>Wallet Payment</b>\n\n👤 User: ${userId}\n📦 Product: ${productName}\n💵 Amount: ₹${amount}\n✅ Auto-confirmed (wallet pay)\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
  );

  await processReferralBonus(supabase, userId, token, amount);
}

export async function processReferralBonus(supabase: any, userId: number, token: string, orderAmount: number = 0) {
  // Skip referral bonus for products below ₹15
  if (orderAmount > 0 && orderAmount < 15) {
    console.log(`Skipping referral bonus: order amount ₹${orderAmount} is below ₹15 minimum`);
    return;
  }
  const wallet = await getWallet(supabase, userId);
  if (!wallet?.referred_by) return;

  const { count } = await supabase
    .from("telegram_orders")
    .select("*", { count: "exact", head: true })
    .eq("telegram_user_id", userId)
    .eq("status", "confirmed");

  if (count === 1) {
    const settings = await getSettings(supabase);
    const bonus = parseFloat(settings.referral_bonus) || 10;

    const referrerWallet = await getWallet(supabase, wallet.referred_by);
    if (referrerWallet) {
      await supabase.from("telegram_wallets").update({
        balance: referrerWallet.balance + bonus,
        total_earned: referrerWallet.total_earned + bonus,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", wallet.referred_by);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: wallet.referred_by,
        type: "referral_bonus",
        amount: bonus,
        description: `Referral bonus for user ${userId}`,
      });

      await sendMessage(token, wallet.referred_by,
        `🎉 <b>Referral Bonus!</b>\n\n₹${bonus} added to your wallet! Your referred user made their first purchase.`
      );
    }
  }
}
