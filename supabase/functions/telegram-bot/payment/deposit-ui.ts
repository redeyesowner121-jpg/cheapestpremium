// ===== Deposit UI - method choice, amount entry, screen renderers =====

import { t } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, setConversationState } from "../db-helpers.ts";
import { generatePayUrl, generateUpiQrUrl, generateFallbackQrUrl } from "./payment-utils.ts";

// Step 1: Show payment method choice FIRST (Binance / UPI)
export async function handleDepositStart(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  await setConversationState(supabase, userId, "deposit_choose_method", {});

  const text = lang === "bn"
    ? `➕ <b>ওয়ালেট টপ আপ</b>\n\nপেমেন্ট পদ্ধতি বেছে নিন:`
    : `➕ <b>Wallet Top Up</b>\n\nChoose payment method:`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💎 Binance", callback_data: "deposit_method_binance", style: "success" },
          { text: "📱 UPI", callback_data: "deposit_method_upi", style: "primary" },
        ],
        [{ text: "📖 How to Pay (Tutorial)", url: "https://t.me/Cheapest_premiums_Help/3" }],
        [{ text: `⬅️ ${t("back", lang)}`, callback_data: "my_wallet" }],
      ],
    },
  });
}

// Step 2: Ask deposit amount AFTER method is chosen
export async function showDepositAmountEntry(token: string, supabase: any, chatId: number, userId: number, method: string, lang: string) {
  const settings = await getSettings(supabase);
  const minDeposit = settings.min_deposit_amount || "100";
  const maxDeposit = settings.max_deposit_amount || "50000";
  const methodLabel = method === "binance" ? "💎 Binance" : "📱 UPI";

  await setConversationState(supabase, userId, "deposit_enter_amount", { method });

  const text = lang === "bn"
    ? `${methodLabel} <b>ডিপোজিট</b>\n\n💰 কত টাকা জমা করতে চান?\n\n📊 সীমা: ₹${minDeposit} - ₹${maxDeposit}\n\n✏️ পরিমাণ লিখুন (যেমন: <code>500</code>)`
    : `${methodLabel} <b>Deposit</b>\n\nHow much do you want to deposit?\n\n📊 Limits: ₹${minDeposit} - ₹${maxDeposit}\n\n✏️ Enter amount (e.g. <code>500</code>)`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "₹100", callback_data: "deposit_amt_100" },
          { text: "₹200", callback_data: "deposit_amt_200" },
          { text: "₹500", callback_data: "deposit_amt_500" },
        ],
        [
          { text: "₹1000", callback_data: "deposit_amt_1000" },
          { text: "₹2000", callback_data: "deposit_amt_2000" },
          { text: "₹5000", callback_data: "deposit_amt_5000" },
        ],
        [{ text: `⬅️ ${t("back", lang)}`, callback_data: "wallet_deposit" }],
      ],
    },
  });
}

// Legacy wrapper — routes based on method stored in conversation state
export async function showDepositMethodChoice(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const { getConversationState } = await import("../db-helpers.ts");
  const convState = await getConversationState(supabase, userId);
  const method = convState?.data?.method;
  if (method === "binance") {
    await showDepositBinance(token, supabase, chatId, userId, amount, lang);
  } else if (method === "upi") {
    await showDepositUpi(token, supabase, chatId, userId, amount, lang);
  } else {
    await showDepositUpi(token, supabase, chatId, userId, amount, lang);
  }
}

// Step 3a: Binance deposit — manual screenshot verification
export async function showDepositBinance(token: string, supabase: any, chatId: number, userId: number, amount: number | null, _lang: string) {
  const settings = await getSettings(supabase);
  const binanceId = settings.binance_id || "1178303416";

  await setConversationState(supabase, userId, "deposit_binance_awaiting_screenshot", { amount });

  let text = `<b>💎 Binance Deposit</b>\n\n`;
  text += `Binance Pay ID: <code>${binanceId}</code>\n\n`;
  if (amount) text += `Amount: <b>₹${amount}</b>\n\n`;
  text += `<b>Instructions:</b>\n`;
  text += `1. Open Binance App\n`;
  text += `2. Go to Pay > Send\n`;
  text += `3. Pay ID: <code>${binanceId}</code>\n`;
  text += `4. Send any amount you want to deposit\n`;
  text += `5. Complete payment\n`;
  text += `6. <b>📸 Send payment screenshot here</b>\n\n`;
  text += `<i>After paying, take a screenshot and send it as a photo here.</i>`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }],
      ],
    },
  });
}

// Step 3b: UPI sub-choice
export async function showDepositUpi(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  await setConversationState(supabase, userId, "deposit_choose_upi", { amount });

  let text = `<b>📱 UPI ${lang === "bn" ? "ডিপোজিট" : "Deposit"}: ${currency}${amount}</b>\n\n`;
  text += lang === "bn" ? "UPI পেমেন্ট পদ্ধতি বেছে নিন:" : "Choose UPI method:";

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⚡ Automatic (Razorpay)", callback_data: "deposit_upi_auto", style: "success" }],
        [{ text: "📋 Manual (Screenshot)", callback_data: "deposit_upi_manual", style: "primary" }],
        [{ text: `⬅️ ${t("back", lang)}`, callback_data: "deposit_choose_method" }],
      ],
    },
  });
}

// Step 3b-i: Auto UPI (Razorpay) deposit
export async function showDepositRazorpay(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const razorpayMeUrl = settings.payment_link || "https://razorpay.me/@asifikbalrubaiulislam";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let uniqueAmount: number;
  let reservationId: string | null = null;
  let depositRequestId: string | null = null;

  try {
    const reserveRes = await fetch(`${supabaseUrl}/functions/v1/reserve-razorpay-amount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ userId: userId.toString(), baseAmount: amount }),
    });
    const reserveData = await reserveRes.json();

    if (reserveData.error) {
      await sendMessage(token, chatId, lang === "bn" ? "❌ রিজার্ভেশন ব্যর্থ। আবার চেষ্টা করুন।" : "❌ Reservation failed. Try again.");
      return;
    }

    uniqueAmount = reserveData.uniqueAmount;
    reservationId = reserveData.reservationId;
    depositRequestId = reserveData.depositRequestId;
  } catch (err) {
    console.error("Reserve amount error:", err);
    await sendMessage(token, chatId, "❌ Error creating reservation. Try again.");
    return;
  }

  const charge = parseFloat((uniqueAmount - amount).toFixed(2));
  const payClickedAt = new Date().toISOString();

  await setConversationState(supabase, userId, "deposit_razorpay_pending", {
    amount, uniqueAmount, payClickedAt, reservationId, depositRequestId,
  });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(razorpayMeUrl)}`;

  let text = `<b>⚡ Razorpay ${lang === "bn" ? "ডিপোজিট" : "Deposit"}</b>\n\n`;
  text += `${lang === "bn" ? "মূল পরিমাণ" : "Base Amount"}: <b>${currency}${amount}</b>\n`;
  text += `${lang === "bn" ? "ভেরিফিকেশন চার্জ (2%+)" : "Verification fee (2%+)"}: <b>${currency}${charge.toFixed(2)}</b>\n`;
  text += `${lang === "bn" ? "মোট পে করুন" : "Total to pay"}: <b>${currency}${uniqueAmount}</b>\n\n`;
  text += `<b>${lang === "bn" ? "নির্দেশনা" : "Instructions"}:</b>\n`;
  text += `1. ${lang === "bn" ? "নিচের" : "Click"} <b>Pay Now</b> ${lang === "bn" ? "বাটনে ক্লিক করুন বা QR স্ক্যান করুন" : "below or scan QR"}\n`;
  text += `2. ${lang === "bn" ? "ঠিক" : "Pay exactly"} <b>${currency}${uniqueAmount}</b> ${lang === "bn" ? "পে করুন" : ""}\n`;
  text += `3. ${lang === "bn" ? "পেমেন্ট শেষে" : "After payment click"} <b>Verify</b> ${lang === "bn" ? "ক্লিক করুন" : ""}\n\n`;
  text += `<i>⚠️ ${lang === "bn" ? "ঠিক ₹" + uniqueAmount + " পে করুন, নাহলে ভেরিফাই হবে না!" : "Pay exactly ₹" + uniqueAmount + " or verification will fail!"}</i>\n`;
  text += `<i>⏰ ${lang === "bn" ? "১০ মিনিটের মধ্যে পেমেন্ট করুন" : "Pay within 10 minutes"}</i>`;

  let sent = false;
  const fallbackQrUrl = `https://quickchart.io/qr?size=300&text=${encodeURIComponent(razorpayMeUrl)}`;
  for (const url of [qrUrl, fallbackQrUrl]) {
    try {
      const res = await fetch(`${getTelegramApiUrl(token)}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId, photo: url, caption: text, parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💳 Pay Now", url: razorpayMeUrl, style: "success" }],
              [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify", style: "primary" }],
              [{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }],
            ],
          },
        }),
      });
      if ((await res.json()).ok) { sent = true; break; }
    } catch { /* fallback */ }
  }

  if (!sent) {
    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Pay Now", url: razorpayMeUrl, style: "success" }],
          [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify", style: "primary" }],
          [{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }],
        ],
      },
    });
  }
}

// Step 3b-ii: Manual UPI deposit (screenshot)
export async function showDepositManualUpi(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const upiId = settings.upi_id || "8900684167@ibl";
  const upiName = settings.upi_name || "Asif Ikbal Rubaiul Islam";

  await setConversationState(supabase, userId, "deposit_awaiting_screenshot", { amount });

  const upiIntentUrl = generatePayUrl(upiId, upiName, amount);
  const escapedUrl = upiIntentUrl.replace(/&/g, "&amp;");

  let text = `<b>📋 Manual UPI ${lang === "bn" ? "ডিপোজিট" : "Deposit"}</b>\n\n`;
  text += `UPI ID: <code>${upiId}</code>\n`;
  text += `${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>${currency}${amount}</b>\n`;
  text += `UPI Link: <code>${escapedUrl}</code>\n\n`;
  text += lang === "bn"
    ? "QR স্ক্যান করুন বা UPI লিংক কপি করে পে করুন। তারপর পেমেন্ট স্ক্রিনশট পাঠান।"
    : "Scan QR or copy UPI link to pay. Then send payment screenshot.";

  let sent = false;
  for (const qrUrl of [generateUpiQrUrl(upiId, upiName, amount), generateFallbackQrUrl(upiId, upiName, amount)]) {
    try {
      const res = await fetch(`${getTelegramApiUrl(token)}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: qrUrl, caption: text, parse_mode: "HTML" }),
      });
      if ((await res.json()).ok) { sent = true; break; }
    } catch { /* fallback */ }
  }
  if (!sent) await sendMessage(token, chatId, text);

  await sendMessage(token, chatId, lang === "bn"
    ? "পেমেন্ট করার পর <b>স্ক্রিনশট</b> পাঠান।"
    : "After payment, send the <b>screenshot</b>.");
}
