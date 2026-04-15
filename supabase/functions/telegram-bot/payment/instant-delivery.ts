// ===== INSTANT DELIVERY HELPER =====
// Generates a login code and sends website link + access link to user after instant delivery

import { sendMessage } from "../telegram-api.ts";
import { isChildBotMode } from "../child-context.ts";

function isDriveLink(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com|googleapis\.com/i.test(url);
}

/**
 * Resolve access link for a product:
 * - If delivery_mode === 'unique': pick an unused stock item and mark it as used
 * - If delivery_mode === 'repeated' (default): use product.access_link directly
 * Returns the access link string or null if unavailable
 */
export async function resolveAccessLink(
  supabase: any,
  productId: string,
  orderId?: string,
  telegramOrderId?: string
): Promise<{ link: string | null; showInBot: boolean; showInWebsite: boolean }> {
  // Fetch product delivery_mode, access_link, and visibility flags
  const { data: product } = await supabase
    .from("products")
    .select("access_link, delivery_mode, show_link_in_bot, show_link_in_website")
    .eq("id", productId)
    .single();

  if (!product) return { link: null, showInBot: true, showInWebsite: true };

  const showInBot = product.show_link_in_bot !== false;
  const showInWebsite = product.show_link_in_website !== false;

  if (product.delivery_mode === "unique") {
    const { data: stockItems } = await supabase
      .from("product_stock_items")
      .select("id, access_link")
      .eq("product_id", productId)
      .eq("is_used", false)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!stockItems?.length) {
      console.log("No stock items available for product:", productId);
      return { link: null, showInBot, showInWebsite };
    }

    const stockItem = stockItems[0];

    const updateData: any = {
      is_used: true,
      used_at: new Date().toISOString(),
    };
    if (orderId) updateData.order_id = orderId;
    if (telegramOrderId) updateData.telegram_order_id = telegramOrderId;

    await supabase
      .from("product_stock_items")
      .update(updateData)
      .eq("id", stockItem.id);

    return { link: stockItem.access_link, showInBot, showInWebsite };
  }

  // Default: repeated mode
  return { link: product.access_link || null, showInBot, showInWebsite };
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
  lang: string
) {
  const childMode = isChildBotMode();

  // For child bots, deliver credentials directly without website link
  if (childMode) {
    await sendChildBotDelivery(token, chatId, accessLink, productName, lang);
    return;
  }

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

  const websiteUrl = "https://cheapest-premiums.in/auth";

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
            { text: "🌐 View on Website", url: websiteUrl, style: "success" }
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
            { text: "🌐 View on Website", url: websiteUrl, style: "primary" }
          ]]
        }
      }),
    });
  }
}

/**
 * Child bot delivery: Send credentials only, NO website link, NO login code
 */
async function sendChildBotDelivery(
  token: string,
  chatId: number,
  accessLink: string,
  productName: string,
  lang: string
) {
  // Check if it's credentials (contains | separator)
  const isCredentials = accessLink.includes("|");

  if (isCredentials) {
    const parts = accessLink.split("|").map((p: string) => p.trim());
    let credText = `✅ <b>${productName} Delivered!</b>\n\n🔑 <b>Your Credentials</b>\n\n`;
    if (parts.length >= 2) {
      credText += `📧 ID: <code>${parts[0]}</code>\n🔒 Password: <code>${parts[1]}</code>`;
    } else {
      credText += `<code>${accessLink}</code>`;
    }
    await sendMessage(token, chatId, credText);
  } else if (isDriveLink(accessLink)) {
    // Drive links are NOT shared via child bot
    await sendMessage(token, chatId,
      `✅ <b>${productName} Delivered!</b>\n\n📁 Your product has been delivered. Please contact support if you need assistance.`
    );
  } else {
    // Non-drive links: send directly
    await sendMessage(token, chatId,
      `✅ <b>${productName} Delivered!</b>\n\n🔗 <b>Your Access:</b>\n<code>${accessLink}</code>`
    );
  }
}