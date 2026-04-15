// ===== BINANCE VERIFY HANDLER =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState } from "../db-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";

export async function handleBinanceVerify(
  token: string, supabase: any, chatId: number, telegramUser: any, stateData: any, binanceOrderId: string
) {
  const { paymentId, amountUsd, productName, productId, variationId, walletDeduction, price, childBotId, childBotRevenue } = stateData;
  const isChildBot = !!childBotId;

  await sendMessage(token, chatId, "🔍 Verifying payment...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-binance-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ orderId: binanceOrderId, amount: amountUsd, paymentId }),
    });

    const result = await verifyRes.json();

    if (result.success) {
      const { processReferralBonus } = await import("./wallet-pay.ts");
      const { notifyAllAdmins } = await import("../db-helpers.ts");
      const { syncPurchaseToProfile } = await import("./sync-helpers.ts");

      if (walletDeduction > 0) {
        const wallet = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", telegramUser.id).single();
        if (wallet.data) {
          await supabase.from("telegram_wallets").update({ balance: Math.max(0, wallet.data.balance - walletDeduction), updated_at: new Date().toISOString() }).eq("telegram_id", telegramUser.id);
          await supabase.from("telegram_wallet_transactions").insert({
            telegram_id: telegramUser.id, type: "purchase_deduction", amount: -walletDeduction, description: `Partial wallet pay: ${productName}`,
          });
        }
      }

      const orderUsername = isChildBot ? `child_bot:${childBotId}` : (telegramUser.username || telegramUser.first_name);
      const { data: order } = await supabase.from("telegram_orders").insert({
        telegram_user_id: telegramUser.id, product_name: productName, product_id: productId,
        amount: price, status: "confirmed", username: orderUsername,
      }).select("id").single();

      if (isChildBot && order?.id) {
        const commission = Math.round(price * (childBotRevenue || 0)) / 100;
        await supabase.from("child_bot_orders").insert({
          child_bot_id: childBotId, telegram_order_id: order.id, buyer_telegram_id: telegramUser.id,
          product_name: productName, total_price: price, owner_commission: commission, status: "confirmed",
        });
        try {
          const { data: cb } = await supabase.from("child_bots").select("total_orders, total_earnings").eq("id", childBotId).single();
          if (cb) await supabase.from("child_bots").update({ total_orders: (cb.total_orders || 0) + 1, total_earnings: (cb.total_earnings || 0) + commission }).eq("id", childBotId);
        } catch {}
      }

      const { resolveAccessLink, sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
      const resolved = await resolveAccessLink(supabase, productId, order?.id);

      let successText = `✅ <b>Order Successful!</b>\n\n📦 Product: <b>${productName}</b>\n💵 Amount: <b>$${amountUsd}</b> (₹${price})\n🆔 Order: <b>${order?.id?.slice(0, 8) || "N/A"}</b>\n`;
      if (walletDeduction > 0) successText += `💰 Wallet Used: ₹${walletDeduction}\n`;
      await sendMessage(token, chatId, successText);

      if (resolved.link && resolved.showInBot) {
        await sendInstantDeliveryWithLoginCode(token, supabase, chatId, telegramUser.id, resolved.link, productName, "en");
      }
      await setConversationState(supabase, telegramUser.id, "idle", {});

      const mainToken = isChildBot ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;
      try {
        await notifyAllAdmins(mainToken, supabase,
          `💰 <b>Binance Payment${isChildBot ? " (Child Bot)" : ""}</b>\n\n👤 User: ${telegramUser.username || telegramUser.first_name} (${telegramUser.id})\n📦 Product: ${productName}\n💵 Amount: $${amountUsd} (₹${price})\n✅ Auto-verified (Order ID: ${binanceOrderId})${isChildBot ? `\n🤖 Child Bot: ${childBotId}` : ""}\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
        );
      } catch (e) { console.error("Admin notify error:", e); }

      try {
        const { data: prodVis } = await supabase.from("products").select("access_link, show_link_in_website").eq("id", productId).single();
        const websiteLink = (prodVis?.show_link_in_website !== false && prodVis?.access_link) ? prodVis.access_link : undefined;
        await syncPurchaseToProfile(supabase, telegramUser.id, price, productName, productId, websiteLink);
      } catch (e) { console.error("Sync error:", e); }

      await processReferralBonus(supabase, telegramUser.id, token, price);
      try { await logProof(token, formatOrderPlaced(telegramUser.id, telegramUser.first_name || "User", productName, price, "Binance")); } catch {}
    } else {
      const debugOrderId = result.debug?.expectedOrderId || binanceOrderId;
      const debugAmt = result.debug?.expectedAmount || amountUsd;
      const billCount = result.debug?.billCount ?? "?";

      let retryMsg = `❌ <b>Payment not verified yet</b>\n\n${result.message || "No matching transaction found."}\n\n`;
      retryMsg += `🔍 <b>What we searched for:</b>\n• Order ID: <code>${debugOrderId}</code>\n• Amount: <b>$${debugAmt}</b>\n• Transactions checked: ${billCount}\n\n`;
      retryMsg += `💡 <b>Tips:</b>\n• Make sure you sent the correct Binance Order ID\n• Wait 1-2 minutes after payment before verifying\n• Ensure the exact amount <b>$${amountUsd}</b> was sent\n\n📤 Send your Order ID again to retry.`;

      await sendMessage(token, chatId, retryMsg, {
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "binance_cancel" }]] },
      });
    }
  } catch (err) {
    console.error("Binance verify error:", err);
    await sendMessage(token, chatId, "⚠️ Verification error. Send your Order ID again to retry.", {
      reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "binance_cancel" }]] },
    });
  }
}
