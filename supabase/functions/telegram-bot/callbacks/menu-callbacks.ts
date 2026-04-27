// ===== MENU & NAVIGATION CALLBACK ROUTING (slim entry) =====
import { sendMessage } from "../telegram-api.ts";
import {
  showMainMenu, handleSupport,
  handleViewCategories, handleCategoryProducts, handleProductDetail,
  handleMyOrders, handleReferEarn,
  handleGetOffers, handleLoginCode,
} from "../menu-handlers.ts";
import { handleBuyProduct, handleBuyVariation } from "../payment-handlers.ts";
import { handleResaleStart, handleResaleVariationStart } from "../resale-handlers.ts";

import { handleOnboardingCallbacks } from "./onboarding-callbacks.ts";
import { handleAdminCallbacks } from "./admin-callbacks.ts";
import { handleWalletCallbacks } from "./wallet-callbacks.ts";

export async function handleMenuCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

  // Live 2FA OTP generation
  if (data.startsWith("otp_")) {
    const secret = data.slice(4);
    const { generateTOTP } = await import("../payment/credential-otp.ts");
    const result = await generateTOTP(secret);
    if (!result) {
      await sendMessage(BOT_TOKEN, chatId, lang === "bn"
        ? "❌ 2FA সিক্রেট ভ্যালিড নয়। অ্যাডমিনের সাথে যোগাযোগ করুন।"
        : "❌ Invalid 2FA secret. Please contact admin.");
      return true;
    }
    const msg = lang === "bn"
      ? `🔐 <b>লাইভ 2FA OTP</b>\n\nকোড: <code>${result.code}</code>\n⏳ ${result.secondsLeft} সেকেন্ডে এক্সপায়ার হবে\n\n⚠️ এই কোডটি ChatGPT/সাইটে দ্রুত পেস্ট করুন। নতুন OTP-র জন্য বাটনে আবার ক্লিক করুন।`
      : `🔐 <b>Live 2FA OTP</b>\n\nCode: <code>${result.code}</code>\n⏳ Expires in ${result.secondsLeft}s\n\n⚠️ Paste this code into ChatGPT/site quickly. Tap the button again for a new OTP.`;
    await sendMessage(BOT_TOKEN, chatId, msg);
    return true;
  }

  // Onboarding (lang/join/forward-to-admin)
  if (await handleOnboardingCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) return true;

  // Admin actions (chat, AI training, knowledge, order actions)
  if (await handleAdminCallbacks(BOT_TOKEN, supabase, chatId, userId, data)) return true;

  // Wallet / withdrawal / send-money
  if (await handleWalletCallbacks(BOT_TOKEN, supabase, chatId, userId, data, lang)) return true;

  // Products & Categories
  if (data === "view_products") { await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data.startsWith("cat_")) { await handleCategoryProducts(BOT_TOKEN, supabase, chatId, decodeURIComponent(data.replace("cat_", "")), lang); return true; }
  if (data.startsWith("product_")) { await handleProductDetail(BOT_TOKEN, supabase, chatId, data.replace("product_", ""), lang, userId); return true; }
  if (data.startsWith("buyvar_")) { await handleBuyVariation(BOT_TOKEN, supabase, chatId, data.replace("buyvar_", ""), telegramUser, lang); return true; }
  if (data.startsWith("buy_")) { await handleBuyProduct(BOT_TOKEN, supabase, chatId, data.replace("buy_", ""), telegramUser, lang); return true; }

  // Other menu items
  if (data === "my_orders") { await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "refer_earn") { await handleReferEarn(BOT_TOKEN, supabase, chatId, userId, lang); return true; }
  if (data === "support") { await handleSupport(BOT_TOKEN, supabase, chatId, lang); return true; }

  if (data === "show_reviews") {
    await sendMessage(BOT_TOKEN, chatId,
      lang === "bn"
        ? "⭐ <b>রিভিউ ও প্রুফস</b>\n\nআমাদের সব রিভিউ, পেমেন্ট প্রুফ এবং সাকসেস স্টোরি দেখতে নিচের চ্যানেলে যাও:\n\n👉 @RKRxProofs"
        : "⭐ <b>Reviews & Proofs</b>\n\nCheck out all our reviews, payment proofs and success stories on our channel:\n\n👉 @RKRxProofs",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "📢 চ্যানেলে যাও" : "📢 Open Channel", url: "https://t.me/RKRxProofs" }],
            [{ text: `⬅️ ${lang === "bn" ? "ফিরে যাও" : "Back"}`, callback_data: "back_main" }],
          ],
        },
      });
    return true;
  }

  if (data === "get_offers") { await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "website_login") { await handleLoginCode(BOT_TOKEN, supabase, chatId, userId, lang); return true; }

  // Email management
  if (data === "set_email") {
    const { handleSetEmailCommand } = await import("../email-handler.ts");
    await handleSetEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }
  if (data === "my_email") {
    const { handleMyEmailCommand } = await import("../email-handler.ts");
    await handleMyEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }
  if (data === "remove_email") {
    const { removeEmail } = await import("../email-handler.ts");
    await removeEmail(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }
  if (data === "resend_email_otp") {
    const { resendEmailOtp } = await import("../email-handler.ts");
    await resendEmailOtp(BOT_TOKEN, supabase, chatId, userId, lang);
    return true;
  }

  if (data === "back_main") { await showMainMenu(BOT_TOKEN, supabase, chatId, lang); return true; }
  if (data === "back_products") { await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); return true; }

  // Resale
  if (data.startsWith("resale_")) { await handleResaleStart(BOT_TOKEN, supabase, chatId, userId, data.replace("resale_", ""), null, lang); return true; }
  if (data.startsWith("resalevar_")) { await handleResaleVariationStart(BOT_TOKEN, supabase, chatId, userId, data.replace("resalevar_", ""), lang); return true; }

  return false;
}
