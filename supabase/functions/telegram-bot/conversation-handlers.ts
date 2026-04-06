// ===== CONVERSATION STEP HANDLERS (Dispatcher) =====

import { sendMessage } from "./telegram-api.ts";
import { deleteConversationState } from "./db-helpers.ts";
import { handleDepositSteps, handleWithdrawSteps } from "./conversations/wallet-conversations.ts";
import { handleScreenshotStep } from "./conversations/order-conversations.ts";
import { handleAdminConversationSteps } from "./conversations/admin-conversations.ts";
import { handleProductAndResaleSteps } from "./conversations/product-conversations.ts";

export async function handleConversationStep(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  if (text === "/cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, "❌ Cancelled.");
    return;
  }

  // Deposit steps
  if (await handleDepositSteps(token, supabase, chatId, userId, msg, state)) return;

  // Withdraw steps
  if (await handleWithdrawSteps(token, supabase, chatId, userId, text, state)) return;

  // Screenshot/order step
  if (await handleScreenshotStep(token, supabase, chatId, userId, msg, state)) return;

  // Admin conversation steps
  if (await handleAdminConversationSteps(token, supabase, chatId, userId, msg, state)) return;

  // Product & resale steps
  if (await handleProductAndResaleSteps(token, supabase, chatId, userId, msg, state)) return;
}
