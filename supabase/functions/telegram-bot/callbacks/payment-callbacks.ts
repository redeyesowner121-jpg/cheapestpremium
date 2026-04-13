// ===== PAYMENT & DEPOSIT CALLBACK ROUTING =====
import { sendMessage } from "../telegram-api.ts";
import { getConversationState, deleteConversationState } from "../db-helpers.ts";
import {
  handleWalletPay, handleAdminAction,
  showBinancePayment, showUpiPayment, showRazorpayUpiPayment, showManualUpiPayment,
  handleBinanceVerify, handleRazorpayVerify,
} from "../payment-handlers.ts";
import { handleMyWallet } from "../menu-handlers.ts";
import { showMainMenu } from "../menu/menu-navigation.ts";

// Helper: resend access link + login code for the user's last confirmed order
async function resendLastDelivery(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const { data: lastOrder } = await supabase
    .from("telegram_orders")
    .select("product_name, product_id")
    .eq("telegram_user_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOrder?.product_id) {
    const { data: product } = await supabase.from("products").select("access_link").eq("id", lastOrder.product_id).single();
    if (product?.access_link) {
      const { sendInstantDeliveryWithLoginCode } = await import("../payment/instant-delivery.ts");
      await sendInstantDeliveryWithLoginCode(token, supabase, chatId, userId, product.access_link, lastOrder.product_name || "Product", lang);
      return;
    }
  }
  await sendMessage(token, chatId, "✅ Payment already processed.");
}

export async function handlePaymentCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

  // Wallet pay confirm
  if (data === "walletpay_confirm") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "wallet_pay_confirm") {
      await deleteConversationState(supabase, userId);
      await handleWalletPay(BOT_TOKEN, supabase, chatId, userId, convState.data.price, convState.data.productName, lang, convState.data.productId);
    } else if (!convState || convState.step === "idle") {
      await resendLastDelivery(BOT_TOKEN, supabase, chatId, userId, lang);
    } else {
      await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ সেশন মেয়াদ উত্তীর্ণ। আবার চেষ্টা করুন।" : "❌ Session expired. Please try again.");
    }
    return true;
  }

  // Payment method choices
  if (data === "paymethod_binance") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_payment_method") {
      await showBinancePayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again."); }
    return true;
  }

  if (data === "paymethod_upi") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_payment_method") {
      await showUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again."); }
    return true;
  }

  if (data === "upi_auto") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_upi_method") {
      await showRazorpayUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again."); }
    return true;
  }

  if (data === "upi_manual") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "choose_upi_method") {
      await showManualUpiPayment(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again."); }
    return true;
  }

  // Binance verify is now handled via text message (order ID), not callback
  // Keep for backward compat - prompt user to send order ID
  if (data === "binance_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "binance_payment_pending" || convState?.step === "binance_awaiting_order_id") {
      await sendMessage(BOT_TOKEN, chatId, "📤 Please send your <b>Binance Order ID</b> as a message to verify payment.");
    } else if (!convState || convState.step === "idle") {
      await resendLastDelivery(BOT_TOKEN, supabase, chatId, userId, lang);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again."); }
    return true;
  }

  if (data === "razorpay_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "razorpay_payment_pending") {
      await handleRazorpayVerify(BOT_TOKEN, supabase, chatId, telegramUser, convState.data);
    } else if (!convState || convState.step === "idle") {
      await resendLastDelivery(BOT_TOKEN, supabase, chatId, userId, lang);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired. Please try again."); }
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
    const { showDepositAmountEntry } = await import("../payment/deposit-handlers.ts");
    await showDepositAmountEntry(BOT_TOKEN, supabase, chatId, userId, "binance", lang);
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
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired."); }
    return true;
  }

  if (data === "deposit_upi") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositUpi } = await import("../payment/deposit-handlers.ts");
      await showDepositUpi(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired."); }
    return true;
  }

  if (data === "deposit_upi_auto") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositRazorpay } = await import("../payment/deposit-handlers.ts");
      await showDepositRazorpay(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired."); }
    return true;
  }

  if (data === "deposit_upi_manual") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.data?.amount) {
      const { showDepositManualUpi } = await import("../payment/deposit-handlers.ts");
      await showDepositManualUpi(BOT_TOKEN, supabase, chatId, userId, convState.data.amount, lang);
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired."); }
    return true;
  }

  if (data === "deposit_binance_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "deposit_binance_pending") {
      const { verifyDepositBinance } = await import("../payment/deposit-handlers.ts");
      await verifyDepositBinance(BOT_TOKEN, supabase, chatId, userId, convState.data, lang);
    } else if (!convState || convState.step === "idle") {
      await sendMessage(BOT_TOKEN, chatId, "✅ Payment already processed.");
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired."); }
    return true;
  }

  if (data === "deposit_razorpay_verify") {
    const convState = await getConversationState(supabase, userId);
    if (convState?.step === "deposit_razorpay_pending") {
      const { verifyDepositRazorpay } = await import("../payment/deposit-handlers.ts");
      await verifyDepositRazorpay(BOT_TOKEN, supabase, chatId, userId, convState.data, lang);
    } else if (!convState || convState.step === "idle") {
      await sendMessage(BOT_TOKEN, chatId, "✅ Payment already processed.");
    } else { await sendMessage(BOT_TOKEN, chatId, "Session expired."); }
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
