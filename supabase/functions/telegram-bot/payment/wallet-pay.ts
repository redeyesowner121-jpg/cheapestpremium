// ===== WALLET PAY & REFERRAL BONUS =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getSettings, getWallet, notifyAllAdmins } from "../db-helpers.ts";
import { syncPurchaseToProfile } from "./sync-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";
import { getChildBotContext, getChildBotLabel } from "../child-context.ts";

export async function handleWalletPay(token: string, supabase: any, chatId: number, userId: number, amount: number, productName: string, lang: string, productId?: string, childBotId?: string, childBotRevenue?: number, quantity: number = 1) {
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

  // All orders auto-confirm (including child bot)
  const orderStatus = "confirmed";
  const orderUsername = isChildBotOrder ? `child_bot:${effectiveChildBotId}` : `wallet_pay`;

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId, username: orderUsername,
    product_name: productName, product_id: productId || null,
    amount: amount, status: orderStatus,
  }).select("id").single();

  // Create child bot order record + credit owner wallet
  if (isChildBotOrder && order?.id) {
    const commission = Math.round(amount * (effectiveRevenue || 0)) / 100;
    await supabase.from("child_bot_orders").insert({
      child_bot_id: effectiveChildBotId,
      telegram_order_id: order.id,
      buyer_telegram_id: userId,
      product_name: productName,
      total_price: amount,
      owner_commission: commission,
      status: "confirmed",
    });
    // Update child bot stats
    const { data: cb } = await supabase.from("child_bots").select("total_orders, total_earnings").eq("id", effectiveChildBotId).single();
    if (cb) {
      await supabase.from("child_bots").update({
        total_orders: (cb.total_orders || 0) + 1,
        total_earnings: (cb.total_earnings || 0) + commission,
      }).eq("id", effectiveChildBotId);
    }
    // Credit commission to owner's wallet
    const { creditChildBotOwnerCommission } = await import("./child-bot-credit.ts");
    await creditChildBotOwnerCommission(supabase, effectiveChildBotId, order.id, productName, amount, userId);
  }

  // Try auto-delivery
  let websiteAccessLink: string | undefined;
  let deliveredCount = 0;
  let isManualDelivery = false;

  if (productId) {
    const { resolveAccessLink, sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
    const resolved = await resolveAccessLink(supabase, productId, undefined, order?.id, quantity);
    if (resolved.links.length && resolved.showInBot) {
      for (const lnk of resolved.links) {
        await sendInstantDeliveryWithLoginCode(token, supabase, chatId, userId, lnk, productName, lang);
        deliveredCount++;
      }
    }
    if (resolved.link && resolved.showInWebsite) {
      websiteAccessLink = resolved.link;
    }
    // No links available = manual delivery needed (out of stock OR no access_link configured)
    if (deliveredCount === 0) {
      isManualDelivery = true;
    }
  } else {
    isManualDelivery = true;
  }

  if (isManualDelivery) {
    // Mark order as pending for admin manual fulfillment
    if (order?.id) {
      try {
        await supabase.from("telegram_orders").update({ status: "pending" }).eq("id", order.id);
      } catch (e) { console.error("Order status update error:", e); }
    }
    await sendMessage(token, chatId,
      lang === "bn"
        ? `✅ <b>পেমেন্ট সফল!</b>\n\n💰 ₹${amount} ওয়ালেট থেকে কাটা হয়েছে।\n📦 ${productName}\n\n⏳ অ্যাডমিন আপনার অর্ডার শীঘ্রই প্রসেস করবে। আপডেট পাবেন।`
        : `✅ <b>Payment Successful!</b>\n\n💰 ₹${amount} deducted from wallet.\n📦 ${productName}\n\n⏳ Admin will process your order shortly. You'll be notified.`
    );
    // Best-effort email
    try {
      const { sendBotUserEmail } = await import("../../_shared/bot-email.ts");
      await sendBotUserEmail(supabase, userId,
        `🛒 Order Placed — ${productName}`,
        {
          title: "Order received — processing now",
          preheader: `${productName} order received. We'll deliver soon.`,
          badge: { text: "Placed", color: "#3b82f6" },
          intro: `We've received your order and our team is preparing the delivery. You'll receive the access details on Telegram and email as soon as it's ready.`,
          blocks: [
            { label: "Product", value: productName },
            { label: "Order ID", value: order?.id || "—", mono: true },
            { label: "Amount", value: `₹${amount}` },
          ],
          ctaButton: { label: "Open Telegram Bot", url: "https://t.me/Air1_Premium_bot" },
        },
        { template: "bot_order_placed", order_id: order?.id }
      );
    } catch (e) { console.error("[order-placed-email]", e); }
  } else {
    await sendMessage(token, chatId,
      t("wallet_paid", lang).replace("{amount}", String(amount)).replace("{product}", productName)
    );
  }

  const mainToken = isChildBotOrder ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;
  const orderShortId = order?.id?.toString().slice(0, 8) || "N/A";
  const unitPrice = quantity > 0 ? (amount / quantity).toFixed(2) : amount;
  const childBotLabel = isChildBotOrder ? await getChildBotLabel(supabase, effectiveChildBotId!) : "";

  if (isManualDelivery) {
    // Admin needs to manually deliver — send action buttons
    const adminMsg = `🛒 <b>Manual Delivery Order (Wallet Pay)</b>${isChildBotOrder ? ` <i>via ${childBotLabel}</i>` : ""}\n\n👤 User: <code>${userId}</code>\n📦 Product: <b>${productName}</b>\n🔢 Quantity: <b>${quantity}</b>\n💲 Unit Price: <b>₹${unitPrice}</b>\n💰 Total Paid: <b>₹${amount}</b> (wallet)\n${isChildBotOrder ? `🤖 Source Bot: <b>${childBotLabel}</b>\n` : ""}🆔 Order: <code>${orderShortId}</code>\n\n⚠️ <b>Admin action required — deliver manually.</b>`;
    await notifyAllAdmins(mainToken, supabase, adminMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Mark Delivered", callback_data: `admin_ship_${order?.id}` },
            { text: "❌ Reject & Refund", callback_data: `admin_reject_${order?.id}` },
          ],
          [{ text: "🔄 Repeat ID-Pass/Links", callback_data: `admin_resend_${order?.id}` }],
          [{ text: "💬 Chat with User", callback_data: `admin_chat_${userId}` }],
        ],
      },
    });
  } else {
    await notifyAllAdmins(mainToken, supabase,
      `💰 <b>Wallet Payment${isChildBotOrder ? ` (via ${childBotLabel})` : ""}</b>\n\n👤 User: <code>${userId}</code>\n📦 Product: <b>${productName}</b>\n🔢 Quantity: <b>${quantity}</b>\n💵 Amount: ₹${amount}\n✅ Auto-confirmed & delivered${isChildBotOrder ? `\n🤖 Source Bot: <b>${childBotLabel}</b>` : ""}\n🆔 Order: <code>${orderShortId}</code>`
    );
  }

  await syncPurchaseToProfile(supabase, userId, amount, productName, productId, websiteAccessLink);

  await processReferralBonus(supabase, userId, token, amount);

  // Log proof to channel
  // Get user first_name for proof
  let proofName = "User";
  try {
    const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", userId).single();
    if (bu?.first_name) proofName = bu.first_name;
  } catch {}
  try { await logProof(token, formatOrderPlaced(userId, proofName, productName, amount, "Wallet")); } catch {}
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
