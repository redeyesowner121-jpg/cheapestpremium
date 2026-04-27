// ===== Payment method choice + Binance/UPI/Razorpay screens =====

import { t } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, ensureWallet, setConversationState, deleteConversationState } from "../db-helpers.ts";
import { getChildBotContext } from "../child-context.ts";
import { generatePayUrl, generateUpiQrUrl, generateFallbackQrUrl, inrToUsd, getDynamicUsdRate } from "./payment-utils.ts";

export async function showPaymentMethodChoice(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, price: number, productId: string, variationId: string | null, lang: string,
  quantity: number = 1, unitPrice?: number,
) {
  const userId = telegramUser.id;
  const wallet = await ensureWallet(supabase, userId);
  const walletBalance = wallet?.balance || 0;
  const finalAmount = Math.max(0, price - walletBalance);
  const walletDeduction = Math.min(walletBalance, price);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  await supabase
    .from("products")
    .select("delivery_mode, access_link")
    .eq("id", productId)
    .single();

  const autoPayOnly = false;

  const childCtx = getChildBotContext();
  const childBotData = childCtx ? { childBotId: childCtx.id, childBotRevenue: childCtx.revenue_percent } : {};

  let text = `<b>Order: ${productName}</b>\n\n`;
  text += `Price: <b>${currency}${price}</b>\n`;
  text += `Wallet Balance: <b>${currency}${walletBalance}</b>\n`;
  if (walletDeduction > 0) {
    text += `Wallet Deduction: <b>-${currency}${walletDeduction}</b>\n`;
  }
  text += `\n<b>Payable: ${currency}${finalAmount}</b>\n`;

  if (finalAmount === 0) {
    if (price === 0) {
      await deleteConversationState(supabase, userId);
      const { handleWalletPay } = await import("./wallet-pay.ts");
      await handleWalletPay(
        token, supabase, chatId, userId, 0, productName, lang,
        productId, childCtx?.id, childCtx?.revenue_percent, quantity,
      );
      return;
    }
    await setConversationState(supabase, userId, "wallet_pay_confirm", {
      productName, price, productId, variationId, quantity, unitPrice, ...childBotData,
    });
    text += "\nClick below to confirm wallet payment.";
    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: `💳 ${t("pay_with_wallet", lang)}`, callback_data: "walletpay_confirm", style: "success" }]],
      },
    });
    return;
  }

  await setConversationState(supabase, userId, "choose_payment_method", {
    productName, price, finalAmount, productId, variationId, walletDeduction, autoPayOnly, quantity, unitPrice, ...childBotData,
  });

  text += "\nChoose payment method:";
  if (autoPayOnly) {
    text += "\n<i>⚡ This product requires automatic payment verification.</i>";
  }

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💎 Binance", callback_data: "paymethod_binance", style: "success" },
          { text: "📱 UPI", callback_data: "paymethod_upi", style: "primary" },
        ],
        [{ text: "📖 How to Pay (Tutorial)", url: "https://t.me/Cheapest_premiums_Help/3" }],
      ],
    },
  });
}

// Step 2a: Binance — manual screenshot verification
export async function showBinancePayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const binanceId = settings.binance_id || "1178303416";
  const currency = settings.currency_symbol || "₹";
  const { productName, finalAmount, productId, variationId, walletDeduction, price, childBotId, childBotRevenue, quantity, unitPrice } = purchaseData;

  const usdRate = await getDynamicUsdRate(supabase);
  const amountUsd = inrToUsd(finalAmount, usdRate);

  await setConversationState(supabase, userId, "binance_awaiting_screenshot", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
    amountUsd, quantity, unitPrice,
    childBotId, childBotRevenue,
  });

  let text = `<b>💎 Binance Payment</b>\n\n`;
  text += `Product: <b>${productName}</b>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b> = <b>$${amountUsd}</b>\n\n`;
  text += `Binance Pay ID: <code>${binanceId}</code>\n\n`;
  text += `<b>Instructions:</b>\n`;
  text += `1. Open Binance App\n`;
  text += `2. Go to Pay > Send\n`;
  text += `3. Enter Pay ID: <code>${binanceId}</code>\n`;
  text += `4. Amount: <b>$${amountUsd}</b>\n`;
  text += `5. Complete payment\n`;
  text += `6. <b>📸 Send payment screenshot here</b>\n\n`;
  text += `<i>After paying, take a screenshot and send it as a photo here.</i>`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "❌ Cancel", callback_data: "binance_cancel", style: "danger" }],
      ],
    },
  });
}

// Step 2b: UPI choice - Auto (Razorpay) or Manual
export async function showUpiPayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const { productName, finalAmount, autoPayOnly } = purchaseData;

  if (autoPayOnly) {
    await showRazorpayUpiPayment(token, supabase, chatId, telegramUser, purchaseData);
    return;
  }

  await setConversationState(supabase, userId, "choose_upi_method", purchaseData);

  let text = `<b>UPI Payment - ${productName}</b>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b>\n\n`;
  text += `Choose UPI payment method:`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⚡ Automatic (Razorpay)", callback_data: "upi_auto", style: "success" }],
        [{ text: "📋 Manual (Screenshot)", callback_data: "upi_manual", style: "primary" }],
      ],
    },
  });
}

// Step 2b-i: Auto UPI via Razorpay
export async function showRazorpayUpiPayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const { productName, finalAmount, productId, variationId, walletDeduction, price, childBotId, childBotRevenue, quantity, unitPrice } = purchaseData;

  const razorpayMeUrl = "https://razorpay.me/@asifikbalrubaiulislam";

  const { data: payment } = await supabase.from("payments").insert({
    user_id: userId.toString(),
    amount: finalAmount,
    note: `TIME-${Date.now()}`,
    status: "pending",
    payment_method: "razorpay_upi",
    product_id: productId,
    variation_id: variationId,
    product_name: productName,
    telegram_user_id: userId,
  }).select("id").single();

  const payClickedAt = new Date().toISOString();

  await setConversationState(supabase, userId, "razorpay_payment_pending", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
    paymentId: payment?.id,
    payClickedAt, quantity, unitPrice,
    childBotId, childBotRevenue,
  });

  let text = `<b>⚡ UPI Payment</b>\n\n`;
  text += `Product: <b>${productName}</b>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b>\n\n`;
  text += `<b>Instructions:</b>\n`;
  text += `1. Click <b>Pay Now</b> below\n`;
  text += `2. Pay exactly <b>${currency}${finalAmount}</b>\n`;
  text += `3. Click <b>Verify Payment</b> within 2 minutes\n\n`;
  text += `<i>⚠️ Verify within 2 minutes of paying!</i>`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Pay Now", url: razorpayMeUrl, style: "success" }],
        [{ text: "✅ Verify Payment", callback_data: "razorpay_verify", style: "primary" }],
        [{ text: "❌ Cancel", callback_data: "razorpay_cancel", style: "danger" }],
      ],
    },
  });
}

// Step 2b-ii: Manual UPI (existing screenshot flow)
export async function showManualUpiPayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const upiId = settings.upi_id || "8900684167@ibl";
  const upiName = settings.upi_name || "Asif Ikbal Rubaiul Islam";
  const { productName, finalAmount, productId, variationId, walletDeduction, price, childBotId, childBotRevenue, quantity, unitPrice } = purchaseData;

  await setConversationState(supabase, userId, "awaiting_screenshot", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
    quantity, unitPrice,
    childBotId, childBotRevenue,
  });

  const upiIntentUrl = generatePayUrl(upiId, upiName, finalAmount);
  const escapedUpiIntentUrl = upiIntentUrl.replace(/&/g, "&amp;");

  let text = `<b>UPI Payment</b>\n\n`;
  text += `Product: <b>${productName}</b>\n\n`;
  text += `UPI ID: <code>${upiId}</code>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b>\n`;
  text += `UPI Link: <code>${escapedUpiIntentUrl}</code>\n\n`;
  text += `Scan QR or copy UPI link to pay. Then send payment screenshot.`;

  let paymentMessageSent = false;
  const qrUrls = [generateUpiQrUrl(upiId, upiName, finalAmount), generateFallbackQrUrl(upiId, upiName, finalAmount)];

  for (const qrUrl of qrUrls) {
    try {
      const photoRes = await fetch(`${getTelegramApiUrl(token)}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: qrUrl, caption: text, parse_mode: "HTML" }),
      });
      const photoResult = await photoRes.json();
      if (photoResult.ok) { paymentMessageSent = true; break; }
    } catch { /* fallback */ }
  }

  if (!paymentMessageSent) {
    await sendMessage(token, chatId, text);
  }

  await sendMessage(token, chatId, `UPI Link:\n<code>${escapedUpiIntentUrl}</code>`);
  await sendMessage(token, chatId, "After payment, send the <b>screenshot</b>.");
}
