// ===== INSTANT DELIVERY HELPER =====
// Generates a login code and sends website link + access link to user after instant delivery

import { sendMessage } from "../telegram-api.ts";

function isDriveLink(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com|googleapis\.com/i.test(url);
}

/**
 * Generate a 6-digit login code, save to DB, and send delivery to user.
 * - Drive links: Only show "View on Website" button (no direct link)
 * - Other links: Send directly in bot message
 */
export async function sendInstantDeliveryWithLoginCode(
  token: string,
  supabase: any,
  chatId: number,
  telegramId: number,
  accessLink: string,
  productName: string,
  lang: string
) {
  // Generate 6-digit login code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min expiry

  // Get user info for login code
  let username: string | null = null;
  let firstName: string | null = null;
  try {
    const { data: botUser } = await supabase
      .from("telegram_bot_users")
      .select("username, first_name")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    username = botUser?.username || null;
    firstName = botUser?.first_name || null;
  } catch {}

  // Save login code
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

  const websiteUrl = "https://cheapest-premiums.lovable.app/auth";

  if (isDriveLink(accessLink)) {
    // Drive link → only show website button, don't send link directly
    const driveMsg = lang === "bn"
      ? `✅ <b>${productName} ডেলিভারি সম্পন্ন!</b>\n\n` +
        `📁 আপনার ফাইল/লিঙ্ক ওয়েবসাইটে আপনার অর্ডার হিস্ট্রিতে পাবেন।\n\n` +
        `🔑 লগইন কোড: <code>${code}</code>\n` +
        `⏳ কোড ৩০ মিনিট পর্যন্ত কার্যকর।`
      : `✅ <b>${productName} Delivered!</b>\n\n` +
        `📁 Your file/link is available in your order history on the website.\n\n` +
        `🔑 Login Code: <code>${code}</code>\n` +
        `⏳ Code valid for 30 minutes.`;

    // Send with inline button to website
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: driveMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🌐 View on Website", url: websiteUrl }
          ]]
        }
      }),
    });
  } else {
    // Non-drive link → send directly
    const directMsg = lang === "bn"
      ? `✅ <b>${productName} ডেলিভারি সম্পন্ন!</b>\n\n` +
        `🔗 <b>আপনার অ্যাক্সেস:</b>\n<code>${accessLink}</code>\n\n` +
        `📋 ওয়েবসাইটেও দেখতে পারবেন:\n` +
        `🔑 লগইন কোড: <code>${code}</code>`
      : `✅ <b>${productName} Delivered!</b>\n\n` +
        `🔗 <b>Your Access:</b>\n<code>${accessLink}</code>\n\n` +
        `📋 Also available on the website:\n` +
        `🔑 Login Code: <code>${code}</code>`;

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: directMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🌐 View on Website", url: websiteUrl }
          ]]
        }
      }),
    });
  }
}
