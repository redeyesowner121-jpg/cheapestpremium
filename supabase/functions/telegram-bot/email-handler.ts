// /setemail and /myemail commands for telegram bot users — with OTP verification
import { sendMessage } from "./telegram-api.ts";
import { setConversationState, deleteConversationState } from "./db-helpers.ts";
import { sendBotEmailToAddress } from "../_shared/bot-email.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function genOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function handleSetEmailCommand(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string,
  inlineEmail?: string
) {
  if (inlineEmail && inlineEmail.length > 0) {
    return startEmailVerification(token, supabase, chatId, userId, lang, inlineEmail);
  }
  await setConversationState(supabase, userId, "awaiting_email", {});
  const msg = lang === "bn"
    ? `📧 <b>আপনার ইমেইল সেট করুন</b>\n\nঅর্ডার কনফার্মেশন, ডেলিভারি লিঙ্ক / ID-Password এবং অন্যান্য আপডেট ইমেইলে পেতে আপনার ইমেইল লিখুন।\n\n🔐 ভেরিফিকেশনের জন্য একটি ৬-সংখ্যার কোড পাঠানো হবে।\n\n📨 আপনার ইমেইল লিখুন:\n\n❌ বাতিল করতে /cancel`
    : `📧 <b>Set Up Your Email</b>\n\nGet order confirmations, delivery details (links / ID & passwords), and account updates straight to your inbox.\n\n🔐 We'll send a 6-digit verification code to your email.\n\n📨 Reply with your email address:\n\n❌ Send /cancel to abort`;
  await sendMessage(token, chatId, msg);
}

export async function handleMyEmailCommand(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string
) {
  const { data } = await supabase
    .from("telegram_bot_users")
    .select("email, email_verified, pending_email")
    .eq("telegram_id", userId)
    .maybeSingle();
  const email = (data?.email || "").trim();
  const pending = (data?.pending_email || "").trim();

  if (!email && !pending) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? `📭 কোনো ইমেইল সেট করা নেই।\n\n👉 /setemail কমান্ড দিয়ে এখনই সেট করুন।`
        : `📭 No email set yet.\n\n👉 Use /setemail to add one now.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: lang === "bn" ? "📧 ইমেইল সেট করুন" : "📧 Set Email", callback_data: "set_email" }]],
        },
      }
    );
    return;
  }

  if (!email && pending) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? `⏳ <b>ভেরিফিকেশন অপেক্ষমান</b>\n\n<code>${pending}</code>\n\nএই ইমেইলে পাঠানো ৬-সংখ্যার কোড লিখুন।`
        : `⏳ <b>Verification pending</b>\n\n<code>${pending}</code>\n\nReply with the 6-digit code sent to this email.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "🔁 কোড পুনরায় পাঠান" : "🔁 Resend Code", callback_data: "resend_email_otp" }],
            [{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "remove_email" }],
          ],
        },
      }
    );
    return;
  }

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>ভেরিফায়েড ইমেইল</b>\n\n<code>${email}</code>\n\nএই ইমেইলে অর্ডার ও ডেলিভারির আপডেট পাঠানো হবে। আপনি এই ইমেইল দিয়ে ওয়েবসাইটেও লগইন করতে পারবেন।`
      : `✅ <b>Verified Email</b>\n\n<code>${email}</code>\n\nOrder & delivery updates will be sent here. You can also log in to the website with this email.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "✏️ পরিবর্তন করুন" : "✏️ Change Email", callback_data: "set_email" }],
          [{ text: lang === "bn" ? "🗑️ সরান" : "🗑️ Remove", callback_data: "remove_email" }],
        ],
      },
    }
  );
}

// Step 1: User submitted email → generate OTP, store, send email
export async function startEmailVerification(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string,
  rawInput: string
) {
  const email = rawInput.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ অবৈধ ইমেইল। আবার চেষ্টা করুন অথবা /cancel লিখুন।`
                    : `❌ Invalid email. Please try again or send /cancel.`
    );
    return;
  }

  const otp = genOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error } = await supabase
    .from("telegram_bot_users")
    .upsert(
      {
        telegram_id: userId,
        pending_email: email,
        email_otp_code: otp,
        email_otp_expires_at: expiresAt,
        email_otp_attempts: 0,
      },
      { onConflict: "telegram_id" }
    );

  if (error) {
    console.error("[setEmail] upsert error:", error);
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ সংরক্ষণ ব্যর্থ। আবার চেষ্টা করুন।` : `❌ Failed to save. Please try again.`
    );
    return;
  }

  // Send the OTP email
  const sendResult = await sendBotEmailToAddress(
    supabase,
    email,
    `Your verification code: ${otp}`,
    {
      title: "Verify your email",
      preheader: `Your code is ${otp}`,
      badge: { text: "Action Required", color: "#f59e0b" },
      intro: `Use the code below to link this email to your Telegram account on Cheapest-Premium.in. This code expires in 10 minutes.`,
      blocks: [
        { label: "Verification Code", value: otp, mono: true },
        { label: "Telegram ID", value: String(userId), mono: true },
      ],
      warning: "If you did not request this code, you can safely ignore this email.",
    },
    { template: "bot_email_otp", telegram_id: userId }
  );

  if (!sendResult.ok) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? `⚠️ ইমেইল পাঠানো যায়নি (${sendResult.reason || "unknown"})। ইমেইলটি সঠিক কিনা চেক করুন এবং আবার চেষ্টা করুন।`
        : `⚠️ Couldn't send email (${sendResult.reason || "unknown"}). Please double-check the address and try again.`
    );
    await deleteConversationState(supabase, userId);
    return;
  }

  await setConversationState(supabase, userId, "awaiting_email_otp", { email });
  await sendMessage(token, chatId,
    lang === "bn"
      ? `📨 <b>ভেরিফিকেশন কোড পাঠানো হয়েছে</b>\n\n<code>${email}</code>\n\nএই ইমেইলে একটি ৬-সংখ্যার কোড পাঠানো হয়েছে। ইনবক্স / স্প্যাম চেক করে কোডটি লিখুন।\n\n⏱️ মেয়াদ: ১০ মিনিট\n\n❌ বাতিল করতে /cancel`
      : `📨 <b>Verification code sent</b>\n\n<code>${email}</code>\n\nA 6-digit code has been sent. Check your inbox / spam and reply with the code.\n\n⏱️ Expires in 10 minutes\n\n❌ Send /cancel to abort`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "🔁 কোড পুনরায় পাঠান" : "🔁 Resend Code", callback_data: "resend_email_otp" }],
        ],
      },
    }
  );
}

// Step 2: User submitted OTP code
export async function verifyEmailOtp(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string,
  rawCode: string
) {
  const code = rawCode.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ অবৈধ ফরম্যাট। ৬-সংখ্যার কোড পাঠান অথবা /cancel লিখুন।`
                    : `❌ Invalid format. Send the 6-digit code or /cancel.`
    );
    return;
  }

  const { data: row } = await supabase
    .from("telegram_bot_users")
    .select("pending_email, email_otp_code, email_otp_expires_at, email_otp_attempts")
    .eq("telegram_id", userId)
    .maybeSingle();

  if (!row?.pending_email || !row?.email_otp_code) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId,
      lang === "bn" ? `⚠️ কোনো ভেরিফিকেশন বাকি নেই। আবার /setemail চালু করুন।`
                    : `⚠️ No pending verification. Start over with /setemail.`
    );
    return;
  }

  const expired = row.email_otp_expires_at && new Date(row.email_otp_expires_at).getTime() < Date.now();
  if (expired) {
    await supabase.from("telegram_bot_users")
      .update({ email_otp_code: null, email_otp_expires_at: null, pending_email: null, email_otp_attempts: 0 })
      .eq("telegram_id", userId);
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId,
      lang === "bn" ? `⏰ কোডের মেয়াদ শেষ। নতুন কোডের জন্য /setemail চালু করুন।`
                    : `⏰ Code expired. Start /setemail again for a fresh code.`
    );
    return;
  }

  if ((row.email_otp_attempts ?? 0) >= MAX_ATTEMPTS) {
    await supabase.from("telegram_bot_users")
      .update({ email_otp_code: null, email_otp_expires_at: null, pending_email: null, email_otp_attempts: 0 })
      .eq("telegram_id", userId);
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId,
      lang === "bn" ? `🚫 অনেক ভুল চেষ্টা। আবার /setemail চালু করুন।`
                    : `🚫 Too many wrong attempts. Start /setemail again.`
    );
    return;
  }

  if (code !== row.email_otp_code) {
    await supabase.from("telegram_bot_users")
      .update({ email_otp_attempts: (row.email_otp_attempts ?? 0) + 1 })
      .eq("telegram_id", userId);
    const left = MAX_ATTEMPTS - ((row.email_otp_attempts ?? 0) + 1);
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ ভুল কোড। বাকি চেষ্টা: ${left}` : `❌ Wrong code. Attempts left: ${left}`
    );
    return;
  }

  // ✅ Success — attach email
  const verifiedEmail = row.pending_email;
  const { error: upErr } = await supabase
    .from("telegram_bot_users")
    .update({
      email: verifiedEmail,
      email_verified: true,
      pending_email: null,
      email_otp_code: null,
      email_otp_expires_at: null,
      email_otp_attempts: 0,
    })
    .eq("telegram_id", userId);

  if (upErr) {
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ সংরক্ষণ ব্যর্থ। আবার চেষ্টা করুন।` : `❌ Failed to save. Please try again.`
    );
    return;
  }

  await deleteConversationState(supabase, userId);

  // Welcome confirmation email
  try {
    await sendBotEmailToAddress(supabase, verifiedEmail,
      "✅ Email connected to Cheapest-Premium.in",
      {
        title: "Email connected successfully!",
        preheader: "You'll now receive order updates from Cheapest-Premium.in",
        badge: { text: "Verified", color: "#10b981" },
        intro: `Your email has been linked to your Telegram account. From now on you'll get order confirmations, delivery details (links / ID & passwords), and important updates here. You can also log in to our website using this email.`,
        blocks: [{ label: "Connected Email", value: verifiedEmail, mono: true }],
        ctaButton: { label: "Visit Website", url: "https://cheapest-premiums.in" },
      },
      { template: "bot_email_welcome", telegram_id: userId }
    );
  } catch (_) {}

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>ইমেইল ভেরিফায়েড!</b>\n\n<code>${verifiedEmail}</code>\n\nএখন থেকে আপনি অর্ডার / ডেলিভারি আপডেট ইমেইলে পাবেন। আপনি চাইলে এই ইমেইল দিয়ে ওয়েবসাইটেও লগইন করতে পারবেন (Forgot Password ব্যবহার করে পাসওয়ার্ড সেট করুন)।`
      : `✅ <b>Email verified!</b>\n\n<code>${verifiedEmail}</code>\n\nYou'll now receive order & delivery updates by email. You can also log in to the website with this email — just use "Forgot Password" to set one.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "🌐 ওয়েবসাইট খুলুন" : "🌐 Open Website", url: "https://cheapest-premiums.in" }],
          [{ text: lang === "bn" ? "🏠 মেইন মেনু" : "🏠 Main Menu", callback_data: "back_main" }],
        ],
      },
    }
  );
}

// Resend OTP for the existing pending email
export async function resendEmailOtp(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string
) {
  const { data: row } = await supabase
    .from("telegram_bot_users")
    .select("pending_email")
    .eq("telegram_id", userId)
    .maybeSingle();
  const pending = (row?.pending_email || "").trim();
  if (!pending) {
    await sendMessage(token, chatId,
      lang === "bn" ? `⚠️ কোনো ভেরিফিকেশন বাকি নেই। /setemail চালু করুন।`
                    : `⚠️ No pending verification. Start /setemail.`
    );
    return;
  }
  await startEmailVerification(token, supabase, chatId, userId, lang, pending);
}

export async function removeEmail(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string
) {
  await supabase
    .from("telegram_bot_users")
    .update({
      email: null,
      email_verified: false,
      pending_email: null,
      email_otp_code: null,
      email_otp_expires_at: null,
      email_otp_attempts: 0,
    })
    .eq("telegram_id", userId);

  await deleteConversationState(supabase, userId);
  await sendMessage(token, chatId,
    lang === "bn"
      ? `🗑️ ইমেইল সরানো হয়েছে। আর কোনো ইমেইল নোটিফিকেশন পাঠানো হবে না।`
      : `🗑️ Email removed. No more email notifications will be sent.`
  );
}

// Backward-compat shim (older code may still import this)
export const saveEmail = startEmailVerification;
