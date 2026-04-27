// ===== BUY & PAYMENT HANDLERS =====
// Refactored: split into ./buy-init.ts and ./payment-method-flow.ts
// This file is now a barrel re-export so all existing imports keep working.

export {
  handleBuyProduct,
  handleBuyVariation,
  showQuantitySelector,
  proceedToPaymentWithQuantity,
} from "./buy-init.ts";

export {
  showPaymentMethodChoice,
  showBinancePayment,
  showUpiPayment,
  showRazorpayUpiPayment,
  showManualUpiPayment,
} from "./payment-method-flow.ts";

// Re-export from existing split modules for backward compat
export { handleRazorpayVerify } from "./razorpay-verify.ts";
export { handleBinanceScreenshot } from "./binance-verify.ts";

// Legacy alias used by some callers
export { showPaymentMethodChoice as showPaymentInfo } from "./payment-method-flow.ts";
