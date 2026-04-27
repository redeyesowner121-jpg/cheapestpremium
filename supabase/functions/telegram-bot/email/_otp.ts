// OTP generation, sending, and verification logic
import { sendMessage } from "../telegram-api.ts";
import { setConversationState, deleteConversationState } from "../db-helpers.ts";
import { sendBotEmailToAddress } from "../../_shared/bot-email.ts";
import { M, EMAIL_RE, OTP_TTL_MS, MAX_ATTEMPTS, genOtp } from "./_messages.ts";

export async function startEmailVerification(
  token: string, supabase: any, chatId: number, userId: number, lang: string, rawInput: string
) {
  const email = rawInput.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    await sendMessage(token, chatId, M.invalidEmail(lang));
    return;
  }

  const otp = genOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error } = await supabase.from("telegram_bot_users").upsert({
    telegram_id: userId, pending_email: email, email_otp_code: otp,
    email_otp_expires_at: expiresAt, email_otp_attempts: 0,
  }, { onConflict: "telegram_id" });

  if (error) {
    console.error("[setEmail] upsert error:", error);
    await sendMessage(token, chatId, M.saveFailed(lang));
    return;
  }

  const sendResult = await sendBotEmailToAddress(supabase, email, `Your verification code: ${otp}`, {
    title: "Verify your email",
    preheader: `Your code is ${otp}`,
    badge: { text: "Action Required", color: "#f59e0b" },
    intro: `Use the code below to link this email to your Telegram account on Cheapest-Premium.in. This code expires in 10 minutes.`,
    blocks: [
      { label: "Verification Code", value: otp, mono: true },
      { label: "Telegram ID", value: String(userId), mono: true },
    ],
    warning: "If you did not request this code, you can safely ignore this email.",
  }, { template: "bot_email_otp", telegram_id: userId });

  if (!sendResult.ok) {
    await sendMessage(token, chatId, M.sendFailed(lang, sendResult.reason || "unknown"));
    await deleteConversationState(supabase, userId);
    return;
  }

  await setConversationState(supabase, userId, "awaiting_email_otp", { email });
  await sendMessage(token, chatId, M.otpSent(lang, email), {
    reply_markup: { inline_keyboard: [
      [{ text: lang === "bn" ? "🔁 কোড পুনরায় পাঠান" : "🔁 Resend Code", callback_data: "resend_email_otp" }],
    ]},
  });
}

export async function verifyEmailOtp(
  token: string, supabase: any, chatId: number, userId: number, lang: string, rawCode: string
) {
  const code = rawCode.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    await sendMessage(token, chatId, M.invalidCode(lang));
    return;
  }

  const { data: row } = await supabase
    .from("telegram_bot_users")
    .select("pending_email, email_otp_code, email_otp_expires_at, email_otp_attempts")
    .eq("telegram_id", userId).maybeSingle();

  if (!row?.pending_email || !row?.email_otp_code) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, M.noPending(lang));
    return;
  }

  const expired = row.email_otp_expires_at && new Date(row.email_otp_expires_at).getTime() < Date.now();
  if (expired) {
    await supabase.from("telegram_bot_users").update({
      email_otp_code: null, email_otp_expires_at: null, pending_email: null, email_otp_attempts: 0,
    }).eq("telegram_id", userId);
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, M.expired(lang));
    return;
  }

  if ((row.email_otp_attempts ?? 0) >= MAX_ATTEMPTS) {
    await supabase.from("telegram_bot_users").update({
      email_otp_code: null, email_otp_expires_at: null, pending_email: null, email_otp_attempts: 0,
    }).eq("telegram_id", userId);
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, M.tooMany(lang));
    return;
  }

  if (code !== row.email_otp_code) {
    await supabase.from("telegram_bot_users")
      .update({ email_otp_attempts: (row.email_otp_attempts ?? 0) + 1 }).eq("telegram_id", userId);
    const left = MAX_ATTEMPTS - ((row.email_otp_attempts ?? 0) + 1);
    await sendMessage(token, chatId, M.wrongCode(lang, left));
    return;
  }

  // Success
  const verifiedEmail = row.pending_email;
  const { error: upErr } = await supabase.from("telegram_bot_users").update({
    email: verifiedEmail, email_verified: true, pending_email: null,
    email_otp_code: null, email_otp_expires_at: null, email_otp_attempts: 0,
  }).eq("telegram_id", userId);

  if (upErr) {
    await sendMessage(token, chatId, M.saveFailed(lang));
    return;
  }

  await deleteConversationState(supabase, userId);

  try {
    const { error: mergeError } = await supabase.rpc("merge_telegram_email_account", {
      _telegram_id: userId, _email: verifiedEmail,
    });
    if (mergeError) console.error("[email-handler] account merge rpc failed:", mergeError);
  } catch (e) { console.error("[email-handler] auto-link failed:", e); }

  try {
    await sendBotEmailToAddress(supabase, verifiedEmail, "✅ Email connected to Cheapest-Premium.in", {
      title: "Email connected successfully!",
      preheader: "You'll now receive order updates from Cheapest-Premium.in",
      badge: { text: "Verified", color: "#10b981" },
      intro: `Your email has been linked to your Telegram account. From now on you'll get order confirmations, delivery details (links / ID & passwords), and important updates here. You can also log in to our website using this email.`,
      blocks: [{ label: "Connected Email", value: verifiedEmail, mono: true }],
      ctaButton: { label: "Visit Website", url: "https://cheapest-premiums.in" },
    }, { template: "bot_email_welcome", telegram_id: userId });
  } catch (_) {}

  await sendMessage(token, chatId, M.verified(lang, verifiedEmail), {
    reply_markup: { inline_keyboard: [
      [{ text: lang === "bn" ? "🌐 ওয়েবসাইট খুলুন" : "🌐 Open Website", url: "https://cheapest-premiums.in" }],
      [{ text: lang === "bn" ? "🏠 মেইন মেনু" : "🏠 Main Menu", callback_data: "back_main" }],
    ]},
  });
}
