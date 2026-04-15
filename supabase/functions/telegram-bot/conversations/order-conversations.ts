// ===== ORDER & SCREENSHOT CONVERSATION HANDLERS =====

import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { getChildBotContext } from "../child-context.ts";
import {
  deleteConversationState, getUserLang,
  getWallet, notifyAllAdmins, forwardToAllAdmins, resendPhotoToAllAdmins,
} from "../db-helpers.ts";

export async function handleScreenshotStep(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  if (state.step !== "awaiting_screenshot") return false;

  if (!msg.photo) {
    const lang = (await getUserLang(supabase, userId)) || "en";
    await sendMessage(token, chatId, lang === "bn" ? "📸 অনুগ্রহ করে পেমেন্ট স্ক্রিনশট পাঠান (ছবি হিসেবে)।" : "📸 Please send the payment screenshot as a photo.");
    return true;
  }

  const orderData = state.data;
  const lang = (await getUserLang(supabase, userId)) || "en";
  const childBotId = orderData.childBotId;
  const username = childBotId ? `child_bot:${childBotId}` : (msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown");

  try { await deleteConversationState(supabase, userId); } catch (e) { console.error("deleteConversationState error:", e); }

  // Deduct wallet balance for partial payment
  const walletDeduction = orderData.walletDeduction || 0;
  if (walletDeduction > 0) {
    try {
      const wallet = await getWallet(supabase, userId);
      if (wallet && wallet.balance >= walletDeduction) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance - walletDeduction,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", userId);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: userId, type: "purchase_deduction",
          amount: -walletDeduction, description: `Partial wallet pay: ${orderData.productName}`,
        });
      }
    } catch (e) { console.error("Wallet deduction error:", e); }
  }

  // Create order
  let orderId = "unknown";
  try {
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId, username,
      product_name: orderData.productName, product_id: orderData.productId || null,
      amount: orderData.price, status: "pending",
      screenshot_file_id: msg.photo[msg.photo.length - 1]?.file_id || null,
      reseller_telegram_id: orderData.reseller_telegram_id || null,
      reseller_profit: orderData.reseller_profit || null,
    }).select("id").single();
    orderId = order?.id || "unknown";
  } catch (e) { console.error("Order insert error:", e); }

  // Notify user
  try {
    let userConfirmMsg = lang === "bn" ? "✅ <b>স্ক্রিনশট পাঠানো হয়েছে!</b>\n\n" : "✅ <b>Screenshot received!</b>\n\n";
    if (walletDeduction > 0) {
      userConfirmMsg += lang === "bn" ? `💳 ওয়ালেট থেকে ₹${walletDeduction} কাটা হয়েছে।\n` : `💳 ₹${walletDeduction} deducted from wallet.\n`;
    }
    userConfirmMsg += lang === "bn" ? "অ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন। ⏳" : "Admin is verifying your payment. You'll get an update soon. ⏳";
    await sendMessage(token, chatId, userConfirmMsg);
  } catch (e) { console.error("User confirm msg error:", e); }

  // Build admin message
  let adminMsg = `📩 <b>Payment Screenshot</b>\n\n👤 User: <b>${username}</b> (<code>${userId}</code>)\n📦 Product: <b>${orderData.productName}</b>\n💰 Total Price: <b>₹${orderData.price}</b>\n`;
  if (walletDeduction > 0) adminMsg += `💳 Wallet Deducted: <b>₹${walletDeduction}</b>\n`;
  adminMsg += `💵 UPI Paid: <b>₹${orderData.finalAmount || orderData.price}</b>\n🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  if (orderData.variationId) {
    try {
      const { data: varInfo } = await supabase.from("product_variations").select("name").eq("id", orderData.variationId).single();
      if (varInfo) adminMsg += `\n📋 Variation: <b>${varInfo.name}</b>`;
    } catch { /* ignore */ }
  }

  if (orderData.reseller_telegram_id) {
    adminMsg += `\n🔄 <b>Resale Order</b> — Reseller: <code>${orderData.reseller_telegram_id}</code>, Profit: ₹${orderData.reseller_profit}`;
  }

  const adminButtons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `admin_confirm_${orderId}` },
          { text: "❌ Reject", callback_data: `admin_reject_${orderId}` },
        ],
        [{ text: "📦 Shipped", callback_data: `admin_ship_${orderId}` }],
        [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
      ],
    },
  };

  // Use main bot token for admin notifications so callbacks route to main bot
  const childCtx = getChildBotContext();
  const mainToken = childCtx ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;

  // Forward screenshot to admins
  if (childCtx) {
    // Child bot: download photo and re-send via main bot
    const fileId = msg.photo[msg.photo.length - 1]?.file_id;
    if (fileId) {
      const photoCaption = `📸 <b>Payment Screenshot</b> (via Child Bot)\n👤 User: <code>${userId}</code>\n📦 ${orderData.productName}`;
      await resendPhotoToAllAdmins(token, mainToken, supabase, fileId, photoCaption);
    }
  } else {
    try { await forwardToAllAdmins(token, supabase, chatId, msg.message_id); } catch (e) {
      console.error("Forward screenshot error:", e);
    }
  }

  // Send admin buttons via MAIN bot so callbacks route correctly
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdmins(mainToken, supabase, adminMsg, adminButtons);
      console.log("Admin buttons sent successfully on attempt", attempt + 1);
      break;
    } catch (e) {
      console.error(`Admin notify attempt ${attempt + 1} failed:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }

  return true;
}
