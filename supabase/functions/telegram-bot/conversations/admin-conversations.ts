// ===== ADMIN CONVERSATION HANDLERS =====

import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import {
  deleteConversationState, setConversationState, getUserLang,
  notifyAllAdmins, forwardToAllAdmins,
} from "../db-helpers.ts";
import { showMainMenu } from "../menu/menu-navigation.ts";
import { executeBroadcast } from "../admin/admin-menu.ts";
import { RESALE_BOT_USERNAME } from "../constants.ts";

export async function handleAdminConversationSteps(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  // Admin reply to user
  if (state.step === "admin_reply") {
    const targetUserId = state.data.targetUserId;
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      await sendMessage(token, chatId, `✅ Chat with user <code>${targetUserId}</code> ended.`);
      return true;
    }

    const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
    
    // Check if user has child bot orders — if so, try child bot token first
    let childBotToken: string | null = null;
    try {
      const { data: childOrder } = await supabase.from("telegram_orders")
        .select("username")
        .eq("telegram_user_id", targetUserId)
        .ilike("username", "child_bot:%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (childOrder?.username) {
        const childBotId = childOrder.username.replace("child_bot:", "");
        const { data: childBot } = await supabase.from("child_bots").select("bot_token").eq("id", childBotId).single();
        childBotToken = childBot?.bot_token || null;
      }
    } catch {}

    // Check if user has resale orders — if so, try resale bot first
    let isResaleUser = false;
    if (!childBotToken) {
      try {
        const { count } = await supabase.from("telegram_orders")
          .select("*", { count: "exact", head: true })
          .eq("telegram_user_id", targetUserId)
          .not("reseller_telegram_id", "is", null)
          .limit(1);
        isResaleUser = (count || 0) > 0;
      } catch {}
    }

    let tokensToTry: string[];
    if (childBotToken) {
      tokensToTry = [childBotToken, token]; // Child bot first
    } else if (isResaleUser && resaleToken && resaleToken !== token) {
      tokensToTry = [resaleToken, token]; // Resale bot first for resale users
    } else {
      tokensToTry = [token];
      if (resaleToken && resaleToken !== token) tokensToTry.push(resaleToken);
    }

    let sent = false;
    for (const t of tokensToTry) {
      try {
        if (msg.photo) {
          const res = await fetch(`https://api.telegram.org/bot${t}/forwardMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetUserId, from_chat_id: chatId, message_id: msg.message_id }),
          });
          const result = await res.json();
          if (result.ok) { sent = true; break; }
        } else {
          const res = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
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
    return true;
  }

  // Admin teaching AI
  if (state.step === "admin_teaching_ai") {
    const { targetUserId, originalQuestion, questionLang } = state.data;
    await deleteConversationState(supabase, userId);

    // Save as PENDING knowledge — needs admin approval
    const { data: inserted } = await supabase.from("telegram_ai_knowledge").insert({
      question: originalQuestion, answer: text, added_by: userId,
      original_user_id: targetUserId, language: questionLang || "en",
      status: "pending",
    }).select("id").single();

    const userState = await import("../db-helpers.ts").then(m => m.getConversationState(supabase, targetUserId));
    if (userState?.step === "awaiting_admin_answer") {
      await deleteConversationState(supabase, targetUserId);
    }

    // Send answer to user immediately
    const userLang = questionLang || "en";
    await sendMessage(token, targetUserId, userLang === "bn" ? `📩 <b>উত্তর:</b>\n\n${text}` : `📩 <b>Answer:</b>\n\n${text}`);

    // Show approve/reject to admin
    const knowledgeId = inserted?.id || "";
    await sendMessage(token, chatId,
      `✅ <b>Answer sent!</b>\n\n` +
      `📩 Answered user <code>${targetUserId}</code>\n\n` +
      `❓ <b>Q:</b> ${originalQuestion}\n` +
      `✅ <b>A:</b> ${text}\n\n` +
      `🧠 <b>Save as AI knowledge?</b>\n` +
      `If approved, AI will use this answer for similar questions in future.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve Knowledge", callback_data: `knowledge_approve_${knowledgeId}`, style: "success" },
              { text: "❌ Reject", callback_data: `knowledge_reject_${knowledgeId}`, style: "danger" },
            ],
            [{ text: "⬅️ Back to Admin", callback_data: "adm_back", style: "primary" }],
          ],
        },
      }
    );
    return true;
  }

  // AI Training
  if (state.step === "ai_training_question") {
    const { handleTrainingQuestion } = await import("../admin/admin-ai-training.ts");
    await handleTrainingQuestion(token, supabase, chatId, userId, text, state.data.category);
    return true;
  }
  if (state.step === "ai_training_answer") {
    await deleteConversationState(supabase, userId);
    const { handleTrainingAnswer } = await import("../admin/admin-ai-training.ts");
    await handleTrainingAnswer(token, supabase, chatId, userId, text, state.data.question, state.data.category);
    return true;
  }

  // User chatting with admin
  if (state.step === "chatting_with_admin") {
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      const lang2 = (await getUserLang(supabase, userId)) || "en";
      await sendMessage(token, chatId, lang2 === "bn" ? "✅ চ্যাট শেষ হয়েছে। মূল মেনুতে ফিরে যাচ্ছি..." : "✅ Chat ended. Returning to main menu...");
      await showMainMenu(token, supabase, chatId, lang2);
      return true;
    }
    const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";
    // Forward using current bot token (the one user is chatting with)
    await forwardToAllAdmins(token, supabase, chatId, msg.message_id);
    // But send admin buttons via main token so callbacks work in main bot
    const { getChildBotContext } = await import("../child-context.ts");
    const childCtx = getChildBotContext();
    const mainToken = childCtx ? (Deno.env.get("TELEGRAM_BOT_TOKEN") || token) : token;
    const sourceLabel = childCtx ? ` (via Child Bot)` : "";
    await notifyAllAdmins(mainToken, supabase,
      `💬 <b>Live Chat</b>${sourceLabel} from <b>${username}</b> (<code>${userId}</code>)`,
      { reply_markup: { inline_keyboard: [[{ text: "💬 Reply", callback_data: `admin_chat_${userId}`, style: "primary" }]] } }
    );
    return true;
  }

  // Broadcast
  if (state.step === "broadcast_message") {
    await deleteConversationState(supabase, userId);
    await executeBroadcast(token, supabase, chatId, msg);
    return true;
  }

  // Admin button-based steps
  const adminButtonSteps: Record<string, () => Promise<void>> = {
    admin_edit_price: async () => {
      await deleteConversationState(supabase, userId);
      const { handleEditPrice } = await import("../admin/admin-products.ts");
      await handleEditPrice(token, supabase, chatId, text);
    },
    admin_out_stock: async () => {
      await deleteConversationState(supabase, userId);
      const { handleOutStock } = await import("../admin/admin-products.ts");
      await handleOutStock(token, supabase, chatId, text);
    },
    admin_history: async () => {
      await deleteConversationState(supabase, userId);
      const tgId = parseInt(text);
      if (!tgId) { await sendMessage(token, chatId, "⚠️ Enter a valid User ID."); return; }
      const { handleHistoryCommand } = await import("../admin/admin-users.ts");
      await handleHistoryCommand(token, supabase, chatId, tgId);
    },
    admin_make_reseller: async () => {
      await deleteConversationState(supabase, userId);
      const tgId = parseInt(text);
      if (!tgId) { await sendMessage(token, chatId, "⚠️ Enter a valid User ID."); return; }
      const { handleMakeReseller } = await import("../admin/admin-users.ts");
      await handleMakeReseller(token, supabase, chatId, tgId);
    },
    admin_ban_user: async () => {
      await deleteConversationState(supabase, userId);
      const tgId = parseInt(text);
      if (!tgId) { await sendMessage(token, chatId, "⚠️ Enter a valid User ID."); return; }
      const { handleBanCommand } = await import("../admin/admin-users.ts");
      await handleBanCommand(token, supabase, chatId, tgId, true);
    },
    admin_unban_user: async () => {
      await deleteConversationState(supabase, userId);
      const tgId = parseInt(text);
      if (!tgId) { await sendMessage(token, chatId, "⚠️ Enter a valid User ID."); return; }
      const { handleBanCommand } = await import("../admin/admin-users.ts");
      await handleBanCommand(token, supabase, chatId, tgId, false);
    },
    admin_add_balance: async () => {
      await deleteConversationState(supabase, userId);
      const parts = text.split(/\s+/);
      const { handleAddBalance } = await import("../admin/admin-wallet.ts");
      await handleAddBalance(token, supabase, chatId, parseInt(parts[0]) || 0, parseFloat(parts[1]) || 0);
    },
    admin_deduct_balance: async () => {
      await deleteConversationState(supabase, userId);
      const parts = text.split(/\s+/);
      const { handleDeductBalance } = await import("../admin/admin-wallet.ts");
      await handleDeductBalance(token, supabase, chatId, parseInt(parts[0]) || 0, parseFloat(parts[1]) || 0);
    },
    admin_add_channel: async () => {
      await deleteConversationState(supabase, userId);
      const { handleAddChannel } = await import("../admin/admin-channels.ts");
      await handleAddChannel(token, supabase, chatId, text.trim());
    },
    admin_remove_channel: async () => {
      await deleteConversationState(supabase, userId);
      const { handleRemoveChannel } = await import("../admin/admin-channels.ts");
      await handleRemoveChannel(token, supabase, chatId, text.trim());
    },
    admin_add_admin: async () => {
      await deleteConversationState(supabase, userId);
      const tgId = parseInt(text);
      if (!tgId) { await sendMessage(token, chatId, "⚠️ Enter a valid User ID."); return; }
      const { handleAddAdmin } = await import("../admin/admin-users.ts");
      await handleAddAdmin(token, supabase, chatId, tgId);
    },
    admin_remove_admin: async () => {
      await deleteConversationState(supabase, userId);
      const tgId = parseInt(text);
      if (!tgId) { await sendMessage(token, chatId, "⚠️ Enter a valid User ID."); return; }
      const { handleRemoveAdmin } = await import("../admin/admin-users.ts");
      await handleRemoveAdmin(token, supabase, chatId, tgId);
    },
    admin_edit_setting: async () => {
      await deleteConversationState(supabase, userId);
      const { saveSetting } = await import("../admin/admin-menu.ts");
      await saveSetting(token, supabase, chatId, state.data.settingKey, text.trim());
    },
  };

  if (adminButtonSteps[state.step]) {
    await adminButtonSteps[state.step]();
    return true;
  }

  return false;
}
