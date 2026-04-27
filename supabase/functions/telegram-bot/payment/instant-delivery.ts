// ===== INSTANT DELIVERY HELPER =====
// Refactored: split into ./delivery-resolve.ts, ./delivery-stock.ts, ./delivery-email.ts
// This file holds the main send-to-user logic + barrel re-exports of the helpers.

import { sendMessage } from "../telegram-api.ts";
import { isChildBotMode } from "../child-context.ts";
import { sendDeliveryEmail } from "./delivery-email.ts";

// Re-export resolver for backward compatibility
export { resolveAccessLink } from "./delivery-resolve.ts";

function isDriveLink(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com|googleapis\.com/i.test(url);
}

/**
 * Generate a 6-digit login code, save to DB, and send delivery to user.
 * - Drive links: Only show "View on Website" button (no direct link) — UNLESS child bot mode
 * - Other links: Send directly in bot message
 * - Child bot mode: Send credentials only, NO website link
 */
export async function sendInstantDeliveryWithLoginCode(
  token: string,
  supabase: any,
  chatId: number,
  telegramId: number,
  accessLink: string,
  productName: string,
  lang: string,
  deliveryMessage?: string | null
) {
  const childMode = isChildBotMode();

  // Generate 6-digit login code (skip for child bots — no website access)
  let code: string | null = null;
  if (!childMode) {
    code = String(Math.floor(100000 + Math.random() * 900000));
  }
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  let username: string | null = null;
  let firstName: string | null = null;
  if (!childMode) {
    try {
      const { data: botUser } = await supabase
        .from("telegram_bot_users")
        .select("username, first_name")
        .eq("telegram_id", telegramId)
        .maybeSingle();
      username = botUser?.username || null;
      firstName = botUser?.first_name || null;
    } catch {}

    try {
      await supabase.from("telegram_login_codes").insert({
        telegram_id: telegramId,
        code,
        expires_at: expiresAt,
        username,
        first_name: firstName,
      });
    } catch (e) {
      console.error("Login code insert error:", e);
    }
  }

  const websiteUrl = childMode ? null : `https://cheapest-premiums.in/telegram/auth?code=${code}`;

  if (isDriveLink(accessLink)) {
    let driveMsg: string;
    const inlineKeyboard: any[][] = [];
    if (childMode) {
      driveMsg = lang === "bn"
        ? `✅ <b>${productName} ডেলিভারি সম্পন্ন!</b>\n\n📁 আপনার ফাইল/লিঙ্ক প্রস্তুত। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।`
        : `✅ <b>${productName} Delivered!</b>\n\n📁 Your file/link is ready. Contact support for assistance.`;
    } else {
      driveMsg = lang === "bn"
        ? `✅ <b>${productName} ডেলিভারি সম্পন্ন!</b>\n\n` +
          `📁 আপনার ফাইল/লিঙ্ক ওয়েবসাইটে আপনার অর্ডার হিস্ট্রিতে পাবেন।\n\n` +
          `🔑 লগইন কোড: <code>${code}</code>\n` +
          `⏳ কোড ৩০ মিনিট পর্যন্ত কার্যকর।`
        : `✅ <b>${productName} Delivered!</b>\n\n` +
          `📁 Your file/link is available in your order history on the website.\n\n` +
          `🔑 Login Code: <code>${code}</code>\n` +
          `⏳ Code valid for 30 minutes.`;
      inlineKeyboard.push([{ text: "🌐 View on Website", url: websiteUrl! }]);
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: driveMsg,
        parse_mode: "HTML",
        ...(inlineKeyboard.length ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
      }),
    });
  } else {
    const isMultiline = accessLink.includes('\n');
    const { parseCredential } = await import('./credential-otp.ts');
    const parsed = parseCredential(accessLink);
    const has2FA = !!parsed.twoFASecret;

    const visibleAccess = accessLink
      .split('\n')
      .filter((line) => !/^\s*(2fa|two[-\s]?fa|totp|otp\s*secret|secret)\s*[:=]/i.test(line))
      .join('\n')
      .trim();

    const escapeHtml = (s: string) =>
      s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));

    let body: string;
    if (parsed.email && parsed.password) {
      const emailLabel = lang === 'bn' ? '📧 ইমেইল/আইডি' : '📧 Email / ID';
      const passLabel = lang === 'bn' ? '🔒 পাসওয়ার্ড' : '🔒 Password';
      body = `${emailLabel}:\n<code>${escapeHtml(parsed.email)}</code>\n\n${passLabel}:\n<code>${escapeHtml(parsed.password)}</code>`;
      if (parsed.link) {
        const linkLabel = lang === 'bn' ? '🔗 লিঙ্ক' : '🔗 Link';
        body += `\n\n${linkLabel}:\n<code>${escapeHtml(parsed.link)}</code>`;
      }
    } else if (isMultiline) {
      body = `<pre>${escapeHtml(visibleAccess)}</pre>`;
    } else {
      body = `<code>${escapeHtml(visibleAccess)}</code>`;
    }

    const twoFANote = has2FA
      ? (lang === 'bn'
          ? `\n\n💡 নিচের <b>"🔐 Get OTP"</b> বাটনে ক্লিক করে লাইভ ৬-সংখ্যার ২FA কোড পান।`
          : `\n\n💡 Tap <b>"🔐 Get OTP"</b> below to get a live 6-digit 2FA code.`)
      : '';

    const loginCodeLine = childMode
      ? ''
      : (lang === 'bn'
          ? `\n\n🔑 লগইন কোড: <code>${code}</code>`
          : `\n\n🔑 Login Code: <code>${code}</code>`);

    const directMsg = lang === "bn"
      ? `✅ <b>${productName} ডেলিভারি সম্পন্ন!</b>\n\n` +
        `🔗 <b>আপনার অ্যাক্সেস:</b>\n${body}${loginCodeLine}${twoFANote}`
      : `✅ <b>${productName} Delivered!</b>\n\n` +
        `🔗 <b>Your Access:</b>\n${body}${loginCodeLine}${twoFANote}`;

    const keyboardRows: any[][] = [];
    if (has2FA) {
      const secret = parsed.twoFASecret!.toUpperCase().replace(/\s+/g, '');
      const cbData = `otp_${secret}`.slice(0, 64);
      keyboardRows.push([
        { text: lang === 'bn' ? '🔐 OTP নিন' : '🔐 Get OTP', callback_data: cbData },
      ]);
    }
    if (!childMode) {
      keyboardRows.push([{ text: '🌐 View on Website', url: websiteUrl! }]);
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: directMsg,
        parse_mode: "HTML",
        ...(keyboardRows.length ? { reply_markup: { inline_keyboard: keyboardRows } } : {}),
      }),
    });
  }

  if (deliveryMessage?.trim()) {
    await sendMessage(token, chatId, `📝 ${deliveryMessage}`);
  }

  // Email copy of the delivery (best-effort)
  await sendDeliveryEmail(supabase, telegramId, productName, accessLink);
}
