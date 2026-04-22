// ===== BINANCE VERIFY HANDLER (Purchase flow) =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState } from "../db-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";
import { getDynamicUsdRate, usdToInr } from "./payment-utils.ts";

export async function handleBinanceVerify(
  token: string, supabase: any, chatId: number, telegramUser: any, stateData: any, binanceOrderId: string
) {
  const { paymentId, amountUsd, productName, productId, variationId, walletDeduction, price, childBotId, childBotRevenue, quantity = 1, finalAmount } = stateData;
  const isChildBot = !!childBotId;

  await sendMessage(token, chatId, "🔍 Verifying payment...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-binance-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ orderId: binanceOrderId, amount: amountUsd, paymentId, skipAmountCheck: true }),
    });

    const result = await verifyRes.json();

    // Already claimed
    if (result.alreadyClaimed) {
      await sendMessage(token, chatId, `❌ <b>This Binance Order ID has already been used.</b>\n\nPlease use a different Order ID.\n\n📤 Send another Order ID to retry.`, {
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "binance_cancel" }]] },
      });
      return;
    }

    if (result.success && result.actualPaidAmount != null) {
      const paidUsd = result.actualPaidAmount;
      const usdRate = await getDynamicUsdRate(supabase);
      const paidInr = usdToInr(paidUsd, usdRate);

      // Record this Order ID as used
      await supabase.from("used_binance_order_ids").insert({
        binance_order_id: binanceOrderId.trim().toUpperCase(),
        telegram_id: telegramUser.id,
        amount_usd: paidUsd,
        amount_inr: paidInr,
        purpose: "purchase",
        payment_id: paymentId,
      }).catch(() => {});

      // Mark payment as success
      await supabase.from("payments").update({ status: "success", updated_at: new Date().toISOString() }).eq("id", paymentId);

      // Credit the actual paid amount to wallet first
      const { ensureWallet } = await import("../db-helpers.ts");
      await ensureWallet(supabase, telegramUser.id);
      const { data: walletBefore } = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", telegramUser.id).single();
      const balanceBefore = walletBefore?.balance || 0;
      const newBalanceAfterCredit = balanceBefore + paidInr;
      await supabase.from("telegram_wallets").update({ balance: newBalanceAfterCredit, updated_at: new Date().toISOString() }).eq("telegram_id", telegramUser.id);
      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: telegramUser.id, type: "deposit", amount: paidInr,
        description: `Binance payment credited (Order ID: ${binanceOrderId})`,
      });

      await sendMessage(token, chatId, `✅ <b>Payment Verified!</b>\n\n💰 $${paidUsd} (₹${paidInr}) has been added to your wallet.\n💵 Wallet Balance: <b>₹${newBalanceAfterCredit}</b>`);

      // Now check if wallet has enough to complete the purchase
      const totalRequired = price - (walletDeduction || 0); // remaining amount needed
      if (newBalanceAfterCredit >= totalRequired && totalRequired > 0) {
        // Deduct from wallet and complete order
        const finalBalance = newBalanceAfterCredit - totalRequired;
        await supabase.from("telegram_wallets").update({ balance: finalBalance, updated_at: new Date().toISOString() }).eq("telegram_id", telegramUser.id);
        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: telegramUser.id, type: "purchase_deduction", amount: -totalRequired,
          description: `Purchase: ${productName}`,
        });

        if (walletDeduction > 0) {
          // Also deduct the previously planned wallet portion
          // (already included in totalRequired calculation above, wallet was already factored)
        }

        const { processReferralBonus } = await import("./wallet-pay.ts");
        const { notifyAllAdmins } = await import("../db-helpers.ts");
        const { syncPurchaseToProfile } = await import("./sync-helpers.ts");

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
          try {
            const { creditChildBotOwnerCommission } = await import("./child-bot-credit.ts");
            await creditChildBotOwnerCommission(supabase, childBotId, order.id, productName, price, telegramUser.id);
          } catch (e) { console.error("Owner credit error:", e); }
        }

        const { resolveAccessLink, sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
        const resolved = await resolveAccessLink(supabase, productId, order?.id, undefined, quantity);

        let successText = `🛍 <b>Order Placed!</b>\n\n📦 Product: <b>${productName}</b>\n🔢 Quantity: <b>${quantity}</b>\n💵 Price: ₹${price}\n💰 Wallet Balance: <b>₹${finalBalance}</b>\n🆔 Order: <b>${order?.id?.slice(0, 8) || "N/A"}</b>\n`;
        await sendMessage(token, chatId, successText);

        if (resolved.links.length && resolved.showInBot) {
          for (const lnk of resolved.links) {
            await sendInstantDeliveryWithLoginCode(token, supabase, chatId, telegramUser.id, lnk, productName, "en");
          }
        }
        await setConversationState(supabase, telegramUser.id, "idle", {});

        const mainToken = isChildBot ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;
        try {
          await notifyAllAdmins(mainToken, supabase,
            `💰 <b>Binance Payment${isChildBot ? " (Child Bot)" : ""}</b>\n\n👤 User: ${telegramUser.username || telegramUser.first_name} (${telegramUser.id})\n📦 Product: ${productName}\n🔢 Quantity: <b>${quantity}</b>\n💵 Paid: $${paidUsd} (₹${paidInr})\n💵 Product Price: ₹${price}\n💰 Remaining Balance: ₹${finalBalance}\n✅ Auto-verified → Wallet → Purchase\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
          );
        } catch (e) { console.error("Admin notify error:", e); }

        try {
          const websiteLink = resolved.link && resolved.showInWebsite ? resolved.link : undefined;
          await syncPurchaseToProfile(supabase, telegramUser.id, price, productName, productId, websiteLink);
        } catch (e) { console.error("Sync error:", e); }

        await processReferralBonus(supabase, telegramUser.id, token, price);
        try { await logProof(token, formatOrderPlaced(telegramUser.id, telegramUser.first_name || "User", productName, price, "Binance")); } catch {}
      } else {
        // Not enough balance after credit — inform user
        await setConversationState(supabase, telegramUser.id, "idle", {});
        await sendMessage(token, chatId,
          `⚠️ <b>Insufficient balance for purchase</b>\n\n💵 Product Price: <b>₹${price}</b>\n💰 Your Balance: <b>₹${newBalanceAfterCredit}</b>\n\nYour payment has been added to your wallet. Please top up the remaining ₹${Math.ceil(price - newBalanceAfterCredit)} and purchase using wallet balance.`,
          { reply_markup: { inline_keyboard: [[{ text: "🛍 Back to Menu", callback_data: "back_main" }]] } }
        );

        const { notifyAllAdmins } = await import("../db-helpers.ts");
        const mainToken = isChildBot ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;
        try {
          await notifyAllAdmins(mainToken, supabase,
            `⚠️ <b>Binance Payment → Wallet (Insufficient for purchase)</b>\n\n👤 User: ${telegramUser.username || telegramUser.first_name} (${telegramUser.id})\n📦 Tried to buy: ${productName}\n💵 Product Price: ₹${price}\n💵 Paid: $${paidUsd} (₹${paidInr})\n💰 Balance: ₹${newBalanceAfterCredit}\n✅ Credited to wallet`
          );
        } catch {}
      }
    } else if (result.success) {
      await sendMessage(token, chatId, "⚠️ Payment found but amount couldn't be determined. Please contact support.", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "binance_cancel" }]] },
      });
    } else {
      const debugOrderId = result.debug?.expectedOrderId || binanceOrderId;
      const billCount = result.debug?.billCount ?? "?";

      let retryMsg = `❌ <b>Payment not verified yet</b>\n\n${result.message || "No matching transaction found."}\n\n`;
      retryMsg += `🔍 <b>What we searched for:</b>\n• Order ID: <code>${debugOrderId}</code>\n• Transactions checked: ${billCount}\n\n`;
      retryMsg += `💡 <b>Tips:</b>\n• Make sure you sent the correct Binance Order ID\n• Wait 1-2 minutes after payment before verifying\n\n📤 Send your Order ID again to retry.`;

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
