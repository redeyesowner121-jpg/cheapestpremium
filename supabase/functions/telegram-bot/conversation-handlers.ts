// ===== CONVERSATION STEP HANDLERS =====

import { t, BOT_USERNAME, RESALE_BOT_USERNAME } from "./constants.ts";
import { sendMessage, forwardMessage, getTelegramApiUrl } from "./telegram-api.ts";
import {
  deleteConversationState, setConversationState, getUserLang,
  getWallet, notifyAllAdmins, forwardToAllAdmins,
} from "./db-helpers.ts";
import { showMainMenu } from "./menu/menu-navigation.ts";
import { executeBroadcast } from "./admin/admin-menu.ts";

export async function handleConversationStep(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  if (text === "/cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, "❌ Cancelled.");
    return;
  }

  // ===== DEPOSIT: Enter amount =====
  if (state.step === "deposit_enter_amount") {
    const amount = parseFloat(text);
    const lang2 = (await getUserLang(supabase, userId)) || "en";
    if (isNaN(amount) || amount <= 0) {
      await sendMessage(token, chatId, lang2 === "bn" ? "⚠️ সঠিক পরিমাণ লিখুন।" : "⚠️ Please enter a valid amount.");
      return;
    }
    const { showDepositMethodChoice } = await import("./payment/deposit-handlers.ts");
    await showDepositMethodChoice(token, supabase, chatId, userId, amount, lang2);
    return;
  }

  // ===== DEPOSIT: Awaiting screenshot (manual UPI) =====
  if (state.step === "deposit_awaiting_screenshot") {
    const lang2 = (await getUserLang(supabase, userId)) || "en";
    const { handleDepositScreenshot } = await import("./payment/deposit-handlers.ts");
    await handleDepositScreenshot(token, supabase, chatId, userId, msg, state.data, lang2);
    return;
  }

  // Awaiting payment screenshot
    if (!msg.photo) {
      const lang = (await getUserLang(supabase, userId)) || "en";
      await sendMessage(token, chatId, lang === "bn" ? "📸 অনুগ্রহ করে পেমেন্ট স্ক্রিনশট পাঠান (ছবি হিসেবে)।" : "📸 Please send the payment screenshot as a photo.");
      return;
    }

    const orderData = state.data;
    const lang = (await getUserLang(supabase, userId)) || "en";
    const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";

    // Delete conversation state first
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
            telegram_id: userId,
            type: "purchase_deduction",
            amount: -walletDeduction,
            description: `Partial wallet pay: ${orderData.productName}`,
          });
        }
      } catch (e) { console.error("Wallet deduction error:", e); }
    }

    // Create order in DB
    let orderId = "unknown";
    try {
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
      orderId = order?.id || "unknown";
    } catch (e) { console.error("Order insert error:", e); }

    // Notify user (don't let this block admin notification)
    try {
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
    } catch (e) { console.error("User confirm msg error:", e); }

    // Build admin message
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

    // Forward screenshot to all admins first, then send buttons with retry
    try { await forwardToAllAdmins(token, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward screenshot error:", e); }

    // Send admin buttons with retry (this is the critical part)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await notifyAllAdmins(token, supabase, adminMsg, adminButtons);
        console.log("Admin buttons sent successfully on attempt", attempt + 1);
        break;
      } catch (e) {
        console.error(`Admin notify attempt ${attempt + 1} failed:`, e);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    return;
  }

  // Admin reply to user (persistent chat mode) - try both main + resale bot tokens
  if (state.step === "admin_reply") {
    const targetUserId = state.data.targetUserId;
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      await sendMessage(token, chatId, `✅ Chat with user <code>${targetUserId}</code> ended.`);
      return;
    }

    // Try sending via main bot first, then resale bot if needed
    const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
    const tokensToTry = [token];
    if (resaleToken && resaleToken !== token) tokensToTry.push(resaleToken);

    let sent = false;
    for (const t of tokensToTry) {
      try {
        if (msg.photo) {
          const res = await fetch(`https://api.telegram.org/bot${t}/forwardMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetUserId, from_chat_id: chatId, message_id: msg.message_id }),
          });
          const result = await res.json();
          if (result.ok) { sent = true; break; }
        } else {
          const res = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetUserId, text: `📩 <b>Admin:</b>\n\n${text}`, parse_mode: "HTML" }),
          });
          const result = await res.json();
          if (result.ok) { sent = true; break; }
        }
      } catch (e) { console.error("Admin reply attempt error:", e); }
    }

    await sendMessage(token, chatId, sent
      ? `✅ Sent to <code>${targetUserId}</code>. Continue typing or /endchat to stop.`
      : `⚠️ Could not deliver to <code>${targetUserId}</code>. User may have blocked the bot.`
    );
    return;
  }

  // Admin teaching AI - save answer to knowledge base
  if (state.step === "admin_teaching_ai") {
    const { targetUserId, originalQuestion, questionLang } = state.data;
    await deleteConversationState(supabase, userId);

    // Save to knowledge base
    await supabase.from("telegram_ai_knowledge").insert({
      question: originalQuestion,
      answer: text,
      added_by: userId,
      original_user_id: targetUserId,
      language: questionLang || "en",
    });

    // Clear user's awaiting state
    const userState = await import("./db-helpers.ts").then(m => m.getConversationState(supabase, targetUserId));
    if (userState?.step === "awaiting_admin_answer") {
      await deleteConversationState(supabase, targetUserId);
    }

    // Send answer to the user
    const userLang = questionLang || "en";
    await sendMessage(token, targetUserId,
      userLang === "bn"
        ? `📩 <b>উত্তর:</b>\n\n${text}`
        : `📩 <b>Answer:</b>\n\n${text}`
    );

    await sendMessage(token, chatId,
      `✅ <b>Done!</b>\n\n📩 Answer sent to user <code>${targetUserId}</code>\n🧠 AI has learned this answer for future use.\n\n❓ <b>Q:</b> ${originalQuestion}\n✅ <b>A:</b> ${text}`
    );
    return;
  }

  // AI Training - Question input
  if (state.step === "ai_training_question") {
    const { handleTrainingQuestion } = await import("./admin/admin-ai-training.ts");
    await handleTrainingQuestion(token, supabase, chatId, userId, text, state.data.category);
    return;
  }

  // AI Training - Answer input
  if (state.step === "ai_training_answer") {
    await deleteConversationState(supabase, userId);
    const { handleTrainingAnswer } = await import("./admin/admin-ai-training.ts");
    await handleTrainingAnswer(token, supabase, chatId, userId, text, state.data.question, state.data.category);
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

  // ===== ADMIN BUTTON-BASED CONVERSATION STEPS =====
  
  // Edit price (from button)
  if (state.step === "admin_edit_price") {
    await deleteConversationState(supabase, userId);
    const { handleEditPrice } = await import("./admin/admin-products.ts");
    await handleEditPrice(token, supabase, chatId, text);
    return;
  }

  // Out of stock (from button)
  if (state.step === "admin_out_stock") {
    await deleteConversationState(supabase, userId);
    const { handleOutStock } = await import("./admin/admin-products.ts");
    await handleOutStock(token, supabase, chatId, text);
    return;
  }

  // History (from button)
  if (state.step === "admin_history") {
    await deleteConversationState(supabase, userId);
    const tgId = parseInt(text);
    if (!tgId) { await sendMessage(token, chatId, "⚠️ সঠিক User ID লিখুন।"); return; }
    const { handleHistoryCommand } = await import("./admin/admin-users.ts");
    await handleHistoryCommand(token, supabase, chatId, tgId);
    return;
  }

  // Make reseller (from button)
  if (state.step === "admin_make_reseller") {
    await deleteConversationState(supabase, userId);
    const tgId = parseInt(text);
    if (!tgId) { await sendMessage(token, chatId, "⚠️ সঠিক User ID লিখুন।"); return; }
    const { handleMakeReseller } = await import("./admin/admin-users.ts");
    await handleMakeReseller(token, supabase, chatId, tgId);
    return;
  }

  // Ban user (from button)
  if (state.step === "admin_ban_user") {
    await deleteConversationState(supabase, userId);
    const tgId = parseInt(text);
    if (!tgId) { await sendMessage(token, chatId, "⚠️ সঠিক User ID লিখুন।"); return; }
    const { handleBanCommand } = await import("./admin/admin-users.ts");
    await handleBanCommand(token, supabase, chatId, tgId, true);
    return;
  }

  // Unban user (from button)
  if (state.step === "admin_unban_user") {
    await deleteConversationState(supabase, userId);
    const tgId = parseInt(text);
    if (!tgId) { await sendMessage(token, chatId, "⚠️ সঠিক User ID লিখুন।"); return; }
    const { handleBanCommand } = await import("./admin/admin-users.ts");
    await handleBanCommand(token, supabase, chatId, tgId, false);
    return;
  }

  // Add balance (from button)
  if (state.step === "admin_add_balance") {
    await deleteConversationState(supabase, userId);
    const parts = text.split(/\s+/);
    const tgId = parseInt(parts[0]);
    const amount = parseFloat(parts[1]);
    const { handleAddBalance } = await import("./admin/admin-wallet.ts");
    await handleAddBalance(token, supabase, chatId, tgId || 0, amount || 0);
    return;
  }

  // Deduct balance (from button)
  if (state.step === "admin_deduct_balance") {
    await deleteConversationState(supabase, userId);
    const parts = text.split(/\s+/);
    const tgId = parseInt(parts[0]);
    const amount = parseFloat(parts[1]);
    const { handleDeductBalance } = await import("./admin/admin-wallet.ts");
    await handleDeductBalance(token, supabase, chatId, tgId || 0, amount || 0);
    return;
  }

  // Add channel (from button)
  if (state.step === "admin_add_channel") {
    await deleteConversationState(supabase, userId);
    const { handleAddChannel } = await import("./admin/admin-channels.ts");
    await handleAddChannel(token, supabase, chatId, text.trim());
    return;
  }

  // Remove channel (from button)
  if (state.step === "admin_remove_channel") {
    await deleteConversationState(supabase, userId);
    const { handleRemoveChannel } = await import("./admin/admin-channels.ts");
    await handleRemoveChannel(token, supabase, chatId, text.trim());
    return;
  }

  // Add admin (from button)
  if (state.step === "admin_add_admin") {
    await deleteConversationState(supabase, userId);
    const tgId = parseInt(text);
    if (!tgId) { await sendMessage(token, chatId, "⚠️ সঠিক User ID লিখুন।"); return; }
    const { handleAddAdmin } = await import("./admin/admin-users.ts");
    await handleAddAdmin(token, supabase, chatId, tgId);
    return;
  }

  // Remove admin (from button)
  if (state.step === "admin_remove_admin") {
    await deleteConversationState(supabase, userId);
    const tgId = parseInt(text);
    if (!tgId) { await sendMessage(token, chatId, "⚠️ সঠিক User ID লিখুন।"); return; }
    const { handleRemoveAdmin } = await import("./admin/admin-users.ts");
    await handleRemoveAdmin(token, supabase, chatId, tgId);
    return;
  }

  // Edit setting (from button)
  if (state.step === "admin_edit_setting") {
    await deleteConversationState(supabase, userId);
    const { saveSetting } = await import("./admin/admin-menu.ts");
    await saveSetting(token, supabase, chatId, state.data.settingKey, text.trim());
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

    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const linkCode = `${timestamp}${randomPart}`;

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
      `🔗 Link: <code>https://t.me/${RESALE_BOT_USERNAME}?start=buy_${encodeURIComponent(linkCode)}</code>\n` +
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
