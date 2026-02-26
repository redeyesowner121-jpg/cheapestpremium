// ===== CONVERSATION STEP HANDLERS =====

import { t, BOT_USERNAME } from "./constants.ts";
import { sendMessage, forwardMessage, getTelegramApiUrl } from "./telegram-api.ts";
import {
  deleteConversationState, setConversationState, getUserLang,
  getWallet, notifyAllAdmins, forwardToAllAdmins,
} from "./db-helpers.ts";
import { showMainMenu } from "./menu-handlers.ts";
import { executeBroadcast } from "./admin-handlers.ts";

export async function handleConversationStep(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  if (text === "/cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, "❌ Cancelled.");
    return;
  }

  // Awaiting payment screenshot

  if (state.step === "awaiting_screenshot") {
    if (!msg.photo) {
      const lang = (await getUserLang(supabase, userId)) || "en";
      await sendMessage(token, chatId, lang === "bn" ? "📸 অনুগ্রহ করে পেমেন্ট স্ক্রিনশট পাঠান (ছবি হিসেবে)।" : "📸 Please send the payment screenshot as a photo.");
      return;
    }

    const orderData = state.data;
    await deleteConversationState(supabase, userId);
    const lang = (await getUserLang(supabase, userId)) || "en";
    const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";

    // Deduct wallet balance for partial payment
    const walletDeduction = orderData.walletDeduction || 0;
    if (walletDeduction > 0) {
      const wallet = await getWallet(supabase, userId);
      if (wallet && wallet.balance >= walletDeduction) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance - walletDeduction,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", userId);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: userId,
          type: "purchase_deduction",
          amount: -walletDeduction,
          description: `Partial wallet pay: ${orderData.productName}`,
        });
      }
    }

    // Create order in DB
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId,
      username,
      product_name: orderData.productName,
      product_id: orderData.productId || null,
      amount: orderData.price,
      status: "pending",
      screenshot_file_id: msg.photo[msg.photo.length - 1]?.file_id || null,
      reseller_telegram_id: orderData.reseller_telegram_id || null,
      reseller_profit: orderData.reseller_profit || null,
    }).select("id").single();

    const orderId = order?.id || "unknown";

    // Notify user
    let userConfirmMsg = lang === "bn"
      ? "✅ <b>স্ক্রিনশট পাঠানো হয়েছে!</b>\n\n"
      : "✅ <b>Screenshot received!</b>\n\n";
    if (walletDeduction > 0) {
      userConfirmMsg += lang === "bn"
        ? `💳 ওয়ালেট থেকে ₹${walletDeduction} কাটা হয়েছে।\n`
        : `💳 ₹${walletDeduction} deducted from wallet.\n`;
    }
    userConfirmMsg += lang === "bn"
      ? "অ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন। ⏳"
      : "Admin is verifying your payment. You'll get an update soon. ⏳";
    await sendMessage(token, chatId, userConfirmMsg);

    // Forward screenshot to all admins
    await forwardToAllAdmins(token, supabase, chatId, msg.message_id);

    // Send admin action buttons
    let adminMsg = `📩 <b>Payment Screenshot</b>\n\n` +
      `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
      `📦 Product: <b>${orderData.productName}</b>\n` +
      `💰 Total Price: <b>₹${orderData.price}</b>\n`;

    if (walletDeduction > 0) {
      adminMsg += `💳 Wallet Deducted: <b>₹${walletDeduction}</b>\n`;
    }
    adminMsg += `💵 UPI Paid: <b>₹${orderData.finalAmount || orderData.price}</b>\n` +
      `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

    if (orderData.variationId) {
      const { data: varInfo } = await supabase.from("product_variations").select("name").eq("id", orderData.variationId).single();
      if (varInfo) {
        adminMsg += `\n📋 Variation: <b>${varInfo.name}</b>`;
      }
    }

    if (orderData.reseller_telegram_id) {
      adminMsg += `\n🔄 <b>Resale Order</b> — Reseller: <code>${orderData.reseller_telegram_id}</code>, Profit: ₹${orderData.reseller_profit}`;
    }

    await notifyAllAdmins(token, supabase, adminMsg,
      {
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
      }
    );
    return;
  }

  // Admin reply to user (persistent chat mode)
  if (state.step === "admin_reply") {
    const targetUserId = state.data.targetUserId;
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      await sendMessage(token, chatId, `✅ Chat with user <code>${targetUserId}</code> ended.`);
      return;
    }
    if (msg.photo) {
      await forwardMessage(token, targetUserId, chatId, msg.message_id);
    } else {
      await sendMessage(token, targetUserId, `📩 <b>Admin:</b>\n\n${text}`);
    }
    await sendMessage(token, chatId, `✅ Sent to <code>${targetUserId}</code>. Continue typing or /endchat to stop.`);
    return;
  }

  // User chatting with admin (AI disabled)
  if (state.step === "chatting_with_admin") {
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      const lang2 = (await getUserLang(supabase, userId)) || "en";
      await sendMessage(token, chatId, lang2 === "bn"
        ? "✅ চ্যাট শেষ হয়েছে। মূল মেনুতে ফিরে যাচ্ছি..."
        : "✅ Chat ended. Returning to main menu..."
      );
      await showMainMenu(token, supabase, chatId, lang2);
      return;
    }
    const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";
    await forwardToAllAdmins(token, supabase, chatId, msg.message_id);
    await notifyAllAdmins(token, supabase,
      `💬 <b>Live Chat</b> from <b>${username}</b> (<code>${userId}</code>)`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "💬 Reply", callback_data: `admin_chat_${userId}` }]],
        },
      }
    );
    return;
  }

  // Broadcast
  if (state.step === "broadcast_message") {
    await deleteConversationState(supabase, userId);
    await executeBroadcast(token, supabase, chatId, msg);
    return;
  }

  // Resale price entry
  if (state.step === "resale_price") {
    const price = parseFloat(text);
    const resellerPrice = state.data.reseller_price;
    const lang = state.data.lang || "en";

    if (isNaN(price) || price <= resellerPrice) {
      await sendMessage(token, chatId, t("resale_price_low", lang).replace("{price}", String(resellerPrice)));
      return;
    }

    await deleteConversationState(supabase, userId);

    const linkCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error: insertError } = await supabase.from("telegram_resale_links").insert({
      reseller_telegram_id: userId,
      product_id: state.data.product_id,
      variation_id: state.data.variation_id || null,
      custom_price: price,
      reseller_price: resellerPrice,
      link_code: linkCode,
    });

    if (insertError) {
      console.error("Resale link insert error:", insertError);
      await sendMessage(token, chatId, "❌ Failed to create resale link. Please try again.");
      return;
    }

    const profit = price - resellerPrice;
    const linkMsg = `✅ <b>${lang === "bn" ? "রিসেল লিংক তৈরি হয়েছে!" : "Resale Link Created!"}</b>\n\n` +
      `🔗 Link: <code>https://t.me/${BOT_USERNAME}?start=buy_${linkCode}</code>\n` +
      `💰 ${lang === "bn" ? "আপনার মূল্য" : "Your Price"}: ₹${price}\n` +
      `📦 ${lang === "bn" ? "রিসেলার মূল্য" : "Reseller Price"}: ₹${resellerPrice}\n` +
      `💵 ${lang === "bn" ? "প্রতি বিক্রয়ে লাভ" : "Profit per sale"}: ₹${profit}`;

    await sendMessage(token, chatId, linkMsg);
    return;
  }

  // Add product flow
  switch (state.step) {
    case "add_photo": {
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        const fileRes = await fetch(`${getTelegramApiUrl(token)}/getFile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: photo.file_id }),
        });
        const fileData = await fileRes.json();
        const filePath = fileData.result?.file_path;
        const image_url = filePath ? `https://api.telegram.org/file/bot${token}/${filePath}` : "";
        await setConversationState(supabase, userId, "add_name", { ...state.data, image_url });
        await sendMessage(token, chatId, "✅ Photo received!\n📝 <b>Step 2/4:</b> Enter product name.");
      } else {
        await sendMessage(token, chatId, "⚠️ Please send a photo.");
      }
      break;
    }
    case "add_name":
      await setConversationState(supabase, userId, "add_price", { ...state.data, name: text });
      await sendMessage(token, chatId, `✅ Name: <b>${text}</b>\n💰 <b>Step 3/4:</b> Enter price.`);
      break;
    case "add_price": {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) { await sendMessage(token, chatId, "⚠️ Enter a valid price."); break; }
      await setConversationState(supabase, userId, "add_category", { ...state.data, price });
      await sendMessage(token, chatId, `✅ Price: ₹${price}\n📂 <b>Step 4/4:</b> Enter category.`);
      break;
    }
    case "add_category": {
      await deleteConversationState(supabase, userId);
      const slug = state.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
      const { data: product, error } = await supabase.from("products").insert({
        name: state.data.name, price: state.data.price, category: text,
        slug, image_url: state.data.image_url || null, is_active: true,
      }).select("id").single();

      if (error) {
        await sendMessage(token, chatId, `❌ Failed: ${error.message}`);
      } else {
        await sendMessage(token, chatId,
          `✅ <b>Product Added!</b>\n📦 ${state.data.name}\n💰 ₹${state.data.price}\n📂 ${text}\n🆔 <code>${product.id}</code>`
        );
      }
      break;
    }
  }
}
