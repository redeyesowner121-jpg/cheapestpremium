// ===== BINANCE SCREENSHOT HANDLER (Purchase flow - Manual) =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState, deleteConversationState, notifyAllAdmins, forwardToAllAdmins, resendPhotoToAllAdmins } from "../db-helpers.ts";
import { logProof, formatOrderPlaced } from "../proof-logger.ts";
import { getChildBotContext } from "../child-context.ts";

export async function handleBinanceScreenshot(
  token: string, supabase: any, chatId: number, userId: number, msg: any, stateData: any
) {
  if (!msg.photo) {
    await sendMessage(token, chatId, "📸 Please send the payment screenshot as a photo.");
    return;
  }

  const { productName, price, finalAmount, productId, variationId, walletDeduction, amountUsd, quantity = 1, unitPrice, childBotId, childBotRevenue } = stateData;
  const isChildBot = !!childBotId;
  const username = isChildBot ? `child_bot:${childBotId}` : (msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown");

  await deleteConversationState(supabase, userId);

  // Deduct wallet balance for partial payment
  if (walletDeduction > 0) {
    try {
      const { ensureWallet } = await import("../db-helpers.ts");
      await ensureWallet(supabase, userId);
      const { data: wallet } = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", userId).single();
      if (wallet && wallet.balance >= walletDeduction) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance - walletDeduction,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", userId);
        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: userId, type: "purchase_deduction",
          amount: -walletDeduction, description: `Partial wallet pay: ${productName}`,
        });
      }
    } catch (e) { console.error("Wallet deduction error:", e); }
  }

  // Create order
  let orderId = "unknown";
  try {
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId, username,
      product_name: productName, product_id: productId || null,
      amount: price, status: "pending",
      screenshot_file_id: msg.photo[msg.photo.length - 1]?.file_id || null,
    }).select("id").single();
    orderId = order?.id || "unknown";
  } catch (e) { console.error("Order insert error:", e); }

  // Notify user
  let userMsg = `✅ <b>Screenshot received!</b>\n\n`;
  userMsg += `📦 Product: <b>${productName}</b>\n`;
  userMsg += `💵 Amount: <b>₹${finalAmount}</b> ($${amountUsd})\n`;
  if (walletDeduction > 0) userMsg += `💳 Wallet deducted: ₹${walletDeduction}\n`;
  userMsg += `\n⏳ Admin is verifying your payment. You'll get an update soon.`;
  await sendMessage(token, chatId, userMsg);

  // Build admin message
  let adminMsg = `💎 <b>Binance Payment Screenshot</b>${isChildBot ? " (Child Bot)" : ""}\n\n`;
  adminMsg += `👤 User: <b>${username}</b> (<code>${userId}</code>)\n`;
  adminMsg += `📦 Product: <b>${productName}</b>\n`;
  adminMsg += `🔢 Quantity: <b>${quantity}</b>\n`;
  adminMsg += `💲 Unit Price: <b>₹${unitPrice || price}</b>\n`;
  adminMsg += `💰 Total: <b>₹${price}</b>\n`;
  adminMsg += `💵 Binance Amount: <b>$${amountUsd}</b>\n`;
  if (walletDeduction > 0) adminMsg += `💳 Wallet Deducted: <b>₹${walletDeduction}</b>\n`;
  adminMsg += `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  if (isChildBot) {
    adminMsg += `\n🤖 Child Bot: <code>${childBotId}</code>`;
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

  // Use main bot token for admin notifications
  const childCtx = getChildBotContext();
  const mainToken = childCtx ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;

  // Forward screenshot to admins
  if (childCtx) {
    const fileId = msg.photo[msg.photo.length - 1]?.file_id;
    if (fileId) {
      await resendPhotoToAllAdmins(token, mainToken, supabase, fileId,
        `💎 <b>Binance Payment Screenshot</b> (via Child Bot)\n👤 User: <code>${userId}</code>\n📦 ${productName}`
      );
    }
  } else {
    try { await forwardToAllAdmins(token, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward error:", e); }
  }

  // Send admin buttons
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdmins(mainToken, supabase, adminMsg, adminButtons);
      break;
    } catch (e) {
      console.error(`Admin notify attempt ${attempt + 1} failed:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
}
