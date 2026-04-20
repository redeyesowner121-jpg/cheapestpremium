// ===== CONVERSATION STEP HANDLERS (Dispatcher) =====

import { sendMessage } from "./telegram-api.ts";
import { deleteConversationState } from "./db-helpers.ts";
import { handleDepositSteps, handleWithdrawSteps } from "./conversations/wallet-conversations.ts";
import { handleScreenshotStep } from "./conversations/order-conversations.ts";
import { handleAdminConversationSteps } from "./conversations/admin-conversations.ts";
import { handleProductAndResaleSteps } from "./conversations/product-conversations.ts";
import { handleBinanceVerify } from "./payment/buy-handlers.ts";

export async function handleConversationStep(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  if (text === "/cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, "❌ Cancelled.");
    return;
  }

  // Custom quantity input (purchase flow)
  if (state.step === "awaiting_custom_quantity" && text.trim()) {
    const { getUserLang } = await import("./db-helpers.ts");
    const lang = (await getUserLang(supabase, userId)) || "en";
    const qty = parseInt(text.trim(), 10);
    if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
      await sendMessage(token, chatId,
        lang === "bn"
          ? "❌ অবৈধ পরিমাণ। ১ থেকে ১০০০ এর মধ্যে একটি সংখ্যা পাঠাও।"
          : "❌ Invalid quantity. Please send a number between 1 and 1000.",
      );
      return;
    }
    const telegramUser = msg.from || { id: userId };
    const { proceedToPaymentWithQuantity } = await import("./payment/buy-handlers.ts");
    await proceedToPaymentWithQuantity(token, supabase, chatId, telegramUser, state.data as any, qty, lang);
    return;
  }

  // Child bot setting edit
  if (state.step === "child_bot_edit_setting" && text.trim()) {
    const { saveChildBotSettingHandler } = await import("./admin-handlers.ts");
    await saveChildBotSettingHandler(token, supabase, chatId, state.data.settingKey, text.trim());
    await deleteConversationState(supabase, userId);
    return;
  }

  // Redeem gift code (entered after /redeem prompt)
  if (state.step === "awaiting_redeem_code" && text.trim()) {
    const { processRedeemCode } = await import("./redeem-handler.ts");
    const { getUserLang } = await import("./db-helpers.ts");
    const lang = await getUserLang(supabase, userId);
    await processRedeemCode(token, supabase, chatId, userId, lang || "en", text.trim());
    return;
  }

  // Binance Order ID step (purchase flow)
  if (state.step === "binance_awaiting_order_id" && text.trim()) {
    const binanceOrderId = text.trim();
    const telegramUser = msg.from || { id: userId };
    await handleBinanceVerify(token, supabase, chatId, telegramUser, state.data, binanceOrderId);
    return;
  }

  // Binance Order ID step (deposit flow)
  if (state.step === "deposit_binance_awaiting_order_id" && text.trim()) {
    const { verifyDepositBinanceWithOrderId } = await import("./payment/deposit-handlers.ts");
    await verifyDepositBinanceWithOrderId(token, supabase, chatId, userId, state.data, text.trim(), (await import("./db-helpers.ts")).getUserLang ? "en" : "en");
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
