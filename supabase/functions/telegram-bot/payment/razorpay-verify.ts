// ===== RAZORPAY VERIFY HANDLER =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState } from "../db-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";
import { getChildBotLabel } from "../child-context.ts";

export async function handleRazorpayVerify(
  token: string, supabase: any, chatId: number, telegramUser: any, stateData: any
) {
  const { paymentId, payClickedAt, productName, productId, variationId, walletDeduction, price, finalAmount, childBotId, childBotRevenue, quantity = 1 } = stateData;
  const isChildBot = !!childBotId;

  await sendMessage(token, chatId, "Verifying payment...");

  try {
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpayKeySecret) { await sendMessage(token, chatId, "Payment verification not configured."); return; }

    const authHeader = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const clickTime = payClickedAt ? Math.floor(new Date(payClickedAt).getTime() / 1000) : (Math.floor(Date.now() / 1000) - 120);
    const fromTime = Math.max(clickTime - 30, Math.floor(Date.now() / 1000) - 300);

    const paymentsRes = await fetch(`https://api.razorpay.com/v1/payments?count=100&from=${fromTime}`, {
      headers: { "Authorization": `Basic ${authHeader}` }
    });

    if (!paymentsRes.ok) {
      console.error("Razorpay payments fetch error:", await paymentsRes.text());
      await sendMessage(token, chatId, "Verification error. Please try again in a moment.", {
        reply_markup: { inline_keyboard: [[{ text: "✅ Verify Payment", callback_data: "razorpay_verify" }]] },
      });
      return;
    }

    const paymentsData = await paymentsRes.json();
    const payments = paymentsData.items || [];
    const amountPaise = Math.round(finalAmount * 100);
    const matchingPayment = payments.find((p: any) => {
      const amountMatch = p.amount === amountPaise;
      const statusMatch = p.status === "captured" || p.status === "authorized";
      const paymentTime = p.created_at;
      const withinWindow = payClickedAt ? (paymentTime >= clickTime - 30 && paymentTime <= clickTime + 150) : true;
      return amountMatch && statusMatch && withinWindow;
    });

    if (matchingPayment) {
      const { processReferralBonus } = await import("./wallet-pay.ts");
      const { syncPurchaseToProfile } = await import("./sync-helpers.ts");
      if (paymentId) await supabase.from("payments").update({ status: "success" }).eq("id", paymentId);

      if (walletDeduction > 0) {
        const wallet = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", telegramUser.id).single();
        if (wallet.data) {
          await supabase.from("telegram_wallets").update({ balance: Math.max(0, wallet.data.balance - walletDeduction) }).eq("telegram_id", telegramUser.id);
        }
      }

      const orderStatus = "confirmed";
      const orderUsername = isChildBot ? `child_bot:${childBotId}` : (telegramUser.username || telegramUser.first_name);

      const { data: order } = await supabase.from("telegram_orders").insert({
        telegram_user_id: telegramUser.id, product_name: productName, product_id: productId,
        amount: price, status: orderStatus, username: orderUsername,
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
        // Credit commission to owner's wallet
        try {
          const { creditChildBotOwnerCommission } = await import("./child-bot-credit.ts");
          await creditChildBotOwnerCommission(supabase, childBotId, order.id, productName, price, telegramUser.id);
        } catch (e) { console.error("Owner credit error:", e); }
      }

      const { resolveAccessLink, sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
      const resolved = await resolveAccessLink(supabase, productId, order?.id, undefined, quantity);

      await sendMessage(token, chatId, `<b>✅ Payment Verified!</b>\n\nProduct: <b>${productName}</b>\nQuantity: <b>${quantity}</b>\nAmount: <b>₹${finalAmount}</b>\n`);

      if (resolved.links.length && resolved.showInBot) {
        for (const lnk of resolved.links) {
          await sendInstantDeliveryWithLoginCode(token, supabase, chatId, telegramUser.id, lnk, productName, "en");
        }
      }
      await setConversationState(supabase, telegramUser.id, "idle", {});

      const mainToken = isChildBot ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;
      const { notifyAllAdmins: notifyAdmins } = await import("../db-helpers.ts");
      const childBotLabel = isChildBot ? await getChildBotLabel(supabase, childBotId) : "";
      await notifyAdmins(mainToken, supabase,
        `💰 <b>Razorpay Payment${isChildBot ? ` (via ${childBotLabel})` : ""}</b>\n\n👤 User: ${telegramUser.username || telegramUser.first_name} (${telegramUser.id})\n📦 Product: ${productName}\n🔢 Quantity: <b>${quantity}</b>\n💵 Amount: ₹${finalAmount}\n✅ Auto-verified${isChildBot ? `\n🤖 Source Bot: <b>${childBotLabel}</b>` : ""}\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
      );

      try {
        const websiteLink = resolved.link && resolved.showInWebsite ? resolved.link : undefined;
        await syncPurchaseToProfile(supabase, telegramUser.id, price, productName, productId, websiteLink);
      } catch (e) { console.error("Sync error:", e); }

      try { await logProof(token, formatOrderPlaced(telegramUser.id, telegramUser.first_name || "User", productName, price, "Razorpay UPI")); } catch {}
      await processReferralBonus(supabase, telegramUser.id, token, price);
    } else {
      await sendMessage(token, chatId, `Payment not found yet.\n\nMake sure you paid exactly <b>₹${finalAmount}</b> and verify within 2 minutes of paying.`, {
        reply_markup: { inline_keyboard: [
          [{ text: "💳 Pay Now", url: "https://razorpay.me/@asifikbalrubaiulislam" }],
           [{ text: "✅ Verify Payment", callback_data: "razorpay_verify" }],
           [{ text: "❌ Cancel", callback_data: "razorpay_cancel" }],
        ]},
      });
    }
  } catch (err) {
    console.error("Razorpay verify error:", err);
    await sendMessage(token, chatId, "Verification error. Please try again.", {
      reply_markup: { inline_keyboard: [[{ text: "✅ Verify Payment", callback_data: "razorpay_verify" }]] },
    });
  }
}
