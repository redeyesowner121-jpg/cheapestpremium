// ===== CONVERSATION STEP HANDLERS (Dispatcher) =====

import { sendMessage } from "./telegram-api.ts";
import { deleteConversationState } from "./db-helpers.ts";
import { handleDepositSteps, handleWithdrawSteps } from "./conversations/wallet-conversations.ts";
import { handleScreenshotStep } from "./conversations/order-conversations.ts";
import { handleAdminConversationSteps } from "./conversations/admin-conversations.ts";
import { handleProductAndResaleSteps } from "./conversations/product-conversations.ts";
import { handleBinanceScreenshot } from "./payment/binance-verify.ts";

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

  // Email setup — step 1: user submitted email → start OTP verification
  if (state.step === "awaiting_email" && text.trim()) {
    const { startEmailVerification } = await import("./email-handler.ts");
    const { getUserLang } = await import("./db-helpers.ts");
    const lang = (await getUserLang(supabase, userId)) || "en";
    await startEmailVerification(token, supabase, chatId, userId, lang, text.trim());
    return;
  }

  // Email setup — step 2: user submitted OTP code
  if (state.step === "awaiting_email_otp" && text.trim()) {
    const { verifyEmailOtp } = await import("./email-handler.ts");
    const { getUserLang } = await import("./db-helpers.ts");
    const lang = (await getUserLang(supabase, userId)) || "en";
    await verifyEmailOtp(token, supabase, chatId, userId, lang, text.trim());
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

  // Binance screenshot step (purchase flow)
  if (state.step === "binance_awaiting_screenshot") {
    if (!msg.photo) {
      await sendMessage(token, chatId, "📸 Please send the payment screenshot as a photo.");
      return;
    }
    const { handleBinanceScreenshot } = await import("./payment/binance-verify.ts");
    await handleBinanceScreenshot(token, supabase, chatId, userId, msg, state.data);
    return;
  }

  // Binance screenshot step (deposit flow)
  if (state.step === "deposit_binance_awaiting_screenshot") {
    if (!msg.photo) {
      await sendMessage(token, chatId, "📸 Please send the payment screenshot as a photo.");
      return;
    }
    const { handleDepositBinanceScreenshot } = await import("./payment/deposit-handlers.ts");
    await handleDepositBinanceScreenshot(token, supabase, chatId, userId, msg, state.data);
    return;
  }

  // Apply (reseller/wholesaler) — proof photo step
  if (state.step === "apply_awaiting_proof") {
    const { handleApplyProofPhoto } = await import("./apply-handler.ts");
    await handleApplyProofPhoto(token, supabase, chatId, userId, msg, state);
    return;
  }

  // Apply — description step
  if (state.step === "apply_awaiting_description") {
    const { handleApplyDescription } = await import("./apply-handler.ts");
    await handleApplyDescription(token, supabase, chatId, userId, msg, state);
    return;
  }

  // Send balance: awaiting recipient
  if (state.step === "send_awaiting_recipient" && text.trim()) {
    const { getUserLang } = await import("./db-helpers.ts");
    const lang = (await getUserLang(supabase, userId)) || "en";
    const { handleSendRecipientStep } = await import("./send-handler.ts");
    await handleSendRecipientStep(token, supabase, chatId, userId, text.trim(), lang);
    return;
  }

  // Send balance: awaiting amount (typed)
  if (state.step === "send_awaiting_amount" && text.trim()) {
    const { getUserLang } = await import("./db-helpers.ts");
    const lang = (await getUserLang(supabase, userId)) || "en";
    const amt = parseFloat(text.trim());
    const { handleSendAmountStep } = await import("./send-handler.ts");
    await handleSendAmountStep(token, supabase, chatId, userId, amt, state.data, lang);
    return;
  }

  // Escrow steps
  if (state.step?.startsWith("escrow_") && text.trim()) {
    const escrow = await import("./escrow-handler.ts");
    if (state.step === "escrow_awaiting_identifier" || state.step === "escrow_awaiting_email") { await escrow.escrowHandleIdentifierInput(token, supabase, chatId, userId, text); return; }
    if (state.step === "escrow_awaiting_amount") { await escrow.escrowHandleAmountInput(token, supabase, chatId, userId, text, state.data); return; }
    if (state.step === "escrow_awaiting_description") { await escrow.escrowHandleDescriptionInput(token, supabase, chatId, userId, text, state.data); return; }
    if (state.step === "escrow_awaiting_delivery_note") { await escrow.escrowHandleDeliveryNote(token, supabase, chatId, userId, text, state.data); return; }
    if (state.step === "escrow_awaiting_dispute_reason") { await escrow.escrowHandleDisputeReason(token, supabase, chatId, userId, text, state.data); return; }
    if (state.step === "escrow_awaiting_chat") { await escrow.escrowHandleChatMessage(token, supabase, chatId, userId, text, state.data); return; }
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
