// Bilingual messages for email handler
export const M = {
  setEmailPrompt: (lang: string) => lang === "bn"
    ? `📧 <b>আপনার ইমেইল সেট করুন</b>\n\nঅর্ডার কনফার্মেশন, ডেলিভারি লিঙ্ক / ID-Password এবং অন্যান্য আপডেট ইমেইলে পেতে আপনার ইমেইল লিখুন।\n\n🔐 ভেরিফিকেশনের জন্য একটি ৬-সংখ্যার কোড পাঠানো হবে।\n\n📨 আপনার ইমেইল লিখুন:\n\n❌ বাতিল করতে /cancel`
    : `📧 <b>Set Up Your Email</b>\n\nGet order confirmations, delivery details (links / ID & passwords), and account updates straight to your inbox.\n\n🔐 We'll send a 6-digit verification code to your email.\n\n📨 Reply with your email address:\n\n❌ Send /cancel to abort`,
  noEmail: (lang: string) => lang === "bn"
    ? `📭 কোনো ইমেইল সেট করা নেই।\n\n👉 /setemail কমান্ড দিয়ে এখনই সেট করুন।`
    : `📭 No email set yet.\n\n👉 Use /setemail to add one now.`,
  pendingMsg: (lang: string, pending: string) => lang === "bn"
    ? `⏳ <b>ভেরিফিকেশন অপেক্ষমান</b>\n\n<code>${pending}</code>\n\nএই ইমেইলে পাঠানো ৬-সংখ্যার কোড লিখুন।`
    : `⏳ <b>Verification pending</b>\n\n<code>${pending}</code>\n\nReply with the 6-digit code sent to this email.`,
  verifiedMsg: (lang: string, email: string) => lang === "bn"
    ? `✅ <b>ভেরিফায়েড ইমেইল</b>\n\n<code>${email}</code>\n\nএই ইমেইলে অর্ডার ও ডেলিভারির আপডেট পাঠানো হবে। আপনি এই ইমেইল দিয়ে ওয়েবসাইটেও লগইন করতে পারবেন।`
    : `✅ <b>Verified Email</b>\n\n<code>${email}</code>\n\nOrder & delivery updates will be sent here. You can also log in to the website with this email.`,
  invalidEmail: (lang: string) => lang === "bn" ? `❌ অবৈধ ইমেইল। আবার চেষ্টা করুন অথবা /cancel লিখুন।` : `❌ Invalid email. Please try again or send /cancel.`,
  saveFailed: (lang: string) => lang === "bn" ? `❌ সংরক্ষণ ব্যর্থ। আবার চেষ্টা করুন।` : `❌ Failed to save. Please try again.`,
  sendFailed: (lang: string, reason: string) => lang === "bn"
    ? `⚠️ ইমেইল পাঠানো যায়নি (${reason})। ইমেইলটি সঠিক কিনা চেক করুন এবং আবার চেষ্টা করুন।`
    : `⚠️ Couldn't send email (${reason}). Please double-check the address and try again.`,
  otpSent: (lang: string, email: string) => lang === "bn"
    ? `📨 <b>ভেরিফিকেশন কোড পাঠানো হয়েছে</b>\n\n<code>${email}</code>\n\nএই ইমেইলে একটি ৬-সংখ্যার কোড পাঠানো হয়েছে। ইনবক্স / স্প্যাম চেক করে কোডটি লিখুন।\n\n⏱️ মেয়াদ: ১০ মিনিট\n\n❌ বাতিল করতে /cancel`
    : `📨 <b>Verification code sent</b>\n\n<code>${email}</code>\n\nA 6-digit code has been sent. Check your inbox / spam and reply with the code.\n\n⏱️ Expires in 10 minutes\n\n❌ Send /cancel to abort`,
  invalidCode: (lang: string) => lang === "bn" ? `❌ অবৈধ ফরম্যাট। ৬-সংখ্যার কোড পাঠান অথবা /cancel লিখুন।` : `❌ Invalid format. Send the 6-digit code or /cancel.`,
  noPending: (lang: string) => lang === "bn" ? `⚠️ কোনো ভেরিফিকেশন বাকি নেই। আবার /setemail চালু করুন।` : `⚠️ No pending verification. Start over with /setemail.`,
  expired: (lang: string) => lang === "bn" ? `⏰ কোডের মেয়াদ শেষ। নতুন কোডের জন্য /setemail চালু করুন।` : `⏰ Code expired. Start /setemail again for a fresh code.`,
  tooMany: (lang: string) => lang === "bn" ? `🚫 অনেক ভুল চেষ্টা। আবার /setemail চালু করুন।` : `🚫 Too many wrong attempts. Start /setemail again.`,
  wrongCode: (lang: string, left: number) => lang === "bn" ? `❌ ভুল কোড। বাকি চেষ্টা: ${left}` : `❌ Wrong code. Attempts left: ${left}`,
  verified: (lang: string, email: string) => lang === "bn"
    ? `✅ <b>ইমেইল ভেরিফায়েড!</b>\n\n<code>${email}</code>\n\nএখন থেকে আপনি অর্ডার / ডেলিভারি আপডেট ইমেইলে পাবেন। আপনি চাইলে এই ইমেইল দিয়ে ওয়েবসাইটেও লগইন করতে পারবেন (Forgot Password ব্যবহার করে পাসওয়ার্ড সেট করুন)।`
    : `✅ <b>Email verified!</b>\n\n<code>${email}</code>\n\nYou'll now receive order & delivery updates by email. You can also log in to the website with this email — just use "Forgot Password" to set one.`,
  noPendingResend: (lang: string) => lang === "bn" ? `⚠️ কোনো ভেরিফিকেশন বাকি নেই। /setemail চালু করুন।` : `⚠️ No pending verification. Start /setemail.`,
  removed: (lang: string) => lang === "bn" ? `🗑️ ইমেইল সরানো হয়েছে। আর কোনো ইমেইল নোটিফিকেশন পাঠানো হবে না।` : `🗑️ Email removed. No more email notifications will be sent.`,
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export function genOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
