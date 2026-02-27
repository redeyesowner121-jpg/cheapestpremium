// ===== ADMIN ORDER ACTIONS =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getWallet, getUserLang, getAllAdminIds } from "../db-helpers.ts";
import { processReferralBonus } from "./wallet-pay.ts";

export async function handleAdminAction(token: string, supabase: any, orderId: string, newStatus: string, adminChatId: number) {
  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";

  await supabase.from("telegram_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);

  const msgKey: Record<string, string> = { confirmed: "order_confirmed", rejected: "order_rejected", shipped: "order_shipped" };
  await sendMessage(token, order.telegram_user_id, t(msgKey[newStatus] || "order_confirmed", userLang));

  // If rejected, refund any wallet deduction
  if (newStatus === "rejected") {
    const { data: deductions } = await supabase.from("telegram_wallet_transactions")
      .select("*")
      .eq("telegram_id", order.telegram_user_id)
      .eq("type", "purchase_deduction")
      .ilike("description", `%${order.product_name}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (deductions?.length && deductions[0].amount < 0) {
      const refundAmount = Math.abs(deductions[0].amount);
      const wallet = await getWallet(supabase, order.telegram_user_id);
      if (wallet) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance + refundAmount,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.telegram_user_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.telegram_user_id,
          type: "refund",
          amount: refundAmount,
          description: `Refund: ${order.product_name} (rejected)`,
        });

        await sendMessage(token, order.telegram_user_id,
          userLang === "bn"
            ? `💰 ₹${refundAmount} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`
            : `💰 ₹${refundAmount} refunded to your wallet.`
        );
      }
    }
  }

  // If confirmed, process referral, reseller profit, and auto-send access_link
  if (newStatus === "confirmed") {
    await processReferralBonus(supabase, order.telegram_user_id, token);

    if (order.product_id) {
      const { data: product } = await supabase.from("products").select("access_link").eq("id", order.product_id).single();
      if (product?.access_link) {
        await sendMessage(token, order.telegram_user_id,
          userLang === "bn"
            ? `🔗 <b>আপনার প্রোডাক্ট লিংক:</b>\n\n${product.access_link}\n\n⚠️ এই লিংক শুধুমাত্র আপনার জন্য। শেয়ার করবেন না।`
            : `🔗 <b>Your Product Access Link:</b>\n\n${product.access_link}\n\n⚠️ This link is for you only. Do not share.`
        );
      }
    }

    if (order.reseller_telegram_id && order.reseller_profit > 0) {
      const resellerWallet = await getWallet(supabase, order.reseller_telegram_id);
      if (resellerWallet) {
        await supabase.from("telegram_wallets").update({
          balance: resellerWallet.balance + order.reseller_profit,
          total_earned: resellerWallet.total_earned + order.reseller_profit,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.reseller_telegram_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.reseller_telegram_id,
          type: "resale_profit",
          amount: order.reseller_profit,
          description: `Resale profit: ${order.product_name}`,
        });

        try {
          await sendMessage(token, order.reseller_telegram_id,
            `💰 <b>Resale Profit!</b>\n\n₹${order.reseller_profit} added to your wallet!\nProduct: ${order.product_name}`
          );
        } catch { /* reseller may have blocked bot */ }
      }
    }
  }

  const emoji: Record<string, string> = { confirmed: "✅", rejected: "❌", shipped: "📦" };
  const statusLabel: Record<string, string> = { confirmed: "CONFIRMED", rejected: "REJECTED", shipped: "SHIPPED" };
  await sendMessage(token, adminChatId, `${emoji[newStatus] || "📋"} Order <b>${orderId.slice(0, 8)}</b> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>`);

  // Notify other admins
  const allAdminIds = await getAllAdminIds(supabase);
  const otherAdmins = allAdminIds.filter(id => id !== adminChatId);
  for (const otherAdmin of otherAdmins) {
    try {
      await sendMessage(token, otherAdmin,
        `📋 <b>Order Handled by Another Admin</b>\n\n` +
        `${emoji[newStatus] || "📋"} Order <code>${orderId.slice(0, 8)}</code> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>\n` +
        `📦 Product: <b>${order.product_name || "N/A"}</b>\n` +
        `👤 Customer: <code>${order.telegram_user_id}</code>\n` +
        `🛡️ Handled by Admin: <code>${adminChatId}</code>`
      );
    } catch { /* admin may have blocked bot */ }
  }
}
