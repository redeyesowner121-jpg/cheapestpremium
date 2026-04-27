// ===== Admin-related callbacks: chat, AI training, knowledge approval, order actions =====
import { sendMessage } from "../telegram-api.ts";
import { isAdminBot, setConversationState, getConversationState } from "../db-helpers.ts";
import {
  executeDeleteKnowledge, handleViewKnowledge,
  startDeleteKnowledge, startTrainingCategory, handleAllUsers,
  handlePendingKnowledge,
} from "../admin-handlers.ts";
import { handleAdminAction } from "../payment-handlers.ts";

export async function handleAdminCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string
): Promise<boolean> {
  if (data.startsWith("admin_chat_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const targetUserId = parseInt(data.replace("admin_chat_", ""));
    await setConversationState(supabase, userId, "admin_reply", { targetUserId });
    await sendMessage(BOT_TOKEN, chatId, `💬 <b>Chat mode with user <code>${targetUserId}</code></b>\n\nType messages to send. Each message will be delivered to the user.\n\nSend /endchat to end the conversation.`);
    return true;
  }

  if (data.startsWith("ai_teach_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const targetUserId = parseInt(data.replace("ai_teach_", ""));
    const userState = await getConversationState(supabase, targetUserId);
    const originalQuestion = userState?.step === "awaiting_admin_answer" ? userState.data.originalQuestion : null;
    const questionLang = userState?.data?.questionLang || "en";
    await setConversationState(supabase, userId, "admin_teaching_ai", { targetUserId, originalQuestion: originalQuestion || "Unknown question", questionLang });
    await sendMessage(BOT_TOKEN, chatId, `📝 <b>Teach AI Mode</b>\n\n❓ User's Question: <b>${originalQuestion || "Unknown"}</b>\n\n✍️ Type your answer. This will:\n1. Be sent to the user\n2. Be saved so AI can answer similar questions in future\n\nSend /cancel to cancel.`);
    return true;
  }

  if (data.startsWith("knowledge_approve_") || data.startsWith("knowledge_reject_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const isApprove = data.startsWith("knowledge_approve_");
    const knowledgeId = data.replace(/^knowledge_(approve|reject)_/, "");
    if (isApprove) {
      await supabase.from("telegram_ai_knowledge").update({ status: "approved" }).eq("id", knowledgeId);
      await sendMessage(BOT_TOKEN, chatId,
        `✅ <b>Knowledge Approved!</b>\n\n🧠 AI will now use this answer.`,
        { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }], [{ text: "⬅️ Back", callback_data: "adm_back", color: "red" }]] } }
      );
    } else {
      await supabase.from("telegram_ai_knowledge").delete().eq("id", knowledgeId);
      await sendMessage(BOT_TOKEN, chatId,
        `❌ <b>Knowledge Rejected & Deleted</b>\n\nThis answer will not be added to AI knowledge.`,
        { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }], [{ text: "⬅️ Back", callback_data: "adm_back", color: "red" }]] } }
      );
    }
    return true;
  }

  if (data.startsWith("aitrain_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    if (data.startsWith("aitrain_del_")) { await executeDeleteKnowledge(BOT_TOKEN, supabase, chatId, data.replace("aitrain_del_", "")); return true; }
    if (data.startsWith("aitrain_view_")) { await handleViewKnowledge(BOT_TOKEN, supabase, chatId, parseInt(data.replace("aitrain_view_", "")) || 0); return true; }
    if (data === "aitrain_view") { await handleViewKnowledge(BOT_TOKEN, supabase, chatId, 0); return true; }
    if (data === "aitrain_delete") { await startDeleteKnowledge(BOT_TOKEN, supabase, chatId, userId); return true; }
    if (data === "aitrain_pending") { await handlePendingKnowledge(BOT_TOKEN, supabase, chatId); return true; }
    const category = data.replace("aitrain_", "");
    await startTrainingCategory(BOT_TOKEN, supabase, chatId, userId, category);
    return true;
  }

  if (data.startsWith("admin_confirm_") || data.startsWith("admin_reject_") || data.startsWith("admin_ship_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const parts = data.split("_");
    const action = parts[1];
    const orderId = data.substring(data.indexOf("_", data.indexOf("_") + 1) + 1);
    const statusMap: Record<string, string> = { confirm: "confirmed", reject: "rejected", ship: "shipped" };
    await handleAdminAction(BOT_TOKEN, supabase, orderId, statusMap[action] || "confirmed", chatId);
    return true;
  }

  if (data.startsWith("admin_resend_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const orderId = data.replace("admin_resend_", "");
    const { handleAdminResend } = await import("../payment/admin-actions.ts");
    await handleAdminResend(BOT_TOKEN, supabase, orderId, chatId);
    return true;
  }

  if (data.startsWith("allusers_page_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    await handleAllUsers(BOT_TOKEN, supabase, chatId, parseInt(data.replace("allusers_page_", "")));
    return true;
  }

  return false;
}
