// ===== WALLET DEPOSIT HANDLERS =====

import { t } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet, setConversationState, deleteConversationState, notifyAllAdmins } from "../db-helpers.ts";
import { logProof, formatDepositSuccess } from "../proof-logger.ts";
import { generatePayUrl, generateUpiQrUrl, generateFallbackQrUrl, inrToUsd } from "./payment-utils.ts";

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
          { text: "💎 Binance", callback_data: "deposit_method_binance", style: "primary" },
          { text: "📱 UPI", callback_data: "deposit_method_upi", style: "success" },
        ],
        [{ text: "📖 How to Pay (Tutorial)", url: "https://t.me/Cheapest_premiums_Help/3" }],
        [{ text: t("back", lang), callback_data: "my_wallet" }],
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
          { text: "₹100", callback_data: "deposit_amt_100", style: "primary" },
          { text: "₹200", callback_data: "deposit_amt_200", style: "primary" },
          { text: "₹500", callback_data: "deposit_amt_500", style: "primary" },
        ],
        [
          { text: "₹1000", callback_data: "deposit_amt_1000", style: "success" },
          { text: "₹2000", callback_data: "deposit_amt_2000", style: "success" },
          { text: "₹5000", callback_data: "deposit_amt_5000", style: "success" },
        ],
        [{ text: t("back", lang), callback_data: "wallet_deposit", style: "secondary" }],
      ],
    },
  });
}

// Legacy wrapper — now routes based on method stored in conversation state
export async function showDepositMethodChoice(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const { getConversationState } = await import("../db-helpers.ts");
  const convState = await getConversationState(supabase, userId);
  const method = convState?.data?.method;
  if (method === "binance") {
    await showDepositBinance(token, supabase, chatId, userId, amount, lang);
  } else if (method === "upi") {
    await showDepositUpi(token, supabase, chatId, userId, amount, lang);
  } else {
    // Fallback: if no method in state, show UPI sub-choice
    await showDepositUpi(token, supabase, chatId, userId, amount, lang);
  }
}

// Step 3a: Binance deposit — 20 min reservation, order ID verification
export async function showDepositBinance(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const binanceId = settings.binance_id || "1178303416";
  const currency = settings.currency_symbol || "₹";
  const amountUsd = inrToUsd(amount);

  // Check if this USD amount is already reserved by another user (active, not expired)
  const { data: existingReservation } = await supabase
    .from("binance_amount_reservations")
    .select("id, user_id")
    .eq("amount_usd", amountUsd)
    .eq("status", "reserved")
    .gt("expires_at", new Date().toISOString())
    .neq("user_id", userId.toString())
    .maybeSingle();

  if (existingReservation) {
    await sendMessage(token, chatId,
      `⚠️ <b>$${amountUsd} (₹${amount}) is currently reserved by another user.</b>\n\nPlease type another amount.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 Type another amount", callback_data: "wallet_deposit", style: "primary" }],
            [{ text: "Main Menu", callback_data: "back_main", style: "secondary" }],
          ],
        },
      }
    );
    return;
  }

  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

  // Create payment record
  const { data: payment } = await supabase.from("payments").insert({
    user_id: userId.toString(),
    amount,
    amount_usd: amountUsd,
    note: "BINANCE_ORDER_ID_PENDING",
    status: "pending",
    payment_method: "binance",
    product_name: "Wallet Deposit",
    telegram_user_id: userId,
  }).select("id").single();

  // Reserve the USD amount for 20 minutes
  const { data: reservation } = await supabase.from("binance_amount_reservations").insert({
    user_id: userId.toString(),
    amount_usd: amountUsd,
    amount_inr: amount,
    payment_id: payment?.id,
    status: "reserved",
    expires_at: expiresAt,
  }).select("id").single();

  await setConversationState(supabase, userId, "deposit_binance_awaiting_order_id", {
    amount, amountUsd, paymentId: payment?.id, expiresAt,
    reservationId: reservation?.id,
  });

  let text = `<b>💎 Binance Deposit</b>\n\n`;
  text += `Amount: <b>${currency}${amount}</b> = <b>$${amountUsd}</b>\n\n`;
  text += `Binance Pay ID: <code>${binanceId}</code>\n\n`;
  text += `<b>Instructions:</b>\n`;
  text += `1. Open Binance App\n`;
  text += `2. Go to Pay > Send\n`;
  text += `3. Pay ID: <code>${binanceId}</code>\n`;
  text += `4. Amount: <b>$${amountUsd}</b>\n`;
  text += `5. Complete payment\n`;
  text += `6. <b>Send your Binance Order ID here</b>\n\n`;
  text += `<i>After paying, copy the Order ID from Binance and send it as a message.</i>\n`;
  text += `<i>⏰ Pay within 20 minutes</i>`;

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
        [{ text: t("back", lang), callback_data: "deposit_choose_method" }],
      ],
    },
  });
}

// Step 3b-i: Auto UPI (Razorpay) deposit — uses reservation system with 2% + ₹0.10-0.50 charge
export async function showDepositRazorpay(token: string, supabase: any, chatId: number, userId: number, amount: number, lang: string) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const razorpayMeUrl = settings.payment_link || "https://razorpay.me/@asifikbalrubaiulislam";

  // Call reserve-razorpay-amount edge function to get unique amount with 2% + ₹0.10-0.50
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

  // Try to send with QR photo
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
              [{ text: "💳 Pay Now", url: razorpayMeUrl }],
              [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify", style: "success" }],
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
          [{ text: "💳 Pay Now", url: razorpayMeUrl }],
          [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify", style: "success" }],
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

// ===== VERIFY DEPOSIT =====

// Verify Binance deposit with Order ID
export async function verifyDepositBinanceWithOrderId(token: string, supabase: any, chatId: number, userId: number, stateData: any, binanceOrderId: string, lang: string) {
  const { paymentId, amountUsd, amount, expiresAt, reservationId } = stateData;

  // Check 20 min expiry
  if (expiresAt && new Date(expiresAt) < new Date()) {
    await deleteConversationState(supabase, userId);
    await supabase.from("payments").update({ status: "expired" }).eq("id", paymentId);
    if (reservationId) {
      await supabase.from("binance_amount_reservations").update({ status: "expired" }).eq("id", reservationId);
    }
    await sendMessage(token, chatId,
      "⏰ <b>Time expired!</b> Payment was not completed within 20 minutes.\n\nStart a new deposit.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 Type another amount", callback_data: "wallet_deposit", style: "primary" }],
            [{ text: "Main Menu", callback_data: "back_main", style: "secondary" }],
          ],
        },
      }
    );
    return;
  }

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
      // Clear reservation from DB on success
      if (reservationId) {
        await supabase.from("binance_amount_reservations").update({ status: "completed" }).eq("id", reservationId);
      }
      await creditWallet(supabase, userId, amount, "binance", binanceOrderId);
      await deleteConversationState(supabase, userId);
      const wallet = await getWallet(supabase, userId);
      await sendMessage(token, chatId,
        `✅ <b>Payment Verified!</b>\n\n💰 ₹${amount} deposited\n💵 New Balance: <b>₹${wallet?.balance || 0}</b>`
      );
      await notifyAllAdmins(token, supabase,
        `💰 <b>Wallet Deposit (Binance Auto)</b>\n\n👤 User: <code>${userId}</code>\n💵 Amount: ₹${amount} ($${amountUsd})\n🆔 Order ID: ${binanceOrderId}\n✅ Auto-verified`
      );
      let dName = "User"; try { const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", userId).single(); if (bu?.first_name) dName = bu.first_name; } catch {}
      try { await logProof(token, formatDepositSuccess(userId, amount, "Binance Auto", dName)); } catch {}
    } else {
      const remaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000)) : "?";
      let retryMsg = `${result.message || "Payment not found."}\n\n`;
      retryMsg += `⏰ ${remaining} min remaining\n\n`;
      retryMsg += `📤 Send your Binance Order ID again to retry.`;
      await sendMessage(token, chatId, retryMsg, {
        reply_markup: {
          inline_keyboard: [
             [{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }],
          ],
        },
      });
    }
  } catch (err) {
    console.error("Deposit binance verify error:", err);
    await sendMessage(token, chatId, "Verification error. Send your Order ID again to retry.", {
      reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }]] },
    });
  }
}

// Legacy verify function for backward compat (old deposit_binance_pending state)
export async function verifyDepositBinance(token: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string) {
  // Old flow had paymentNote — redirect to ask for order ID
  await setConversationState(supabase, userId, "deposit_binance_awaiting_order_id", stateData);
  await sendMessage(token, chatId, "📤 Please send your <b>Binance Order ID</b> as a message to verify payment.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }],
      ],
    },
  });
}

// Verify Razorpay deposit — uses reservation system
export async function verifyDepositRazorpay(token: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string) {
  const { payClickedAt, amount, uniqueAmount, reservationId, depositRequestId } = stateData;
  const verifyAmount = uniqueAmount || amount;

  // Check reservation expiry
  if (reservationId) {
    const { data: reservation } = await supabase
      .from("razorpay_amount_reservations")
      .select("status, expires_at")
      .eq("id", reservationId)
      .single();

    if (reservation?.status === "completed") {
      await deleteConversationState(supabase, userId);
      await sendMessage(token, chatId, "✅ Payment already processed.");
      return;
    }
    if (reservation && new Date(reservation.expires_at) < new Date()) {
      await supabase.from("razorpay_amount_reservations").update({ status: "expired" }).eq("id", reservationId);
      await deleteConversationState(supabase, userId);
      await sendMessage(token, chatId,
        lang === "bn"
          ? "⏰ <b>সময় শেষ!</b> ১০ মিনিটের মধ্যে পেমেন্ট হয়নি।\n\nনতুন ডিপোজিট শুরু করুন।"
          : "⏰ <b>Time expired!</b> Payment was not completed within 10 minutes.\n\nStart a new deposit.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "bn" ? "💰 নতুন অ্যামাউন্ট দিন" : "💰 Type another amount", callback_data: "wallet_deposit", style: "primary" }],
              [{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main", style: "secondary" }],
            ],
          },
        }
      );
      return;
    }
  }

  await sendMessage(token, chatId, lang === "bn" ? "🔍 পেমেন্ট যাচাই করা হচ্ছে..." : "🔍 Verifying payment...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-razorpay-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ amount: verifyAmount, reservationId, depositRequestId, payClickedAt }),
    });

    const result = await verifyRes.json();

    if (result.success) {
      const baseAmount = Math.floor(verifyAmount);
      await creditWallet(supabase, userId, baseAmount, "razorpay_upi", `auto-verified`);
      await deleteConversationState(supabase, userId);
      const wallet = await getWallet(supabase, userId);
      await sendMessage(token, chatId,
        `✅ <b>${lang === "bn" ? "পেমেন্ট সফল!" : "Payment Verified!"}</b>\n\n💰 ₹${baseAmount} ${lang === "bn" ? "জমা হয়েছে" : "deposited"}\n💵 ${lang === "bn" ? "নতুন ব্যালেন্স" : "New Balance"}: <b>₹${wallet?.balance || 0}</b>`
      );
      await notifyAllAdmins(token, supabase,
        `💰 <b>Wallet Deposit (Razorpay Auto)</b>\n\n👤 User: <code>${userId}</code>\n💵 Amount: ₹${baseAmount} (paid ₹${verifyAmount})\n✅ Auto-verified`
      );
      let rName = "User"; try { const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", userId).single(); if (bu?.first_name) rName = bu.first_name; } catch {}
      try { await logProof(token, formatDepositSuccess(userId, baseAmount, "Razorpay Auto", rName)); } catch {}
    } else {
      const settingsForLink = await getSettings(supabase);
      const razorpayMeUrl = settingsForLink.payment_link || "https://razorpay.me/@asifikbalrubaiulislam";
      await sendMessage(token, chatId, `${result.message || (lang === "bn" ? "পেমেন্ট পাওয়া যায়নি।" : "Payment not found yet.")}\n\n${lang === "bn" ? "নিশ্চিত করুন যে ঠিক" : "Make sure you paid exactly"} <b>₹${verifyAmount}</b>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Pay Now", url: razorpayMeUrl }],
            [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify", style: "success" }],
            [{ text: "❌ Cancel", callback_data: "deposit_cancel", style: "danger" }],
          ],
        },
      });
    }
  } catch (err) {
    console.error("Deposit razorpay verify error:", err);
    await sendMessage(token, chatId, "Verification error. Try again.", {
      reply_markup: { inline_keyboard: [[{ text: "✅ Verify", callback_data: "deposit_razorpay_verify", style: "success" }]] },
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

  // Forward to admins — handle child bot properly
  const { forwardToAllAdmins, resendPhotoToAllAdmins } = await import("../db-helpers.ts");
  const { getChildBotContext } = await import("../child-context.ts");
  const childCtx = getChildBotContext();
  const mainToken = childCtx ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;

  if (childCtx) {
    const fileId = msg.photo[msg.photo.length - 1]?.file_id;
    if (fileId) {
      await resendPhotoToAllAdmins(token, mainToken, supabase, fileId,
        `💰 <b>Deposit Screenshot</b> (via Child Bot)\n👤 User: <code>${userId}</code>\n💵 Amount: ₹${amount}`
      );
    }
  } else {
    try { await forwardToAllAdmins(token, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward error:", e); }
  }

  const adminMsg = `💰 <b>Wallet Deposit Request (Manual UPI)</b>\n\n` +
    `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
    `💵 Amount: <b>₹${amount}</b>\n` +
    `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdmins(mainToken, supabase, adminMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `admin_confirm_${orderId}`, style: "success" },
              { text: "❌ Reject", callback_data: `admin_reject_${orderId}`, style: "danger" },
            ],
            [{ text: "💬 Chat", callback_data: `admin_chat_${userId}`, style: "primary" }],
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

  // Sync to website profile
  const { syncDepositToProfile } = await import("./sync-helpers.ts");
  await syncDepositToProfile(supabase, userId, amount, method);
}
