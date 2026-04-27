// /setemail and /myemail commands for telegram bot users — with OTP verification
import { sendMessage } from "./telegram-api.ts";
import { setConversationState, deleteConversationState } from "./db-helpers.ts";
import { M } from "./email/_messages.ts";
import { startEmailVerification, verifyEmailOtp } from "./email/_otp.ts";

export { startEmailVerification, verifyEmailOtp };

export async function handleSetEmailCommand(
  token: string, supabase: any, chatId: number, userId: number, lang: string, inlineEmail?: string
) {
  if (inlineEmail && inlineEmail.length > 0) {
    return startEmailVerification(token, supabase, chatId, userId, lang, inlineEmail);
  }
  await setConversationState(supabase, userId, "awaiting_email", {});
  await sendMessage(token, chatId, M.setEmailPrompt(lang));
}

export async function handleMyEmailCommand(
  token: string, supabase: any, chatId: number, userId: number, lang: string
) {
  const { data } = await supabase.from("telegram_bot_users")
    .select("email, email_verified, pending_email").eq("telegram_id", userId).maybeSingle();
  const email = (data?.email || "").trim();
  const pending = (data?.pending_email || "").trim();

  if (!email && !pending) {
    await sendMessage(token, chatId, M.noEmail(lang), {
      reply_markup: { inline_keyboard: [
        [{ text: lang === "bn" ? "📧 ইমেইল সেট করুন" : "📧 Set Email", callback_data: "set_email" }],
      ]},
    });
    return;
  }

  if (!email && pending) {
    await sendMessage(token, chatId, M.pendingMsg(lang, pending), {
      reply_markup: { inline_keyboard: [
        [{ text: lang === "bn" ? "🔁 কোড পুনরায় পাঠান" : "🔁 Resend Code", callback_data: "resend_email_otp" }],
        [{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "remove_email" }],
      ]},
    });
    return;
  }

  await sendMessage(token, chatId, M.verifiedMsg(lang, email), {
    reply_markup: { inline_keyboard: [
      [{ text: lang === "bn" ? "✏️ পরিবর্তন করুন" : "✏️ Change Email", callback_data: "set_email" }],
      [{ text: lang === "bn" ? "🗑️ সরান" : "🗑️ Remove", callback_data: "remove_email" }],
    ]},
  });
}

export async function resendEmailOtp(
  token: string, supabase: any, chatId: number, userId: number, lang: string
) {
  const { data: row } = await supabase.from("telegram_bot_users")
    .select("pending_email").eq("telegram_id", userId).maybeSingle();
  const pending = (row?.pending_email || "").trim();
  if (!pending) {
    await sendMessage(token, chatId, M.noPendingResend(lang));
    return;
  }
  await startEmailVerification(token, supabase, chatId, userId, lang, pending);
}

export async function removeEmail(
  token: string, supabase: any, chatId: number, userId: number, lang: string
) {
  await supabase.from("telegram_bot_users").update({
    email: null, email_verified: false, pending_email: null,
    email_otp_code: null, email_otp_expires_at: null, email_otp_attempts: 0,
  }).eq("telegram_id", userId);

  await deleteConversationState(supabase, userId);
  await sendMessage(token, chatId, M.removed(lang));
}

// Backward-compat shim
export const saveEmail = startEmailVerification;
