// /setemail and /myemail commands for telegram bot users
import { sendMessage } from "./telegram-api.ts";
import { setConversationState, deleteConversationState } from "./db-helpers.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleSetEmailCommand(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string,
  inlineEmail?: string
) {
  // If email passed inline (e.g. /setemail foo@bar.com), save directly
  if (inlineEmail && inlineEmail.length > 0) {
    return saveEmail(token, supabase, chatId, userId, lang, inlineEmail);
  }

  await setConversationState(supabase, userId, "awaiting_email", {});
  const msg = lang === "bn"
    ? `📧 <b>আপনার ইমেইল সেট করুন</b>\n\nঅর্ডার কনফার্মেশন, ডেলিভারি লিঙ্ক / ID-Password এবং অন্যান্য আপডেট পেতে আপনার ইমেইল পাঠান।\n\n📨 আপনার ইমেইল লিখুন:\n\n❌ বাতিল করতে /cancel`
    : `📧 <b>Set Up Your Email</b>\n\nGet order confirmations, delivery links / ID-Password, and other updates straight to your inbox.\n\n📨 Reply with your email address:\n\n❌ Send /cancel to abort`;
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
    .select("email")
    .eq("telegram_id", userId)
    .maybeSingle();
  const email = (data?.email || "").trim();

  if (!email) {
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

  await sendMessage(token, chatId,
    lang === "bn"
      ? `📧 <b>আপনার ইমেইল</b>\n\n<code>${email}</code>\n\nএই ইমেইলে অর্ডার ও ডেলিভারির আপডেট পাঠানো হবে।`
      : `📧 <b>Your Email</b>\n\n<code>${email}</code>\n\nOrder & delivery updates will be sent here.`,
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

export async function saveEmail(
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
      lang === "bn"
        ? `❌ অবৈধ ইমেইল। আবার চেষ্টা করুন অথবা /cancel লিখুন।`
        : `❌ Invalid email. Please try again or send /cancel.`
    );
    return;
  }

  // Ensure user row exists
  const { error } = await supabase
    .from("telegram_bot_users")
    .upsert(
      { telegram_id: userId, email, email_verified: false },
      { onConflict: "telegram_id" }
    );

  if (error) {
    console.error("[setEmail] upsert error:", error);
    await sendMessage(token, chatId,
      lang === "bn" ? `❌ সংরক্ষণ ব্যর্থ। আবার চেষ্টা করুন।` : `❌ Failed to save. Please try again.`
    );
    return;
  }

  await deleteConversationState(supabase, userId);

  // Send a quick test/welcome email so the user can confirm it works
  try {
    const { sendBotUserEmail } = await import("../_shared/bot-email.ts");
    await sendBotUserEmail(
      supabase,
      userId,
      "✅ Email connected to Cheapest-Premium.in",
      {
        title: "Email connected successfully!",
        preheader: "You'll now receive order updates from Cheapest-Premium.in",
        badge: { text: "Verified", color: "#10b981" },
        intro: `Your email has been linked to your Telegram account on Cheapest-Premium.in. From now on you'll get order confirmations, delivery details (links / ID & passwords), and important account notifications straight to this inbox.`,
        blocks: [
          { label: "Connected Email", value: email, mono: true },
        ],
        ctaButton: { label: "Visit Website", url: "https://cheapest-premiums.in" },
      },
      { template: "bot_email_welcome" }
    );
  } catch (e) {
    console.error("[setEmail] welcome email failed:", e);
  }

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>ইমেইল সেভ হয়েছে!</b>\n\n<code>${email}</code>\n\n📬 একটি ওয়েলকাম ইমেইল পাঠানো হয়েছে — চেক করুন (ইনবক্স/স্প্যাম)।`
      : `✅ <b>Email saved!</b>\n\n<code>${email}</code>\n\n📬 A welcome email has been sent — check your inbox (or spam).`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: lang === "bn" ? "🏠 মেইন মেনু" : "🏠 Main Menu", callback_data: "back_main" }]],
      },
    }
  );
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
    .update({ email: null, email_verified: false })
    .eq("telegram_id", userId);

  await sendMessage(token, chatId,
    lang === "bn"
      ? `🗑️ ইমেইল সরানো হয়েছে। আর কোনো ইমেইল নোটিফিকেশন পাঠানো হবে না।`
      : `🗑️ Email removed. No more email notifications will be sent.`
  );
}
