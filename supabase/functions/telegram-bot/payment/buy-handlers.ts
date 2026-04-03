// ===== BUY & PAYMENT HANDLERS =====

import { t } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet, setConversationState } from "../db-helpers.ts";

const INR_TO_USD_RATE = 60; // ₹60 = $1

function generatePayUrl(upiId: string, upiName: string, amount: number): string {
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR`;
}

function generateUpiQrUrl(upiId: string, upiName: string, amount: number): string {
  const upiString = generatePayUrl(upiId, upiName, amount);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
}

function generateFallbackQrUrl(upiId: string, upiName: string, amount: number): string {
  const upiString = generatePayUrl(upiId, upiName, amount);
  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(upiString)}`;
}

function generatePaymentNote(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function inrToUsd(inrAmount: number): number {
  const usd = inrAmount / INR_TO_USD_RATE;
  return Math.max(0.01, Math.round(usd * 100) / 100);
}

export async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any, lang: string) {
  const { data: product } = await supabase.from("products").select("name, price, stock, id").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  await showPaymentMethodChoice(token, supabase, chatId, telegramUser, product.name, product.price, product.id, null, lang);
}

export async function handleBuyVariation(token: string, supabase: any, chatId: number, variationId: string, telegramUser: any, lang: string) {
  const { data: variation } = await supabase
    .from("product_variations")
    .select("id, name, price, reseller_price, product_id")
    .eq("id", variationId)
    .single();

  if (!variation) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }

  const { data: product } = await supabase
    .from("products")
    .select("name, stock")
    .eq("id", variation.product_id)
    .single();

  const productName = `${product?.name || "Product"} - ${variation.name}`;
  const stock = product?.stock;
  if (stock !== null && stock !== undefined && stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  const wallet = await getWallet(supabase, telegramUser.id);
  const isReseller = wallet?.is_reseller === true;
  const price = isReseller ? (variation.reseller_price || variation.price) : variation.price;

  await showPaymentMethodChoice(token, supabase, chatId, telegramUser, productName, price, variation.product_id, variation.id, lang);
}

// Step 1: Show Binance / UPI choice (or wallet pay if balance covers it)
async function showPaymentMethodChoice(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, price: number, productId: string, variationId: string | null, lang: string
) {
  const userId = telegramUser.id;
  const wallet = await ensureWallet(supabase, userId);
  const walletBalance = wallet?.balance || 0;
  const finalAmount = Math.max(0, price - walletBalance);
  const walletDeduction = Math.min(walletBalance, price);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  let text = `<b>Order: ${productName}</b>\n\n`;
  text += `Price: <b>${currency}${price}</b>\n`;
  text += `Wallet Balance: <b>${currency}${walletBalance}</b>\n`;
  if (walletDeduction > 0) {
    text += `Wallet Deduction: <b>-${currency}${walletDeduction}</b>\n`;
  }
  text += `\n<b>Payable: ${currency}${finalAmount}</b>\n`;

  // If wallet covers it, go straight to wallet pay
  if (finalAmount === 0) {
    await setConversationState(supabase, userId, "wallet_pay_confirm", {
      productName, price, productId, variationId,
    });
    text += "\nClick below to confirm wallet payment.";
    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: t("pay_with_wallet", lang), callback_data: "walletpay_confirm" }]],
      },
    });
    return;
  }

  // Store purchase data for later
  await setConversationState(supabase, userId, "choose_payment_method", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
  });

  text += "\nChoose payment method:";

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Binance", callback_data: "paymethod_binance" },
          { text: "UPI", callback_data: "paymethod_upi" },
        ],
      ],
    },
  });
}

// Step 2a: Binance payment flow with auto-verify
export async function showBinancePayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const binanceId = settings.binance_id || "1178303416";
  const currency = settings.currency_symbol || "₹";
  const { productName, finalAmount, productId, variationId, walletDeduction, price } = purchaseData;

  const amountUsd = inrToUsd(finalAmount);
  const paymentNote = generatePaymentNote();

  // Create payment record
  const { data: payment } = await supabase.from("payments").insert({
    user_id: userId.toString(),
    amount: finalAmount,
    amount_usd: amountUsd,
    note: paymentNote,
    status: "pending",
    payment_method: "binance",
    product_id: productId,
    variation_id: variationId,
    product_name: productName,
    telegram_user_id: userId,
  }).select("id").single();

  // Store in conversation state for verify callback
  await setConversationState(supabase, userId, "binance_payment_pending", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
    paymentId: payment?.id,
    paymentNote,
    amountUsd,
  });

  let text = `<b>Binance Payment</b>\n\n`;
  text += `Product: <b>${productName}</b>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b> = <b>$${amountUsd}</b>\n\n`;
  text += `Binance Pay ID: <code>${binanceId}</code>\n`;
  text += `Payment Note: <code>${paymentNote}</code>\n\n`;
  text += `<b>Instructions:</b>\n`;
  text += `1. Open Binance App\n`;
  text += `2. Go to Pay > Send\n`;
  text += `3. Enter Pay ID: <code>${binanceId}</code>\n`;
  text += `4. Amount: <b>$${amountUsd}</b>\n`;
  text += `5. Add note: <code>${paymentNote}</code>\n`;
  text += `6. Complete payment\n`;
  text += `7. Click "Verify Payment" below\n\n`;
  text += `<i>Note must match exactly for auto-verification.</i>`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Verify Payment", callback_data: "binance_verify" }],
        [{ text: "Cancel", callback_data: "binance_cancel" }],
      ],
    },
  });
}

// Step 2b: UPI payment flow (existing logic)
export async function showUpiPayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const upiId = settings.upi_id || "8900684167@ibl";
  const upiName = settings.upi_name || "Asif Ikbal Rubaiul Islam";
  const { productName, finalAmount, productId, variationId, walletDeduction, price } = purchaseData;

  await setConversationState(supabase, userId, "awaiting_screenshot", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
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

// Verify Binance payment
export async function handleBinanceVerify(
  token: string, supabase: any, chatId: number, telegramUser: any, stateData: any
) {
  const { paymentId, paymentNote, amountUsd, productName, productId, variationId, walletDeduction, price } = stateData;

  await sendMessage(token, chatId, "Verifying payment...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-binance-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ note: paymentNote, amount: amountUsd, paymentId }),
    });

    const result = await verifyRes.json();

    if (result.success) {
      // Process the order like wallet pay does
      const { processReferralBonus } = await import("./wallet-pay.ts");

      // Deduct wallet if applicable
      if (walletDeduction > 0) {
        await supabase.from("telegram_wallets")
          .update({ balance: supabase.rpc ? undefined : 0 })
          .eq("telegram_id", telegramUser.id);
        
        // Actually deduct properly
        const wallet = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", telegramUser.id).single();
        if (wallet.data) {
          await supabase.from("telegram_wallets")
            .update({ balance: Math.max(0, wallet.data.balance - walletDeduction) })
            .eq("telegram_id", telegramUser.id);
        }
      }

      // Create telegram order
      await supabase.from("telegram_orders").insert({
        telegram_user_id: telegramUser.id,
        product_name: productName,
        product_id: productId,
        amount: price,
        status: "confirmed",
        username: telegramUser.username || telegramUser.first_name,
      });

      // Get access link
      const { data: product } = await supabase.from("products").select("access_link").eq("id", productId).single();

      let successText = `<b>Payment Verified!</b>\n\n`;
      successText += `Product: <b>${productName}</b>\n`;
      successText += `Amount: <b>$${amountUsd}</b>\n`;
      if (product?.access_link) {
        successText += `\nAccess Link:\n${product.access_link}`;
      }

      await sendMessage(token, chatId, successText);
      await setConversationState(supabase, telegramUser.id, "idle", {});

      // Process referral bonus
      await processReferralBonus(token, supabase, telegramUser.id, price, "en");
    } else {
      await sendMessage(token, chatId, `${result.message || "Payment not found."}\n\nTry again after completing payment.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Verify Payment", callback_data: "binance_verify" }],
            [{ text: "Cancel", callback_data: "binance_cancel" }],
          ],
        },
      });
    }
  } catch (err) {
    console.error("Binance verify error:", err);
    await sendMessage(token, chatId, "Verification error. Please try again.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Verify Payment", callback_data: "binance_verify" }],
        ],
      },
    });
  }
}

// Keep legacy export for compatibility
export const showPaymentInfo = showPaymentMethodChoice;
