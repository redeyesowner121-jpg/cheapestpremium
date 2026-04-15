// ===== WALLET PAY & REFERRAL BONUS =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getSettings, getWallet, notifyAllAdmins } from "../db-helpers.ts";
import { syncPurchaseToProfile } from "./sync-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";
import { getChildBotContext } from "../child-context.ts";

export async function handleWalletPay(token: string, supabase: any, chatId: number, userId: number, amount: number, productName: string, lang: string, productId?: string, childBotId?: string, childBotRevenue?: number) {
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

  // Determine child bot context from either passed params or global context
  const childCtx = getChildBotContext();
  const effectiveChildBotId = childBotId || childCtx?.id;
  const effectiveRevenue = childBotRevenue ?? childCtx?.revenue_percent;

  const isChildBotOrder = !!effectiveChildBotId;

  // Child bot orders go as "pending" to main admin; regular orders auto-confirm
  const orderStatus = isChildBotOrder ? "pending" : "confirmed";
  const orderUsername = isChildBotOrder ? `child_bot:${effectiveChildBotId}` : `wallet_pay`;

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId, username: orderUsername,
    product_name: productName, product_id: productId || null,
    amount: amount, status: orderStatus,
  }).select("id").single();

  // Create child bot order record
  if (isChildBotOrder && order?.id) {
    const commission = Math.round(amount * (effectiveRevenue || 0)) / 100;
    await supabase.from("child_bot_orders").insert({
      child_bot_id: effectiveChildBotId,
      telegram_order_id: order.id,
      buyer_telegram_id: userId,
      product_name: productName,
      total_price: amount,
      owner_commission: commission,
      status: "pending",
    });
  }

  if (isChildBotOrder) {
    // Tell child bot user their order is pending
    await sendMessage(token, chatId,
      lang === "bn"
        ? `✅ <b>অর্ডার সফলভাবে জমা হয়েছে!</b>\n\n📦 প্রোডাক্ট: <b>${productName}</b>\n💵 মূল্য: ₹${amount}\n\n⏳ অ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন।`
        : `✅ <b>Order Placed!</b>\n\n📦 Product: <b>${productName}</b>\n💵 Amount: ₹${amount}\n\n⏳ Admin is processing your order. You'll get an update soon.`
    );

    // Notify main bot admins with approve/reject buttons
    const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    const orderId = order?.id || "unknown";
    const adminMsg = `💰 <b>Child Bot Wallet Payment</b>\n\n👤 User: <code>${userId}</code>\n📦 Product: <b>${productName}</b>\n💵 Amount: <b>₹${amount}</b>\n🤖 Child Bot: <code>${effectiveChildBotId}</code>\n🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>\n✅ Wallet balance already deducted`;

    const adminButtons = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `admin_confirm_${orderId}`, style: "success" },
            { text: "❌ Reject", callback_data: `admin_reject_${orderId}`, style: "danger" },
          ],
          [{ text: "📦 Shipped", callback_data: `admin_ship_${orderId}`, style: "primary" }],
        ],
      },
    };

    await notifyAllAdmins(mainToken, supabase, adminMsg, adminButtons);
  } else {
    // Regular wallet pay - auto confirmed
    await sendMessage(token, chatId,
      t("wallet_paid", lang).replace("{amount}", String(amount)).replace("{product}", productName)
    );

    if (productId) {
      const { resolveAccessLink, sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
      const resolved = await resolveAccessLink(supabase, productId, order?.id);
      if (resolved.link && resolved.showInBot) {
        await sendInstantDeliveryWithLoginCode(token, supabase, chatId, userId, resolved.link, productName, lang);
      }
    }

    await notifyAllAdmins(token, supabase,
      `💰 <b>Wallet Payment</b>\n\n👤 User: ${userId}\n📦 Product: ${productName}\n💵 Amount: ₹${amount}\n✅ Auto-confirmed (wallet pay)\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
    );

    // Sync purchase to website profile
    let accessLink: string | undefined;
    if (productId) {
      const { data: prod } = await supabase.from("products").select("access_link, show_link_in_website").eq("id", productId).single();
      // Only pass access_link to website sync if show_link_in_website is true
      accessLink = (prod?.show_link_in_website !== false && prod?.access_link) ? prod.access_link : undefined;
    }
    await syncPurchaseToProfile(supabase, userId, amount, productName, productId, accessLink);

    await processReferralBonus(supabase, userId, token, amount);
  }

  // Log proof to channel
  try { await logProof(token, formatOrderPlaced(userId, `wallet_pay`, productName, amount, "Wallet")); } catch {}
}

export async function processReferralBonus(supabase: any, userId: number, token: string, orderAmount: number = 0) {
  // Get configurable minimum referral amount from settings
  const settings = await getSettings(supabase);
  const minReferralAmount = parseFloat(settings.min_referral_amount) || 15;
  
  // Skip referral bonus for products below minimum
  if (orderAmount > 0 && orderAmount < minReferralAmount) {
    console.log(`Skipping referral bonus: order amount ₹${orderAmount} is below ₹${minReferralAmount} minimum`);
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
