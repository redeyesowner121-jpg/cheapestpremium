// ===== WALLET DEPOSIT HANDLERS =====
// Handles Binance and UPI (Auto Razorpay + Manual) deposit flows for wallet top-up

import { t } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet, setConversationState, deleteConversationState, notifyAllAdmins } from "../db-helpers.ts";

const INR_TO_USD_RATE = 60;

function generatePaymentNote(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let note = '';
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 6) {
      note += digits[Math.floor(Math.random() * digits.length)];
    } else {
      note += letters[Math.floor(Math.random() * letters.length)];
    }
  }
  return note;
}

function inrToUsd(inrAmount: number): number {
  const usd = inrAmount / INR_TO_USD_RATE;
  return Math.max(0.01, Math.round(usd * 100) / 100);
}

function generatePayUrl(upiId: string, upiName: string, amount: number): string {
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR`;
}

function generateUpiQrUrl(upiId: string, upiName: string, amount: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatePayUrl(upiId, upiName, amount))}`;
}

function generateFallbackQrUrl(upiId: string, upiName: string, amount: number): string {
  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(generatePayUrl(upiId, upiName, amount))}`;
}

// Step 1: Ask deposit amount
export async function handleDepositStart(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const settings = await getSettings(supabase);
  const minDeposit = settings.min_deposit_amount || "100";
  const maxDeposit = settings.max_deposit_amount || "50000";

  await setConversationState(supabase, userId, "deposit_enter_amount", {});

  const text = lang === "bn"
    ? `➕ <b>ওয়ালেট টপ আপ</b>\n\n💰 কত টাকা জমা করতে চান?\n\n📊 সীমা: ₹${minDeposit} - ₹${maxDeposit}\n\n✏️ পরিমাণ লিখুন (যেমন: <code>500</code>)`
    : `➕ <b>Wallet Top Up</b>\n\nHow much do you want to deposit?\n\n📊 Limits: ₹${minDeposit} - ₹${maxDeposit}\n\n✏️ Enter amount (e.g. <code>500</code>)`;

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
        [{ text: t("back", lang), callback_data: "my_wallet" }],
      ],
    },
  });
}

// Step 2: Show payment method choice
export async function showDepositMethodChoice(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  await setConversationState(supabase, userId, "deposit_choose_method", { amount });

  let text = `<b>💰 ${lang === "bn" ? "ডিপোজিট" : "Deposit"}: ${currency}${amount}</b>\n\n`;
  text += lang === "bn" ? "পেমেন্ট পদ্ধতি বেছে নিন:" : "Choose payment method:";

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💎 Binance", callback_data: "deposit_binance" },
          { text: "📱 UPI", callback_data: "deposit_upi" },
        ],
        [{ text: t("back", lang), callback_data: "wallet_deposit" }],
      ],
    },
  });
}

// Step 3a: Binance deposit
export async function showDepositBinance(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const binanceId = settings.binance_id || "1178303416";
  const currency = settings.currency_symbol || "₹";
  const amountUsd = inrToUsd(amount);
  const paymentNote = generatePaymentNote();

  // Create payment record
  const { data: payment } = await supabase.from("payments").insert({
    user_id: userId.toString(),
    amount,
    amount_usd: amountUsd,
    note: paymentNote,
    status: "pending",
    payment_method: "binance",
    product_name: "Wallet Deposit",
    telegram_user_id: userId,
  }).select("id").single();

  await setConversationState(supabase, userId, "deposit_binance_pending", {
    amount, amountUsd, paymentNote, paymentId: payment?.id,
  });

  let text = `<b>💎 Binance ${lang === "bn" ? "ডিপোজিট" : "Deposit"}</b>\n\n`;
  text += `${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>${currency}${amount}</b> = <b>$${amountUsd}</b>\n\n`;
  text += `Binance Pay ID: <code>${binanceId}</code>\n`;
  text += `Payment Note: <code>${paymentNote}</code>\n\n`;
  text += `<b>${lang === "bn" ? "নির্দেশনা" : "Instructions"}:</b>\n`;
  text += `1. Open Binance App\n`;
  text += `2. Go to Pay > Send\n`;
  text += `3. Pay ID: <code>${binanceId}</code>\n`;
  text += `4. Amount: <b>$${amountUsd}</b>\n`;
  text += `5. Note: <code>${paymentNote}</code>\n`;
  text += `6. Complete & click Verify\n\n`;
  text += `<i>⚠️ Note must match exactly!</i>`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Verify Payment", callback_data: "deposit_binance_verify" }],
        [{ text: "❌ Cancel", callback_data: "deposit_cancel" }],
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
        [{ text: "⚡ Automatic (Razorpay)", callback_data: "deposit_upi_auto" }],
        [{ text: "📋 Manual (Screenshot)", callback_data: "deposit_upi_manual" }],
        [{ text: t("back", lang), callback_data: "deposit_choose_method" }],
      ],
    },
  });
}

// Step 3b-i: Auto UPI (Razorpay) deposit
export async function showDepositRazorpay(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const paymentNote = generatePaymentNote();
  const razorpayMeUrl = "https://razorpay.me/@asifikbalrubaiulislam";

  const { data: payment } = await supabase.from("payments").insert({
    user_id: userId.toString(),
    amount,
    note: paymentNote,
    status: "pending",
    payment_method: "razorpay_upi",
    product_name: "Wallet Deposit",
    telegram_user_id: userId,
  }).select("id").single();

  await setConversationState(supabase, userId, "deposit_razorpay_pending", {
    amount, paymentNote, paymentId: payment?.id,
  });

  let text = `<b>⚡ Auto UPI ${lang === "bn" ? "ডিপোজিট" : "Deposit"}</b>\n\n`;
  text += `${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>${currency}${amount}</b>\n\n`;
  text += `<b>${lang === "bn" ? "নির্দেশনা" : "Instructions"}:</b>\n`;
  text += `1. Click <b>Pay Now</b> below\n`;
  text += `2. Pay exactly <b>${currency}${amount}</b>\n`;
  text += `3. In note/description paste: <code>${paymentNote}</code>\n`;
  text += `4. Complete & click <b>Verify</b>\n\n`;
  text += `<i>⚠️ You MUST add the note for auto-verification.</i>`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Pay Now", url: razorpayMeUrl }],
        [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify" }],
        [{ text: "❌ Cancel", callback_data: "deposit_cancel" }],
      ],
    },
  });
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

// ===== VERIFY DEPOSIT =====

// Verify Binance deposit
export async function verifyDepositBinance(token: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string) {
  const { paymentNote, paymentId, amountUsd, amount } = stateData;
  await sendMessage(token, chatId, lang === "bn" ? "🔍 পেমেন্ট যাচাই করা হচ্ছে..." : "🔍 Verifying payment...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-binance-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ note: paymentNote, amount: amountUsd, paymentId }),
    });

    const result = await verifyRes.json();

    if (result.success) {
      await creditWallet(supabase, userId, amount, "binance", paymentNote);
      await deleteConversationState(supabase, userId);
      const wallet = await getWallet(supabase, userId);
      await sendMessage(token, chatId,
        `✅ <b>${lang === "bn" ? "পেমেন্ট সফল!" : "Payment Verified!"}</b>\n\n💰 ₹${amount} ${lang === "bn" ? "জমা হয়েছে" : "deposited"}\n💵 ${lang === "bn" ? "নতুন ব্যালেন্স" : "New Balance"}: <b>₹${wallet?.balance || 0}</b>`
      );
      await notifyAllAdmins(token, supabase,
        `💰 <b>Wallet Deposit (Binance Auto)</b>\n\n👤 User: <code>${userId}</code>\n💵 Amount: ₹${amount} ($${amountUsd})\n📝 Note: ${paymentNote}\n✅ Auto-verified`
      );
    } else {
      await sendMessage(token, chatId, `${result.message || "Payment not found."}\n\n${lang === "bn" ? "আবার চেষ্টা করুন।" : "Try again after completing payment."}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Verify Payment", callback_data: "deposit_binance_verify" }],
            [{ text: "❌ Cancel", callback_data: "deposit_cancel" }],
          ],
        },
      });
    }
  } catch (err) {
    console.error("Deposit binance verify error:", err);
    await sendMessage(token, chatId, "Verification error. Try again.", {
      reply_markup: { inline_keyboard: [[{ text: "✅ Verify", callback_data: "deposit_binance_verify" }]] },
    });
  }
}

// Verify Razorpay deposit
export async function verifyDepositRazorpay(token: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string) {
  const { paymentNote, paymentId, amount } = stateData;
  await sendMessage(token, chatId, lang === "bn" ? "🔍 পেমেন্ট যাচাই করা হচ্ছে..." : "🔍 Verifying payment...");

  try {
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      await sendMessage(token, chatId, "Payment verification not configured.");
      return;
    }

    const authHeader = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const fromTime = Math.floor(Date.now() / 1000) - 3600;
    const paymentsRes = await fetch(
      `https://api.razorpay.com/v1/payments?count=100&from=${fromTime}`,
      { headers: { "Authorization": `Basic ${authHeader}` } }
    );

    if (!paymentsRes.ok) {
      await sendMessage(token, chatId, "Verification error. Try again.", {
        reply_markup: { inline_keyboard: [[{ text: "✅ Verify", callback_data: "deposit_razorpay_verify" }]] },
      });
      return;
    }

    const paymentsData = await paymentsRes.json();
    const payments = paymentsData.items || [];
    const amountPaise = Math.round(amount * 100);

    const match = payments.find((p: any) => {
      const noteMatch =
        (p.notes && Object.values(p.notes).some((v: any) => String(v) === paymentNote)) ||
        (p.description && p.description.includes(paymentNote));
      return noteMatch && p.amount === amountPaise && (p.status === "captured" || p.status === "authorized");
    });

    if (match) {
      if (paymentId) await supabase.from("payments").update({ status: "success" }).eq("id", paymentId);
      await creditWallet(supabase, userId, amount, "razorpay_upi", paymentNote);
      await deleteConversationState(supabase, userId);
      const wallet = await getWallet(supabase, userId);
      await sendMessage(token, chatId,
        `✅ <b>${lang === "bn" ? "পেমেন্ট সফল!" : "Payment Verified!"}</b>\n\n💰 ₹${amount} ${lang === "bn" ? "জমা হয়েছে" : "deposited"}\n💵 ${lang === "bn" ? "নতুন ব্যালেন্স" : "New Balance"}: <b>₹${wallet?.balance || 0}</b>`
      );
      await notifyAllAdmins(token, supabase,
        `💰 <b>Wallet Deposit (Razorpay Auto)</b>\n\n👤 User: <code>${userId}</code>\n💵 Amount: ₹${amount}\n📝 Note: ${paymentNote}\n✅ Auto-verified`
      );
    } else {
      await sendMessage(token, chatId, `${lang === "bn" ? "পেমেন্ট পাওয়া যায়নি।" : "Payment not found yet."}\n\n${lang === "bn" ? "নিশ্চিত করুন" : "Make sure"}:\n1. Paid <b>₹${amount}</b>\n2. Note: <code>${paymentNote}</code>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Pay Now", url: "https://razorpay.me/@asifikbalrubaiulislam" }],
            [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify" }],
            [{ text: "❌ Cancel", callback_data: "deposit_cancel" }],
          ],
        },
      });
    }
  } catch (err) {
    console.error("Deposit razorpay verify error:", err);
    await sendMessage(token, chatId, "Verification error. Try again.", {
      reply_markup: { inline_keyboard: [[{ text: "✅ Verify", callback_data: "deposit_razorpay_verify" }]] },
    });
  }
}

// Handle deposit screenshot (manual UPI)
export async function handleDepositScreenshot(token: string, supabase: any, chatId: number, userId: number, msg: any, stateData: any, lang: string) {
  if (!msg.photo) {
    await sendMessage(token, chatId, lang === "bn" ? "📸 পেমেন্ট স্ক্রিনশট পাঠান (ছবি)।" : "📸 Please send the payment screenshot as a photo.");
    return;
  }

  const { amount } = stateData;
  const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";

  await deleteConversationState(supabase, userId);

  // Create a pending deposit order
  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    username,
    product_name: `Wallet Deposit ₹${amount}`,
    amount,
    status: "pending",
    screenshot_file_id: msg.photo[msg.photo.length - 1]?.file_id || null,
  }).select("id").single();

  const orderId = order?.id || "unknown";

  await sendMessage(token, chatId, lang === "bn"
    ? `✅ <b>স্ক্রিনশট পাঠানো হয়েছে!</b>\n\n💰 পরিমাণ: ₹${amount}\n⏳ অ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন।`
    : `✅ <b>Screenshot received!</b>\n\n💰 Amount: ₹${amount}\n⏳ Admin is verifying. You'll get an update soon.`
  );

  // Forward to admins
  const { forwardToAllAdmins } = await import("../db-helpers.ts");
  try { await forwardToAllAdmins(token, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward error:", e); }

  const adminMsg = `💰 <b>Wallet Deposit Request (Manual UPI)</b>\n\n` +
    `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
    `💵 Amount: <b>₹${amount}</b>\n` +
    `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdmins(token, supabase, adminMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `admin_confirm_${orderId}` },
              { text: "❌ Reject", callback_data: `admin_reject_${orderId}` },
            ],
            [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
          ],
        },
      });
      break;
    } catch (e) {
      console.error(`Admin notify attempt ${attempt + 1} failed:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ===== HELPER: Credit wallet =====
async function creditWallet(supabase: any, userId: number, amount: number, method: string, note: string) {
  const wallet = await ensureWallet(supabase, userId);
  const newBalance = (wallet?.balance || 0) + amount;
  const newEarned = (wallet?.total_earned || 0) + amount;

  await supabase.from("telegram_wallets").update({
    balance: newBalance,
    total_earned: newEarned,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId,
    type: "deposit",
    amount,
    description: `Deposit via ${method} (Note: ${note})`,
  });
}
