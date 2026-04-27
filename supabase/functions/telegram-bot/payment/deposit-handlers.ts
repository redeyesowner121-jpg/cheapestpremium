// ===== WALLET DEPOSIT HANDLERS =====
// Refactored: split into ./deposit-ui.ts, ./deposit-screenshots.ts, ./deposit-verify.ts
// This file is now a barrel re-export so all existing imports keep working.

export {
  handleDepositStart,
  showDepositAmountEntry,
  showDepositMethodChoice,
  showDepositBinance,
  showDepositUpi,
  showDepositRazorpay,
  showDepositManualUpi,
} from "./deposit-ui.ts";

export {
  handleDepositBinanceScreenshot,
  handleDepositScreenshot,
} from "./deposit-screenshots.ts";

export {
  verifyDepositRazorpay,
} from "./deposit-verify.ts";
