// ===== ADMIN ORDER ACTIONS (slim entrypoint) =====
import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getWallet, getUserLang, getAllAdminIds } from "../db-helpers.ts";
import { processReferralBonus } from "./wallet-pay.ts";
import { logProof, formatOrderConfirmed, formatOrderDelivered, formatDepositSuccess } from "../proof-logger.ts";
import { sendToUser, resolveOrderTokens } from "./_admin-helpers.ts";
import { processChildBotConfirmation } from "./_child-bot.ts";

export async function handleAdminAction(token: string, supabase: any, orderId: string, newStatus: string, adminChatId: number) {
  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";
  await supabase.from("telegram_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);

  const { tokensToTry, userToken, isChildBotOrder } = await resolveOrderTokens(supabase, order, token);

  const msgKey: Record<string, string> = { confirmed: "order_confirmed", rejected: "order_rejected", shipped: "order_shipped" };
  await sendToUser(tokensToTry, order.telegram_user_id, t(msgKey[newStatus] || "order_confirmed", userLang));

  // If rejected, refund
  if (newStatus === "rejected") {
    const { data: deductions } = await supabase.from("telegram_wallet_transactions")
      .select("*").eq("telegram_id", order.telegram_user_id).eq("type", "purchase_deduction")
      .ilike("description", `%${order.product_name}%`).order("created_at", { ascending: false }).limit(1);

    if (deductions?.length && deductions[0].amount < 0) {
      const refundAmount = Math.abs(deductions[0].amount);
      const wallet = await getWallet(supabase, order.telegram_user_id);
      if (wallet) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance + refundAmount, updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.telegram_user_id);
        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.telegram_user_id, type: "refund", amount: refundAmount,
          description: `Refund: ${order.product_name} (rejected)`,
        });
        await sendToUser(tokensToTry, order.telegram_user_id,
          userLang === "bn" ? `💰 ₹${refundAmount} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।` : `💰 ₹${refundAmount} refunded to your wallet.`);
      }
    }
  }

  // If confirmed
  if (newStatus === "confirmed") {
    let resolvedDelivery: { link: string | null; showInBot: boolean; showInWebsite: boolean; deliveryMessage?: string | null } | null = null;
    if (!order.product_name?.startsWith("Wallet Deposit") && order.product_id) {
      const { resolveAccessLink } = await import("./instant-delivery.ts");
      resolvedDelivery = await resolveAccessLink(supabase, order.product_id, undefined, order.id);
    }

    if (order.product_name?.startsWith("Wallet Deposit")) {
      const depositAmount = order.amount;
      const wallet = await getWallet(supabase, order.telegram_user_id);
      if (wallet) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance + depositAmount, total_earned: wallet.total_earned + depositAmount,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.telegram_user_id);
        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.telegram_user_id, type: "deposit", amount: depositAmount,
          description: `Manual UPI deposit approved`,
        });
        await sendToUser(tokensToTry, order.telegram_user_id,
          userLang === "bn" ? `💰 ₹${depositAmount} আপনার ওয়ালেটে জমা হয়েছে!` : `💰 ₹${depositAmount} has been deposited to your wallet!`);
        const { syncDepositToProfile } = await import("./sync-helpers.ts");
        await syncDepositToProfile(supabase, order.telegram_user_id, depositAmount, "manual_upi");
      }
    } else {
      try {
        const { syncPurchaseToProfile } = await import("./sync-helpers.ts");
        const websiteLink = resolvedDelivery?.link && resolvedDelivery.showInWebsite ? resolvedDelivery.link : undefined;
        await syncPurchaseToProfile(supabase, order.telegram_user_id, order.amount, order.product_name || "Product", order.product_id || undefined, websiteLink, true);
      } catch (e) { console.error("Sync purchase to profile error:", e); }
    }

    await processReferralBonus(supabase, order.telegram_user_id, token, order.amount);

    if (resolvedDelivery?.link && resolvedDelivery.showInBot && !isChildBotOrder) {
      const { sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
      await sendInstantDeliveryWithLoginCode(userToken, supabase, order.telegram_user_id, order.telegram_user_id, resolvedDelivery.link, order.product_name || "Product", userLang, resolvedDelivery.deliveryMessage);
    } else if (resolvedDelivery?.deliveryMessage?.trim() && !isChildBotOrder) {
      await sendToUser(tokensToTry, order.telegram_user_id, `📝 ${resolvedDelivery.deliveryMessage}`);
    }

    const instantDeliverySent = !!(resolvedDelivery?.link && resolvedDelivery.showInBot);
    if (!isChildBotOrder && !order.product_name?.startsWith("Wallet Deposit") && !instantDeliverySent) {
      try {
        const { sendBotUserEmail } = await import("../../_shared/bot-email.ts");
        await sendBotUserEmail(supabase, order.telegram_user_id,
          `✅ Order Confirmed — ${order.product_name || "Product"}`,
          {
            title: "Your order is confirmed!",
            preheader: `${order.product_name || "Your product"} is confirmed. Delivery details coming soon.`,
            badge: { text: "Confirmed", color: "#10b981" },
            intro: `Good news — your order has been confirmed by our team. We're preparing your delivery and you'll receive the access details shortly on Telegram and email.`,
            blocks: [
              { label: "Product", value: order.product_name || "Product" },
              { label: "Order ID", value: order.id, mono: true },
              { label: "Amount", value: `₹${order.amount}` },
            ],
            ctaButton: { label: "Open Telegram Bot", url: "https://t.me/Air1_Premium_bot" },
          },
          { template: "bot_order_confirmed", order_id: order.id }
        );
      } catch (e) { console.error("[order-confirm-email] failed:", e); }
    }

    if (order.username?.startsWith("child_bot:")) {
      await processChildBotConfirmation(supabase, order, orderId, resolvedDelivery);
    }
  }

  const emoji: Record<string, string> = { confirmed: "✅", rejected: "❌", shipped: "📦" };
  const statusLabel: Record<string, string> = { confirmed: "CONFIRMED", rejected: "REJECTED", shipped: "SHIPPED" };
  await sendMessage(token, adminChatId, `${emoji[newStatus] || "📋"} Order <b>${orderId.slice(0, 8)}</b> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>`);

  try {
    let proofName = "User";
    try {
      const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", order.telegram_user_id).single();
      if (bu?.first_name) proofName = bu.first_name;
    } catch {}
    if (newStatus === "confirmed") {
      if (order.product_name?.startsWith("Wallet Deposit")) {
        await logProof(token, formatDepositSuccess(order.telegram_user_id, order.amount, "manual_upi", proofName));
      } else {
        await logProof(token, formatOrderConfirmed(order.telegram_user_id, order.product_name || "N/A", order.amount, proofName));
      }
    } else if (newStatus === "shipped") {
      await logProof(token, formatOrderDelivered(order.telegram_user_id, order.product_name || "N/A", order.amount, proofName));
    }
  } catch {}

  const allAdminIds = await getAllAdminIds(supabase);
  const otherAdmins = allAdminIds.filter((id: number) => id !== adminChatId);
  for (const otherAdmin of otherAdmins) {
    try {
      await sendMessage(token, otherAdmin,
        `📋 <b>Order Handled by Another Admin</b>\n\n` +
        `${emoji[newStatus] || "📋"} Order <code>${orderId.slice(0, 8)}</code> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>\n` +
        `📦 Product: <b>${order.product_name || "N/A"}</b>\n` +
        `👤 Customer: <code>${order.telegram_user_id}</code>\n` +
        `🛡️ Handled by Admin: <code>${adminChatId}</code>`
      );
    } catch {}
  }
}

export async function handleAdminResend(token: string, supabase: any, orderId: string, adminChatId: number) {
  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  if (order.status !== "confirmed" && order.status !== "shipped") {
    await sendMessage(token, adminChatId, `⚠️ Order is <b>${order.status}</b>. Can only resend for confirmed/shipped orders.`);
    return;
  }
  if (order.product_name?.startsWith("Wallet Deposit")) {
    await sendMessage(token, adminChatId, "ℹ️ This is a wallet deposit — no delivery to resend.");
    return;
  }
  if (!order.product_id) {
    await sendMessage(token, adminChatId, "❌ No product linked to this order.");
    return;
  }

  const { data: product } = await supabase.from("products").select("access_link, delivery_mode, show_link_in_bot").eq("id", order.product_id).single();
  if (!product?.access_link) {
    await sendMessage(token, adminChatId, "❌ No access link found for this product.");
    return;
  }

  const { userToken } = await resolveOrderTokens(supabase, order, token);
  const { sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";
  await sendInstantDeliveryWithLoginCode(userToken, supabase, order.telegram_user_id, order.telegram_user_id, product.access_link, order.product_name || "Product", userLang);

  await sendMessage(token, adminChatId, `🔄 Delivery resent for order <b>${orderId.slice(0, 8)}</b> → <b>${order.product_name}</b>`);
}
