// ===== BUY & PAYMENT HANDLERS =====

import { t } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet, setConversationState } from "../db-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";
import { getChildBotContext, childBotPrice } from "../child-context.ts";
import { generatePayUrl, generateUpiQrUrl, generateFallbackQrUrl, inrToUsd } from "./payment-utils.ts";

// Re-export from split modules for backward compat
export { handleRazorpayVerify } from "./razorpay-verify.ts";
export { handleBinanceVerify } from "./binance-verify.ts";

/** Helper: notify main bot admins for child bot pending orders */
async function notifyMainAdminsForChildOrder(
  supabase: any, orderId: string, userId: number, productName: string, price: number, childBotId: string, paymentMethod: string
) {
  const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!mainToken) return;

  const { notifyAllAdmins } = await import("../db-helpers.ts");

  const adminMsg = `📩 <b>Child Bot Order (${paymentMethod})</b>\n\n👤 User: <code>${userId}</code>\n📦 Product: <b>${productName}</b>\n💵 Amount: <b>₹${price}</b>\n🤖 Child Bot: <code>${childBotId}</code>\n🆔 Order: <code>${orderId.slice(0, 8)}</code>`;

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
}

export async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any, lang: string) {
  const { data: product } = await supabase.from("products").select("name, price, stock, id, reseller_price").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  const childCtx = getChildBotContext();
  let buyPrice = product.price;
  if (childCtx) {
    buyPrice = childBotPrice(product.reseller_price, product.price);
  }

  await showQuantitySelector(token, supabase, chatId, telegramUser, product.name, buyPrice, product.id, null, product.stock, lang);
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

  const childCtx = getChildBotContext();
  let price: number;
  if (childCtx) {
    price = childBotPrice(variation.reseller_price, variation.price);
  } else {
    const wallet = await getWallet(supabase, telegramUser.id);
    const isReseller = wallet?.is_reseller === true;
    price = isReseller ? (variation.reseller_price || variation.price) : variation.price;
  }

  await showQuantitySelector(token, supabase, chatId, telegramUser, productName, price, variation.product_id, variation.id, stock ?? null, lang);
}

// ===== QUANTITY SELECTOR =====
// Shows quick-pick quantity buttons and a custom-input option.
export async function showQuantitySelector(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, unitPrice: number, productId: string, variationId: string | null,
  stock: number | null, lang: string,
) {
  const userId = telegramUser.id;
  const childCtx = getChildBotContext();
  const childBotData = childCtx ? { childBotId: childCtx.id, childBotRevenue: childCtx.revenue_percent } : {};

  // Save selection context for both quick-pick + custom-typed quantity.
  await setConversationState(supabase, userId, "awaiting_quantity_choice", {
    productName, unitPrice, productId, variationId, stock, ...childBotData,
  });

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  const quickQuantities = [1, 2, 3, 5, 10];
  const allowedQuantities = stock != null ? quickQuantities.filter((q) => q <= stock) : quickQuantities;
  const finalQuantities = allowedQuantities.length ? allowedQuantities : [1];

  const rows: any[][] = [];
  for (let i = 0; i < finalQuantities.length; i += 3) {
    rows.push(
      finalQuantities.slice(i, i + 3).map((q) => ({
        text: `${q}× — ${currency}${unitPrice * q}`,
        callback_data: `qty_${q}`,
        style: "primary",
      })),
    );
  }
  rows.push([{ text: lang === "bn" ? "✏️ কাস্টম পরিমাণ" : "✏️ Custom Quantity", callback_data: "qty_custom", style: "success" }]);
  rows.push([{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "qty_cancel", style: "danger" }]);

  let text = `<b>${productName}</b>\n\n`;
  text += lang === "bn"
    ? `প্রতি ইউনিট মূল্য: <b>${currency}${unitPrice}</b>\n`
    : `Unit Price: <b>${currency}${unitPrice}</b>\n`;
  if (stock != null) {
    text += lang === "bn" ? `স্টক: <b>${stock}</b>\n` : `Stock: <b>${stock}</b>\n`;
  }
  text += "\n";
  text += lang === "bn"
    ? "নিচ থেকে পরিমাণ বেছে নাও অথবা কাস্টম লিখো:"
    : "Pick a quantity below, or enter a custom amount:";

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: rows } });
}

// Called once a quantity has been picked (button or custom-typed).
export async function proceedToPaymentWithQuantity(
  token: string, supabase: any, chatId: number, telegramUser: any,
  state: { productName: string; unitPrice: number; productId: string; variationId: string | null; stock: number | null; childBotId?: string; childBotRevenue?: number },
  quantity: number, lang: string,
) {
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 1000) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ অবৈধ পরিমাণ। ১ থেকে ১০০০ এর মধ্যে দাও।" : "❌ Invalid quantity. Enter a number between 1 and 1000.");
    return;
  }
  if (state.stock != null && quantity > state.stock) {
    await sendMessage(token, chatId, lang === "bn" ? `❌ স্টকে শুধু ${state.stock} টা আছে।` : `❌ Only ${state.stock} in stock.`);
    return;
  }

  const totalPrice = state.unitPrice * quantity;
  const labeledName = quantity > 1 ? `${state.productName} × ${quantity}` : state.productName;

  await showPaymentMethodChoice(
    token, supabase, chatId, telegramUser,
    labeledName, totalPrice, state.productId, state.variationId, lang,
    quantity, state.unitPrice,
  );
}

// Step 1: Show Binance / UPI choice (or wallet pay if balance covers it)
async function showPaymentMethodChoice(
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

  // Check if product has instant delivery or price < 50 → auto-only
  const { data: productInfo } = await supabase
    .from("products")
    .select("delivery_mode, access_link")
    .eq("id", productId)
    .single();

  const hasInstantDelivery = !!(productInfo?.access_link) || productInfo?.delivery_mode === "unique";
  const autoPayOnly = false; // Manual payment always available

  // Store child bot context in conversation state data
  const childCtx = getChildBotContext();
  const childBotData = childCtx ? { childBotId: childCtx.id, childBotRevenue: childCtx.revenue_percent } : {};

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

  // Store purchase data for later
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

// Step 2a: Binance payment flow with order ID verification
export async function showBinancePayment(
  token: string, supabase: any, chatId: number, telegramUser: any, purchaseData: any
) {
  const userId = telegramUser.id;
  const settings = await getSettings(supabase);
  const binanceId = settings.binance_id || "1178303416";
  const currency = settings.currency_symbol || "₹";
  const { productName, finalAmount, productId, variationId, walletDeduction, price, childBotId, childBotRevenue } = purchaseData;

  const amountUsd = inrToUsd(finalAmount);

  // Create payment record
  const { data: payment } = await supabase.from("payments").insert({
    user_id: userId.toString(),
    amount: finalAmount,
    amount_usd: amountUsd,
    note: `BINANCE_ORDER_ID_PENDING`,
    status: "pending",
    payment_method: "binance",
    product_id: productId,
    variation_id: variationId,
    product_name: productName,
    telegram_user_id: userId,
  }).select("id").single();

  // Store in conversation state — user will send order ID as text
  await setConversationState(supabase, userId, "binance_awaiting_order_id", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
    paymentId: payment?.id,
    amountUsd,
    childBotId, childBotRevenue,
  });

  let text = `<b>Binance Payment</b>\n\n`;
  text += `Product: <b>${productName}</b>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b> = <b>$${amountUsd}</b>\n\n`;
  text += `Binance Pay ID: <code>${binanceId}</code>\n\n`;
  text += `<b>Instructions:</b>\n`;
  text += `1. Open Binance App\n`;
  text += `2. Go to Pay > Send\n`;
  text += `3. Enter Pay ID: <code>${binanceId}</code>\n`;
  text += `4. Amount: <b>$${amountUsd}</b>\n`;
  text += `5. Complete payment\n`;
  text += `6. <b>Send your Binance Order ID here</b>\n\n`;
  text += `<i>After paying, copy the Order ID from Binance and send it as a message here.</i>`;

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

  // If auto-only, skip manual option and go straight to Razorpay
  if (autoPayOnly) {
    await showRazorpayUpiPayment(token, supabase, chatId, telegramUser, purchaseData);
    return;
  }

  // Keep state for sub-choice
  await setConversationState(supabase, userId, "choose_upi_method", purchaseData);

  let text = `<b>UPI Payment - ${productName}</b>\n`;
  text += `Amount: <b>${currency}${finalAmount}</b>\n\n`;
  text += `Choose UPI payment method:`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚡ Automatic (Razorpay)", callback_data: "upi_auto", style: "success" },
        ],
        [
          { text: "📋 Manual (Screenshot)", callback_data: "upi_manual", style: "primary" },
        ],
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
  const { productName, finalAmount, productId, variationId, walletDeduction, price, childBotId, childBotRevenue } = purchaseData;

  const razorpayMeUrl = "https://razorpay.me/@asifikbalrubaiulislam";

  // Create payment record
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

  // Store in conversation state
  await setConversationState(supabase, userId, "razorpay_payment_pending", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
    paymentId: payment?.id,
    payClickedAt,
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
  const { productName, finalAmount, productId, variationId, walletDeduction, price, childBotId, childBotRevenue } = purchaseData;

  await setConversationState(supabase, userId, "awaiting_screenshot", {
    productName, price, finalAmount, productId, variationId, walletDeduction,
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

// Legacy export for compatibility
export const showPaymentInfo = showPaymentMethodChoice;
