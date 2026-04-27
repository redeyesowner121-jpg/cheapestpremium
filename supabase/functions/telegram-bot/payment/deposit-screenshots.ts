// ===== Deposit screenshot handlers (Binance manual + UPI manual) =====

import { sendMessage } from "../telegram-api.ts";
import { deleteConversationState, notifyAllAdmins } from "../db-helpers.ts";

export async function handleDepositBinanceScreenshot(token: string, supabase: any, chatId: number, userId: number, msg: any, stateData: any) {
  if (!msg.photo) {
    await sendMessage(token, chatId, "📸 Please send the payment screenshot as a photo.");
    return;
  }

  const { amount } = stateData;
  const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";

  await deleteConversationState(supabase, userId);

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    username,
    product_name: amount ? `Wallet Deposit ₹${amount} (Binance)` : `Wallet Deposit (Binance)`,
    amount: amount || 0,
    status: "pending",
    screenshot_file_id: msg.photo[msg.photo.length - 1]?.file_id || null,
  }).select("id").single();

  const orderId = order?.id || "unknown";

  await sendMessage(token, chatId,
    `✅ <b>Screenshot received!</b>\n\n💰 Amount: ${amount ? `₹${amount}` : "Pending verification"}\n⏳ Admin is verifying your Binance payment. You'll get an update soon.`
  );

  const { forwardToAllAdmins, resendPhotoToAllAdmins } = await import("../db-helpers.ts");
  const { getChildBotContext } = await import("../child-context.ts");
  const childCtx = getChildBotContext();
  const mainToken = childCtx ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;

  if (childCtx) {
    const fileId = msg.photo[msg.photo.length - 1]?.file_id;
    if (fileId) {
      await resendPhotoToAllAdmins(token, mainToken, supabase, fileId,
        `💎 <b>Binance Deposit Screenshot</b> (via Child Bot)\n👤 User: <code>${userId}</code>\n💵 Amount: ${amount ? `₹${amount}` : "TBD"}`
      );
    }
  } else {
    try { await forwardToAllAdmins(token, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward error:", e); }
  }

  const adminMsg = `💎 <b>Wallet Deposit Request (Binance Manual)</b>\n\n` +
    `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
    `💵 Amount: <b>${amount ? `₹${amount}` : "Check screenshot"}</b>\n` +
    `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdmins(mainToken, supabase, adminMsg, {
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

export async function handleDepositScreenshot(token: string, supabase: any, chatId: number, userId: number, msg: any, stateData: any, lang: string) {
  if (!msg.photo) {
    await sendMessage(token, chatId, lang === "bn" ? "📸 পেমেন্ট স্ক্রিনশট পাঠান (ছবি)।" : "📸 Please send the payment screenshot as a photo.");
    return;
  }

  const { amount } = stateData;
  const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";

  await deleteConversationState(supabase, userId);

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
    `💵 Amount: <b>${amount}</b>\n` +
    `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdmins(mainToken, supabase, adminMsg, {
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
