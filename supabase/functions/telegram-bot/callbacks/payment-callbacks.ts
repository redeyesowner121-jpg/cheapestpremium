// ===== PAYMENT & DEPOSIT CALLBACK ROUTING =====
import { sendMessage } from "../telegram-api.ts";
import { getConversationState, deleteConversationState } from "../db-helpers.ts";
import {
  handleWalletPay, handleAdminAction,
  showBinancePayment, showUpiPayment, showRazorpayUpiPayment, showManualUpiPayment,
  handleRazorpayVerify,
} from "../payment-handlers.ts";
import { handleMyWallet } from "../menu-handlers.ts";
import { showMainMenu } from "../menu/menu-navigation.ts";

// Helper: never re-send delivery from stale payment buttons.
// Old inline buttons can be tapped multiple times (or Telegram can retry callbacks),
// so repeating the delivery here causes spam for one completed order.
async function resendLastDelivery(_token: string, _supabase: any, chatId: number, _userId: number, lang: string) {
  await sendMessage(token, chatId, lang === "bn" ? "✅ পেমেন্ট/অর্ডার ইতিমধ্যে প্রসেস হয়েছে। ডেলিভারি আবার পাঠানো হবে না।" : "✅ Payment/order already processed. Delivery will not be sent again.");
}

// Silent no-op: never show "session expired" or "start again" — just ignore stale callbacks
async function restartFlow(_token: string, _supabase: any, _chatId: number, _lang: string) {
  // Intentionally empty — payment sessions persist until explicit /cancel
  return;
}

export async function handlePaymentCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

  // ===== QUANTITY SELECTION =====
  if (data === "qty_cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ বাতিল করা হয়েছে।" : "❌ Cancelled.");
    await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
    return true;
  }

  if (data === "qty_custom") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "awaiting_quantity_choice") {
      const { setConversationState } = await import("../db-helpers.ts");
      await setConversationState(supabase, userId, "awaiting_custom_quantity", convState.data);
      await sendMessage(BOT_TOKEN, chatId,
        lang === "bn"
          ? "✏️ পরিমাণ লিখে পাঠাও (১-২০ এর মধ্যে, উদাহরণ: <code>7</code>)। বাতিল করতে /cancel।"
          : "✏️ Send the quantity as a number (1-20, e.g. <code>7</code>). Send /cancel to abort.",
      );
    } else {
      await restartFlow(BOT_TOKEN, supabase, chatId, lang);
    }
    return true;
  }

  if (data.startsWith("qty_")) {
    const qty = parseInt(data.replace("qty_", ""), 10);
    if (Number.isFinite(qty) && qty > 0) {
      const convState = await getConversationState(supabase, userId);
      if (convState?.step === "awaiting_quantity_choice") {
        const { proceedToPaymentWithQuantity } = await import("../payment/buy-handlers.ts");
        await proceedToPaymentWithQuantity(BOT_TOKEN, supabase, chatId, telegramUser, convState.data as any, qty, lang);
      } else {
        await restartFlow(BOT_TOKEN, supabase, chatId, lang);
      }
      return true;
    }
  }

  // Wallet pay confirm
  if (data === "walletpay_confirm") {
    const { data: claimedState } = await supabase
      .from("telegram_conversation_state")
      .delete()
      .eq("telegram_id", userId)
      .eq("step", "wallet_pay_confirm")
      .select("data")
      .maybeSingle();
    if (claimedState?.data) {
      const payData = claimedState.data;
      await handleWalletPay(BOT_TOKEN, supabase, chatId, userId, payData.price, payData.productName, lang, payData.productId, payData.childBotId, payData.childBotRevenue, payData.quantity || 1);
    } else if (!convState || convState.step === "idle") {
      await resendLastDelivery(BOT_TOKEN, supabase, chatId, userId, lang);
    } else {
      await restartFlow(BOT_TOKEN, supabase, chatId, lang);
    }
    return true;
  }

  // Payment method choices
  if (data === "paymethod_binance") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_payment_method") {
      await showBinancePayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "paymethod_upi") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_payment_method") {
      await showUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "upi_auto") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_upi_method") {
      await showRazorpayUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "upi_manual") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_upi_method") {
      await showManualUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  // Binance now uses screenshot-based manual verification
  if (data === "binance_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "binance_awaiting_screenshot") {
      await sendMessage(BOT_TOKEN, chatId, "📸 Please send your <b>payment screenshot</b> as a photo to verify.");
    } else if (!convState || convState.step === "idle") {
      await resendLastDelivery(BOT_TOKEN, supabase, chatId, userId, lang);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "razorpay_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "razorpay_payment_pending") {
      await handleRazorpayVerify(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else if (!convState || convState.step === "idle") {
      await resendLastDelivery(BOT_TOKEN, supabase, chatId, userId, lang);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  // Cancel payments
  if (data === "razorpay_cancel" || data === "binance_cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(BOT_TOKEN, chatId, "Payment cancelled.");
    await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
    return true;
  }

  // ===== DEPOSIT FLOW =====

  // Step 1: Method selection
  if (data === "deposit_method_binance") {
    // Binance deposit: go directly to pay screen (no amount needed)
    const { showDepositBinance } = await import("../payment/deposit-handlers.ts");
    await showDepositBinance(BOT_TOKEN, supabase, chatId, userId, null, lang);
    return true;
  }

  if (data === "deposit_method_upi") {
    const { showDepositAmountEntry } = await import("../payment/deposit-handlers.ts");
    await showDepositAmountEntry(BOT_TOKEN, supabase, chatId, userId, "upi", lang);
    return true;
  }

  // Step 2: Amount quick-select → route to payment based on method in state
  if (data.startsWith("deposit_amt_")) {
    const amt = parseInt(data.replace("deposit_amt_", ""));
    if (amt > 0) {
      const convState = await getConversationState(supabase, userId);
      const method = convState?.data?.method;
      if (method === "binance") {
        const { showDepositBinance } = await import("../payment/deposit-handlers.ts");
        await showDepositBinance(BOT_TOKEN, supabase, chatId, userId, amt, lang);
      } else if (method === "upi") {
        const { showDepositUpi } = await import("../payment/deposit-handlers.ts");
        await showDepositUpi(BOT_TOKEN, supabase, chatId, userId, amt, lang);
      } else {
        // Fallback: old flow (amount first)
        const { showDepositMethodChoice } = await import("../payment/deposit-handlers.ts");
        await showDepositMethodChoice(BOT_TOKEN, supabase, chatId, userId, amt, lang);
      }
    }
    return true;
  }

  // Legacy callbacks (kept for backward compat)
  if (data === "deposit_binance") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositBinance } = await import("../payment/deposit-handlers.ts");
      await showDepositBinance(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "deposit_upi") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositUpi } = await import("../payment/deposit-handlers.ts");
      await showDepositUpi(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "deposit_upi_auto") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositRazorpay } = await import("../payment/deposit-handlers.ts");
      await showDepositRazorpay(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "deposit_upi_manual") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositManualUpi } = await import("../payment/deposit-handlers.ts");
      await showDepositManualUpi(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "deposit_binance_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "deposit_binance_pending") {
      await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "⏳ স্ক্রিনশট পাঠান, অ্যাডমিন ভেরিফাই করবেন।" : "⏳ Please send your screenshot, admin will verify.");
    } else if (!convState || convState.step === "idle") {
      await sendMessage(BOT_TOKEN, chatId, "✅ Payment already processed.");
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "deposit_razorpay_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "deposit_razorpay_pending") {
      const { verifyDepositRazorpay } = await import("../payment/deposit-handlers.ts");
      await verifyDepositRazorpay(BOT_TOKEN, supabase, chatId, userId, convState.data, lang);
    } else if (!convState || convState.step === "idle") {
      await sendMessage(BOT_TOKEN, chatId, "✅ Payment already processed.");
    } else { await restartFlow(BOT_TOKEN, supabase, chatId, lang); }
    return true;
  }

  if (data === "deposit_cancel") {
    // Clear any active reservations before cancelling
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.reservationId) {
      if (convState.step === "deposit_binance_pending") {
        await supabase.from("binance_amount_reservations").update({ status: "cancelled" }).eq("id", convState.data.reservationId);
      } else {
        await supabase.from("razorpay_amount_reservations").update({ status: "cancelled" }).eq("id", convState.data.reservationId);
      }
    }
    await deleteConversationState(supabase, userId);
    await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ ডিপোজিট বাতিল হয়েছে।" : "❌ Deposit cancelled.");
    await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }

  if (data === "deposit_choose_method") {
    // Go back to method selection (step 1)
    const { handleDepositStart } = await import("../payment/deposit-handlers.ts");
    await handleDepositStart(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }

  return false;
}
