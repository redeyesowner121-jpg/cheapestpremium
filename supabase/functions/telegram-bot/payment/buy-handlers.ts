// ===== BUY & PAYMENT HANDLERS =====

import { t, UPI_ID, UPI_NAME } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet, setConversationState } from "../db-helpers.ts";

function generatePayUrl(amount: number): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR`;
}

function generateTelegramPayUrl(amount: number, productName: string): string {
  const baseUrl = Deno.env.get("SUPABASE_URL") || "";
  const params = new URLSearchParams({
    action: "upi_redirect",
    pa: UPI_ID,
    pn: UPI_NAME,
    am: amount.toString(),
    tn: productName.substring(0, 50),
    cu: "INR",
  });
  return `${baseUrl}/functions/v1/telegram-bot?${params.toString()}`;
}

function generateUpiQrUrl(amount: number): string {
  const upiString = generatePayUrl(amount);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
}

function generateFallbackQrUrl(amount: number): string {
  const upiString = generatePayUrl(amount);
  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(upiString)}`;
}

export async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any, lang: string) {
  const { data: product } = await supabase.from("products").select("name, price, stock, id").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  await showPaymentInfo(token, supabase, chatId, telegramUser, product.name, product.price, product.id, null, lang);
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

  await showPaymentInfo(token, supabase, chatId, telegramUser, productName, price, variation.product_id, variation.id, lang);
}

export async function showPaymentInfo(
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

  let text = `🛒 <b>${lang === "bn" ? "অর্ডার" : "Order"}: ${productName}</b>\n\n`;
  text += `💰 ${lang === "bn" ? "মূল্য" : "Price"}: <b>${currency}${price}</b>\n`;
  text += `💳 ${lang === "bn" ? "ওয়ালেট ব্যালেন্স" : "Wallet Balance"}: <b>${currency}${walletBalance}</b>\n`;
  if (walletDeduction > 0) {
    text += `🔻 ${lang === "bn" ? "ওয়ালেট কর্তন" : "Wallet Deduction"}: <b>-${currency}${walletDeduction}</b>\n`;
  }
  text += `\n💵 <b>${lang === "bn" ? "পরিশোধযোগ্য" : "Payable"}: ${currency}${finalAmount}</b>\n\n`;

  const buttons: any[][] = [];

  if (finalAmount === 0) {
    await setConversationState(supabase, userId, "wallet_pay_confirm", {
      productName, price, productId, variationId,
    });
    text += lang === "bn"
      ? "💳 ওয়ালেট থেকে পেমেন্ট কনফার্ম করতে নীচের বাটনে ক্লিক করুন।"
      : "💳 Click the button below to confirm wallet payment.";
    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: lang === "bn" ? "💳 ওয়ালেট দিয়ে পে করুন" : "💳 Pay with Wallet", callback_data: "walletpay_confirm" }]],
      },
    });
    return;
  } else {
    const upiIntentUrl = generatePayUrl(finalAmount);

    text += `<b>💳 ${lang === "bn" ? "পেমেন্ট করুন" : "Make Payment"}:</b>\n\n`;
    text += `📱 UPI ID: <code>${UPI_ID}</code>\n`;
    text += `💵 ${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>${currency}${finalAmount}</b>\n`;
    text += `🔗 UPI: <code>${upiIntentUrl.replace(/&/g, "&amp;")}</code>\n\n`;
    text += `🌐 ${lang === "bn" ? "ইন্টারন্যাশনাল/বাইন্যান্স পেমেন্টের জন্য" : "For International/Binance Payment"}:\n`;
    text += `🆔 Binance ID: <code>1178303416</code>\n\n`;
    text += `${lang === "bn" ? "নীচের বাটনে ক্লিক করে পেমেন্ট করুন। তারপর পেমেন্ট স্ক্রিনশট পাঠান।" : "Click the button below to pay. Then send payment screenshot."}`;

    const payUrl = generateTelegramPayUrl(finalAmount, productName);
    buttons.push([{ text: `💳 ${lang === "bn" ? "এখনই পে করুন" : "Pay Now"}`, url: payUrl }]);

    await setConversationState(supabase, userId, "awaiting_screenshot", {
      productName, price, finalAmount, productId, variationId, walletDeduction,
    });

    let paymentMessageSent = false;
    const qrUrls = [generateUpiQrUrl(finalAmount), generateFallbackQrUrl(finalAmount)];

    for (const qrUrl of qrUrls) {
      try {
        const photoRes = await fetch(`${getTelegramApiUrl(token)}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: qrUrl,
            caption: text,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: buttons },
          }),
        });

        const photoResult = await photoRes.json();
        if (photoResult.ok) {
          paymentMessageSent = true;
          break;
        }
      } catch {
        // try next QR provider
      }
    }

    if (!paymentMessageSent) {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }

    await sendMessage(token, chatId, lang === "bn"
      ? "📸 পেমেন্ট করার পর <b>স্ক্রিনশট</b> পাঠান।"
      : "📸 After payment, send the <b>screenshot</b>.");
    return;
  }
}
