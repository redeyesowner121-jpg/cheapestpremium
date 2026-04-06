// ===== INSTANT DELIVERY HELPER =====
// Generates a login code and sends website link + access link to user after instant delivery

import { sendMessage } from "../telegram-api.ts";

/**
 * Generate a 6-digit login code, save to DB, and send website link + access link to user.
 * Call this whenever a product with access_link is delivered (wallet pay, binance, razorpay, admin confirm).
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

  // Get website URL from env or use default
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  // Extract project ref to build website URL
  const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] || "";
  const websiteUrl = "https://cheapest-premiums.lovable.app/auth";

  // Access link is no longer sent directly — user views it on the website

  // Send website login code message
  const loginMsg = lang === "bn"
    ? `🌐 <b>ওয়েবসাইটে লগইন করুন</b>\n\n` +
      `আপনার অর্ডার হিস্টরি দেখতে ওয়েবসাইটে লগইন করুন:\n\n` +
      `🔗 ওয়েবসাইট: ${websiteUrl}\n` +
      `🔑 লগইন কোড: <code>${code}</code>\n\n` +
      `📋 কোড কপি করে ওয়েবসাইটে "Telegram Login" এ পেস্ট করুন।\n` +
      `⏳ কোড ৩০ মিনিট পর্যন্ত কার্যকর।`
    : `🌐 <b>Login to Website</b>\n\n` +
      `View your order history & delivered products on the website:\n\n` +
      `🔗 Website: ${websiteUrl}\n` +
      `🔑 Login Code: <code>${code}</code>\n\n` +
      `📋 Copy the code and paste it in "Telegram Login" on the website.\n` +
      `⏳ Code valid for 30 minutes.`;

  await sendMessage(token, chatId, loginMsg);
}
