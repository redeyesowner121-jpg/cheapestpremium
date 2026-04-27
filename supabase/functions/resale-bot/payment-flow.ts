// ===== Resale Bot - Payment info + wallet pay + screenshot =====

import { TELEGRAM_API, sendMessage } from "./telegram-api.ts";
import {
  ensureWallet, getWallet, setConversationState, deleteConversationState,
  notifyAllAdminsMainBot, forwardToAllAdminsMainBot, resendPhotoToAllAdminsMainBot,
} from "./db-helpers.ts";
import { UPI_ID, generatePayUrl, generateUpiQrUrl, generateFallbackQrUrl } from "./upi-helpers.ts";

// ===== SHOW PAYMENT INFO =====
export async function showPaymentInfo(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, price: number, productId: string, variationId: string | null, lang: string,
  resaleLinkData: { resale_link_id: string; reseller_telegram_id: number; reseller_profit: number }
) {
  const userId = telegramUser.id;
  const wallet = await ensureWallet(supabase, userId);
  const walletBalance = wallet?.balance || 0;
  const finalAmount = Math.max(0, price - walletBalance);
  const walletDeduction = Math.min(walletBalance, price);

  let text = `🛒 <b>${lang === "bn" ? "অর্ডার" : "Order"}: ${productName}</b>\n\n`;
  text += `💰 ${lang === "bn" ? "মূল্য" : "Price"}: <b>₹${price}</b>\n`;
  text += `💳 ${lang === "bn" ? "ওয়ালেট ব্যালেন্স" : "Wallet Balance"}: <b>₹${walletBalance}</b>\n`;
  if (walletDeduction > 0) {
    text += `🔻 ${lang === "bn" ? "ওয়ালেট কর্তন" : "Wallet Deduction"}: <b>-₹${walletDeduction}</b>\n`;
  }
  text += `\n💵 <b>${lang === "bn" ? "পরিশোধযোগ্য" : "Payable"}: ₹${finalAmount}</b>\n\n`;

  if (finalAmount === 0) {
    await setConversationState(supabase, userId, "resale_wallet_pay_confirm", {
      productName, price, productId, variationId, ...resaleLinkData,
    });
    text += lang === "bn"
      ? "💳 ওয়ালেট থেকে পেমেন্ট কনফার্ম করতে নীচের বাটনে ক্লিক করুন।"
      : "💳 Click the button below to confirm wallet payment.";
    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: lang === "bn" ? "💳 ওয়ালেট দিয়ে পে করুন" : "💳 Pay with Wallet", callback_data: "resale_walletpay_confirm" }]],
      },
    });
  } else {
    const upiIntentUrl = generatePayUrl(finalAmount);
    const escapedUpiIntentUrl = upiIntentUrl.replace(/&/g, "&amp;");

    text += `<b>💳 ${lang === "bn" ? "পেমেন্ট করুন" : "Make Payment"}:</b>\n\n`;
    text += `📱 UPI ID: <code>${UPI_ID}</code>\n`;
    text += `💵 ${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>₹${finalAmount}</b>\n`;
    text += `🔗 UPI: <code>${escapedUpiIntentUrl}</code>\n\n`;
    text += `🌐 ${lang === "bn" ? "ইন্টারন্যাশনাল/বাইন্যান্স পেমেন্টের জন্য" : "For International/Binance Payment"}:\n`;
    text += `🆔 Binance ID: <code>1178303416</code>\n\n`;
    text += `${lang === "bn" ? "QR স্ক্যান করুন বা UPI লিংক কপি করে পেমেন্ট করুন। তারপর পেমেন্ট স্ক্রিনশট পাঠান।" : "Scan QR or copy the UPI link to pay. Then send payment screenshot."}`;

    await setConversationState(supabase, userId, "resale_awaiting_screenshot", {
      productName, price, finalAmount, productId, variationId, walletDeduction, ...resaleLinkData,
    });

    let sent = false;
    for (const qrUrl of [generateUpiQrUrl(finalAmount), generateFallbackQrUrl(finalAmount)]) {
      try {
        const res = await fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: qrUrl, caption: text, parse_mode: "HTML" }),
        });
        const result = await res.json();
        if (result.ok) { sent = true; break; }
      } catch { /* try next */ }
    }

    if (!sent) {
      await sendMessage(token, chatId, text);
      await sendMessage(token, chatId, `📎 QR Link:\n${generateFallbackQrUrl(finalAmount)}`);
    }

    await sendMessage(token, chatId, `🔗 UPI Link:\n<code>${escapedUpiIntentUrl}</code>`);
    await sendMessage(token, chatId, lang === "bn"
      ? "📸 পেমেন্ট করার পর <b>স্ক্রিনশট</b> পাঠান।"
      : "📸 After payment, send the <b>screenshot</b>.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📖 How to Pay (Tutorial)", url: "https://t.me/Cheapest_premiums_Help/3" }],
        ],
      },
    });
  }
}

// ===== HANDLE WALLET PAY FOR RESALE =====
export async function handleResaleWalletPay(
  token: string, mainBotToken: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string
) {
  const { price, productName, productId, reseller_telegram_id, reseller_profit } = stateData;
  const wallet = await getWallet(supabase, userId);
  if (!wallet || wallet.balance < price) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ পর্যাপ্ত ব্যালেন্স নেই।" : "❌ Insufficient wallet balance.");
    return;
  }

  await supabase.from("telegram_wallets").update({ balance: wallet.balance - price, updated_at: new Date().toISOString() }).eq("telegram_id", userId);
  await supabase.from("telegram_wallet_transactions").insert({ telegram_id: userId, type: "purchase_deduction", amount: -price, description: `Resale Purchase: ${productName}` });

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId, username: "resale_wallet_pay", product_name: productName,
    product_id: productId || null, amount: price, status: "confirmed",
    reseller_telegram_id: reseller_telegram_id || null, reseller_profit: reseller_profit || null,
  }).select("id").single();

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>ওয়ালেট থেকে পেমেন্ট হয়েছে!</b>\n\n₹${price} ওয়ালেট থেকে কাটা হয়েছে।\n<b>${productName}</b> এর অর্ডার হয়েছে।\nঅ্যাডমিন শীঘ্রই ডেলিভারি করবে। ⚡`
      : `✅ <b>Paid from Wallet!</b>\n\n₹${price} deducted from your wallet.\nOrder placed for <b>${productName}</b>.\nAdmin will deliver shortly. ⚡`
  );

  if (productId) {
    const { data: product } = await supabase.from("products").select("access_link").eq("id", productId).single();
    if (product?.access_link) {
      await sendMessage(token, chatId,
        lang === "bn"
          ? `🔗 <b>আপনার প্রোডাক্ট লিংক:</b>\n\n${product.access_link}\n\n⚠️ এই লিংক শুধুমাত্র আপনার জন্য।`
          : `🔗 <b>Your Product Access Link:</b>\n\n${product.access_link}\n\n⚠️ This link is for you only. Do not share.`
      );
    }
  }

  await notifyAllAdminsMainBot(mainBotToken, supabase,
    `💰 <b>Resale Wallet Payment</b>\n\n👤 User: ${userId}\n📦 Product: ${productName}\n💵 Amount: ₹${price}\n🔄 Reseller: <code>${reseller_telegram_id}</code>\n💵 Reseller Profit: ₹${reseller_profit}\n✅ Auto-confirmed\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
  );

  if (reseller_telegram_id && reseller_profit > 0) {
    const resellerWallet = await getWallet(supabase, reseller_telegram_id);
    if (resellerWallet) {
      await supabase.from("telegram_wallets").update({
        balance: resellerWallet.balance + reseller_profit,
        total_earned: resellerWallet.total_earned + reseller_profit,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", reseller_telegram_id);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: reseller_telegram_id, type: "resale_profit", amount: reseller_profit,
        description: `Resale profit: ${productName}`,
      });

      try {
        await sendMessage(mainBotToken, reseller_telegram_id,
          `💰 <b>Resale Profit!</b>\n\n₹${reseller_profit} added to your wallet!\nProduct: ${productName}`
        );
      } catch { /* */ }
    }
  }

  await deleteConversationState(supabase, userId);
}

// ===== HANDLE SCREENSHOT FOR RESALE =====
export async function handleResaleScreenshot(
  token: string, mainBotToken: string, supabase: any, chatId: number, userId: number, msg: any, stateData: any, lang: string
) {
  const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || String(userId);
  const walletDeduction = stateData.walletDeduction || 0;

  if (walletDeduction > 0) {
    const wallet = await getWallet(supabase, userId);
    if (wallet && wallet.balance >= walletDeduction) {
      await supabase.from("telegram_wallets").update({ balance: wallet.balance - walletDeduction, updated_at: new Date().toISOString() }).eq("telegram_id", userId);
      await supabase.from("telegram_wallet_transactions").insert({ telegram_id: userId, type: "purchase_deduction", amount: -walletDeduction, description: `Partial wallet: ${stateData.productName}` });
    }
  }

  await deleteConversationState(supabase, userId);

  let orderId = "unknown";
  try {
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId, username, product_name: stateData.productName,
      product_id: stateData.productId || null, amount: stateData.price, status: "pending",
      screenshot_file_id: msg.photo?.[msg.photo.length - 1]?.file_id || null,
      reseller_telegram_id: stateData.reseller_telegram_id || null,
      reseller_profit: stateData.reseller_profit || null,
    }).select("id").single();
    orderId = order?.id || "unknown";
  } catch (e) { console.error("Order insert error:", e); }

  let userMsg = lang === "bn" ? "✅ <b>স্ক্রিনশট পাঠানো হয়েছে!</b>\n\n" : "✅ <b>Screenshot received!</b>\n\n";
  if (walletDeduction > 0) {
    userMsg += lang === "bn" ? `💳 ওয়ালেট থেকে ₹${walletDeduction} কাটা হয়েছে।\n` : `💳 ₹${walletDeduction} deducted from wallet.\n`;
  }
  userMsg += lang === "bn" ? "অ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন। ⏳" : "Admin is verifying your payment. You'll get an update soon. ⏳";
  await sendMessage(token, chatId, userMsg);

  let adminMsg = `📩 <b>Resale Payment Screenshot</b>\n\n` +
    `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
    `📦 Product: <b>${stateData.productName}</b>\n` +
    `💰 Total Price: <b>₹${stateData.price}</b>\n`;
  if (walletDeduction > 0) adminMsg += `💳 Wallet Deducted: <b>₹${walletDeduction}</b>\n`;
  adminMsg += `💵 UPI Paid: <b>₹${stateData.finalAmount || stateData.price}</b>\n`;
  adminMsg += `🔄 <b>Resale Order</b> — Reseller: <code>${stateData.reseller_telegram_id}</code>, Profit: ₹${stateData.reseller_profit}\n`;
  adminMsg += `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  const adminButtons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `admin_confirm_${orderId}`, style: "success" },
          { text: "❌ Reject", callback_data: `admin_reject_${orderId}`, style: "danger" },
        ],
        [{ text: "📦 Shipped", callback_data: `admin_ship_${orderId}`, style: "primary" }],
        [{ text: "💬 Chat", callback_data: `admin_chat_${userId}`, style: "primary" }],
      ],
    },
  };

  const fileId = msg.photo?.[msg.photo.length - 1]?.file_id;
  if (fileId) {
    try {
      const photoCaption = `📸 <b>Resale Payment Screenshot</b>\n👤 User: <code>${userId}</code>\n📦 ${stateData.productName}`;
      await resendPhotoToAllAdminsMainBot(token, mainBotToken, supabase, fileId, photoCaption);
    } catch (e) { console.error("Resend screenshot error:", e); }
  } else {
    try { await forwardToAllAdminsMainBot(mainBotToken, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward error:", e); }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdminsMainBot(mainBotToken, supabase, adminMsg, adminButtons);
      break;
    } catch (e) {
      console.error(`Admin notify attempt ${attempt + 1} failed:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
}
