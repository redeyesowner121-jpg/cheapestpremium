// ===== PAYMENT & BUY HANDLERS =====

import { t, UPI_ID, UPI_NAME } from "./constants.ts";
import { sendMessage, getTelegramApiUrl } from "./telegram-api.ts";
import { getSettings, ensureWallet, getWallet, setConversationState, notifyAllAdmins, getAllAdminIds } from "./db-helpers.ts";

// ===== UPI HELPERS =====

function generateUpiLink(amount: number, productName: string): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&mc=0000&mode=02&purpose=00&am=${amount}&cu=INR&tn=${encodeURIComponent(productName.substring(0, 50))}`;
}

function generateUpiQrUrl(amount: number, productName: string): string {
  const upiString = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&mc=0000&mode=02&purpose=00&am=${amount}&cu=INR&tn=${encodeURIComponent(productName.substring(0, 50))}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiString)}`;
}

// ===== BUY PRODUCT =====

export async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any, lang: string) {
  const { data: product } = await supabase.from("products").select("name, price, stock, id").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  await showPaymentInfo(token, supabase, chatId, telegramUser, product.name, product.price, product.id, null, lang);
}

// ===== BUY VARIATION =====

export async function handleBuyVariation(token: string, supabase: any, chatId: number, variationId: string, telegramUser: any, lang: string) {
  console.log("handleBuyVariation called with variationId:", variationId);

  const { data: variation, error: varError } = await supabase
    .from("product_variations")
    .select("id, name, price, reseller_price, product_id")
    .eq("id", variationId)
    .single();

  console.log("Variation query result:", JSON.stringify(variation), "Error:", JSON.stringify(varError));

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

// ===== PAYMENT INFO WITH WALLET =====

export async function showPaymentInfo(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, price: number, productId: string, variationId: string | null, lang: string
) {
  console.log("showPaymentInfo called:", { productName, price, productId, variationId });

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
    // Full wallet pay - show confirm button directly
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
    // Generate dynamic UPI link
    const upiLink = generateUpiLink(finalAmount, productName);
    const qrUrl = generateUpiQrUrl(finalAmount, productName);

    console.log("Generated UPI link:", upiLink);
    console.log("Generated QR URL:", qrUrl);

    text += `<b>💳 ${lang === "bn" ? "পেমেন্ট করুন" : "Make Payment"}:</b>\n\n`;
    text += `📱 UPI ID: <code>${UPI_ID}</code>\n`;
    text += `💵 ${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>${currency}${finalAmount}</b>\n\n`;
    text += `🌐 ${lang === "bn" ? "ইন্টারন্যাশনাল/বাইন্যান্স পেমেন্টের জন্য" : "For International/Binance Payment"}:\n`;
    text += `🆔 Binance ID: <code>1178303416</code>\n\n`;
    text += `${lang === "bn" ? "নীচের বাটনে ক্লিক করে পেমেন্ট করুন। তারপর পেমেন্ট স্ক্রিনশট পাঠান।" : "Click the button below to pay. Then send payment screenshot."}`;

    buttons.push([{ text: `💳 ${lang === "bn" ? "পেমেন্ট লিংক" : "Payment Link"}`, url: qrUrl }]);

    await setConversationState(supabase, userId, "awaiting_screenshot", {
      productName, price, finalAmount, productId, variationId, walletDeduction,
    });

    // Try sending QR code image
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
      console.log("sendPhoto result:", JSON.stringify(photoResult));

      if (!photoResult.ok) {
        console.log("sendPhoto failed, falling back to text message");
        await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
      }
    } catch (e) {
      console.error("sendPhoto error:", e);
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }

    // Ask for screenshot directly
    await sendMessage(token, chatId, lang === "bn"
      ? "📸 পেমেন্ট করার পর <b>স্ক্রিনশট</b> পাঠান।"
      : "📸 After payment, send the <b>screenshot</b>.");
    return;
  }

  buttons.push([{ text: t("back_products", lang), callback_data: "back_products" }]);
  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== WALLET PAY =====

export async function handleWalletPay(token: string, supabase: any, chatId: number, userId: number, amount: number, productName: string, lang: string, productId?: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet || wallet.balance < amount) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ পর্যাপ্ত ব্যালেন্স নেই।" : "❌ Insufficient wallet balance.");
    return;
  }

  // Deduct wallet
  await supabase.from("telegram_wallets").update({
    balance: wallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  // Record transaction
  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId,
    type: "purchase_deduction",
    amount: -amount,
    description: `Purchase: ${productName}`,
  });

  // Create order
  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    username: `wallet_pay`,
    product_name: productName,
    product_id: productId || null,
    amount: amount,
    status: "confirmed",
  }).select("id").single();

  // Notify user
  await sendMessage(token, chatId,
    t("wallet_paid", lang).replace("{amount}", String(amount)).replace("{product}", productName)
  );

  // Auto-send access_link for wallet pay (auto-confirmed)
  if (productId) {
    const { data: product } = await supabase.from("products").select("access_link").eq("id", productId).single();
    if (product?.access_link) {
      await sendMessage(token, chatId,
        lang === "bn"
          ? `🔗 <b>আপনার প্রোডাক্ট লিংক:</b>\n\n${product.access_link}\n\n⚠️ এই লিংক শুধুমাত্র আপনার জন্য। শেয়ার করবেন না।`
          : `🔗 <b>Your Product Access Link:</b>\n\n${product.access_link}\n\n⚠️ This link is for you only. Do not share.`
      );
    }
  }

  // Notify all admins
  await notifyAllAdmins(token, supabase,
    `💰 <b>Wallet Payment</b>\n\n👤 User: ${userId}\n📦 Product: ${productName}\n💵 Amount: ₹${amount}\n✅ Auto-confirmed (wallet pay)\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
  );

  // Check referral bonus
  await processReferralBonus(supabase, userId, token);
}

// ===== REFERRAL BONUS =====

export async function processReferralBonus(supabase: any, userId: number, token: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet?.referred_by) return;

  const { count } = await supabase
    .from("telegram_orders")
    .select("*", { count: "exact", head: true })
    .eq("telegram_user_id", userId)
    .eq("status", "confirmed");

  if (count === 1) {
    const settings = await getSettings(supabase);
    const bonus = parseFloat(settings.referral_bonus) || 10;

    const referrerWallet = await getWallet(supabase, wallet.referred_by);
    if (referrerWallet) {
      await supabase.from("telegram_wallets").update({
        balance: referrerWallet.balance + bonus,
        total_earned: referrerWallet.total_earned + bonus,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", wallet.referred_by);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: wallet.referred_by,
        type: "referral_bonus",
        amount: bonus,
        description: `Referral bonus for user ${userId}`,
      });

      await sendMessage(token, wallet.referred_by,
        `🎉 <b>Referral Bonus!</b>\n\n₹${bonus} added to your wallet! Your referred user made their first purchase.`
      );
    }
  }
}

// ===== ADMIN ACTION =====

export async function handleAdminAction(token: string, supabase: any, orderId: string, newStatus: string, adminChatId: number) {
  const { getUserLang } = await import("./db-helpers.ts");

  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";

  await supabase.from("telegram_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);

  const msgKey: Record<string, string> = { confirmed: "order_confirmed", rejected: "order_rejected", shipped: "order_shipped" };
  await sendMessage(token, order.telegram_user_id, t(msgKey[newStatus] || "order_confirmed", userLang));

  // If rejected, refund any wallet deduction
  if (newStatus === "rejected") {
    const { data: deductions } = await supabase.from("telegram_wallet_transactions")
      .select("*")
      .eq("telegram_id", order.telegram_user_id)
      .eq("type", "purchase_deduction")
      .ilike("description", `%${order.product_name}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (deductions?.length && deductions[0].amount < 0) {
      const refundAmount = Math.abs(deductions[0].amount);
      const wallet = await getWallet(supabase, order.telegram_user_id);
      if (wallet) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance + refundAmount,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.telegram_user_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.telegram_user_id,
          type: "refund",
          amount: refundAmount,
          description: `Refund: ${order.product_name} (rejected)`,
        });

        await sendMessage(token, order.telegram_user_id,
          userLang === "bn"
            ? `💰 ₹${refundAmount} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`
            : `💰 ₹${refundAmount} refunded to your wallet.`
        );
      }
    }
  }

  // If confirmed, process referral, reseller profit, and auto-send access_link
  if (newStatus === "confirmed") {
    await processReferralBonus(supabase, order.telegram_user_id, token);

    // Auto-send access_link
    if (order.product_id) {
      const { data: product } = await supabase.from("products").select("access_link").eq("id", order.product_id).single();
      if (product?.access_link) {
        await sendMessage(token, order.telegram_user_id,
          userLang === "bn"
            ? `🔗 <b>আপনার প্রোডাক্ট লিংক:</b>\n\n${product.access_link}\n\n⚠️ এই লিংক শুধুমাত্র আপনার জন্য। শেয়ার করবেন না।`
            : `🔗 <b>Your Product Access Link:</b>\n\n${product.access_link}\n\n⚠️ This link is for you only. Do not share.`
        );
      }
    }

    if (order.reseller_telegram_id && order.reseller_profit > 0) {
      const resellerWallet = await getWallet(supabase, order.reseller_telegram_id);
      if (resellerWallet) {
        await supabase.from("telegram_wallets").update({
          balance: resellerWallet.balance + order.reseller_profit,
          total_earned: resellerWallet.total_earned + order.reseller_profit,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.reseller_telegram_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.reseller_telegram_id,
          type: "resale_profit",
          amount: order.reseller_profit,
          description: `Resale profit: ${order.product_name}`,
        });

        try {
          await sendMessage(token, order.reseller_telegram_id,
            `💰 <b>Resale Profit!</b>\n\n₹${order.reseller_profit} added to your wallet!\nProduct: ${order.product_name}`
          );
        } catch { /* reseller may have blocked bot */ }
      }
    }
  }

  const emoji: Record<string, string> = { confirmed: "✅", rejected: "❌", shipped: "📦" };
  const statusLabel: Record<string, string> = { confirmed: "CONFIRMED", rejected: "REJECTED", shipped: "SHIPPED" };
  await sendMessage(token, adminChatId, `${emoji[newStatus] || "📋"} Order <b>${orderId.slice(0, 8)}</b> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>`);

  // Notify other admins that this admin handled the order
  const allAdminIds = await getAllAdminIds(supabase);
  const otherAdmins = allAdminIds.filter(id => id !== adminChatId);
  for (const otherAdmin of otherAdmins) {
    try {
      await sendMessage(token, otherAdmin,
        `📋 <b>Order Handled by Another Admin</b>\n\n` +
        `${emoji[newStatus] || "📋"} Order <code>${orderId.slice(0, 8)}</code> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>\n` +
        `📦 Product: <b>${order.product_name || "N/A"}</b>\n` +
        `👤 Customer: <code>${order.telegram_user_id}</code>\n` +
        `🛡️ Handled by Admin: <code>${adminChatId}</code>`
      );
    } catch { /* admin may have blocked bot */ }
  }
}

// ===== START WITH REF =====

export async function handleStartWithRef(supabase: any, userId: number, refCode: string) {
  const { ensureWallet: ensure } = await import("./db-helpers.ts");
  const wallet = await ensure(supabase, userId);
  if (wallet?.referred_by) return;

  const { data: referrer } = await supabase.from("telegram_wallets").select("telegram_id").eq("referral_code", refCode).single();
  if (referrer && referrer.telegram_id !== userId) {
    await supabase.from("telegram_wallets").update({ referred_by: referrer.telegram_id }).eq("telegram_id", userId);
  }
}
