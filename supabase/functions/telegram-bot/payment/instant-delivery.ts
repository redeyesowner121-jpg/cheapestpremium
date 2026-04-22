// ===== INSTANT DELIVERY HELPER =====
// Generates a login code and sends website link + access link to user after instant delivery

import { sendMessage } from "../telegram-api.ts";
import { isChildBotMode } from "../child-context.ts";

function isDriveLink(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com|googleapis\.com/i.test(url);
}

/**
 * Resolve access link for a product:
 * - If delivery_mode === 'unique': atomically consume the oldest unused stock item and delete it
 * - If delivery_mode === 'repeated' (default): use product.access_link directly
 * Returns the access link string or null if unavailable
 */
export async function resolveAccessLink(
  supabase: any,
  productId: string,
  orderId?: string,
  telegramOrderId?: string,
  quantity: number = 1,
): Promise<{ link: string | null; links: string[]; showInBot: boolean; showInWebsite: boolean; deliveryMessage?: string | null }> {
  const { data: product } = await supabase
    .from("products")
    .select("access_link, delivery_mode, show_link_in_bot, show_link_in_website, name")
    .eq("id", productId)
    .single();

  if (!product) return { link: null, links: [], showInBot: true, showInWebsite: true };

  const showInBot = product.show_link_in_bot !== false;
  const showInWebsite = product.show_link_in_website !== false;
  const qty = Math.max(1, Math.min(1000, Math.floor(quantity || 1)));

  // Try to resolve variation from order's product_name (e.g. "Netflix - 1 Month")
  let variationId: string | null = null;
  let variationDeliveryMode: string | null = null;
  let variationDeliveryMessage: string | null = null;
  try {
    let orderProductName: string | null = null;
    if (orderId) {
      const { data: o } = await supabase.from("orders").select("product_name").eq("id", orderId).single();
      orderProductName = o?.product_name || null;
    } else if (telegramOrderId) {
      const { data: o } = await supabase.from("telegram_orders").select("product_name").eq("id", telegramOrderId).single();
      orderProductName = o?.product_name || null;
    }
    if (orderProductName) {
      const { data: vars } = await supabase
        .from("product_variations")
        .select("id, name, delivery_mode, delivery_message")
        .eq("product_id", productId)
        .eq("is_active", true);
      if (vars?.length) {
        // Match longest variation name found in order_product_name
        const matched = vars
          .filter((v: any) => orderProductName!.toLowerCase().includes(v.name.toLowerCase()))
          .sort((a: any, b: any) => b.name.length - a.name.length)[0];
        if (matched) {
          variationId = matched.id;
          variationDeliveryMode = matched.delivery_mode;
          variationDeliveryMessage = matched.delivery_message || null;
        }
      }
    }
  } catch (e) {
    console.warn("[DELIVERY] variation resolve skipped:", e);
  }

  const useVariationStock = variationId && variationDeliveryMode === "unique";
  const useProductStock = !useVariationStock && product.delivery_mode === "unique";

  if (useVariationStock || useProductStock) {
    console.log("[UNIQUE-DELIVERY] Product", productId, "variation", variationId, "qty=", qty);
    const consumedLinks: string[] = [];

    for (let i = 0; i < qty; i++) {
      let consumedThis: string | null = null;

      // Try variation stock first, then fall back to product-level stock
      const stockStrategies: Array<{ type: string; filter: (q: any) => any }> = [];
      if (useVariationStock) {
        stockStrategies.push({
          type: "variation",
          filter: (q: any) => q.eq("variation_id", variationId),
        });
        // Fallback: try product-level stock (variation_id IS NULL) if variation stock is empty
        stockStrategies.push({
          type: "product-fallback",
          filter: (q: any) => q.eq("product_id", productId).is("variation_id", null),
        });
      } else {
        stockStrategies.push({
          type: "product",
          filter: (q: any) => q.eq("product_id", productId).is("variation_id", null),
        });
      }

      for (const strategy of stockStrategies) {
        for (let attempt = 0; attempt < 3; attempt++) {
          let q = supabase
            .from("product_stock_items")
            .select("id, access_link")
            .eq("is_used", false)
            .order("created_at", { ascending: true })
            .limit(1);
          q = strategy.filter(q);
          const { data: stockItems, error: fetchErr } = await q;
          if (fetchErr || !stockItems?.length) break;

          const stockItem = stockItems[0];
          const { data: consumedRows, error: consumeError } = await supabase
            .from("product_stock_items")
            .delete()
            .eq("id", stockItem.id)
            .eq("is_used", false)
            .select("access_link");

          if (consumeError) {
            console.error("[UNIQUE-DELIVERY] consume failed:", consumeError);
            break;
          }

          const link = consumedRows?.[0]?.access_link;
          if (link) { consumedThis = link; break; }
        }
        if (consumedThis) {
          if (strategy.type === "product-fallback") {
            console.log("[UNIQUE-DELIVERY] Used product-level fallback stock for variation", variationId);
          }
          break;
        }
      }
      if (!consumedThis) break;
      consumedLinks.push(consumedThis);
    }

    // Check remaining stock after consumption
    if (consumedLinks.length > 0) {
      await checkAndSwitchIfStockEmpty(supabase, productId, variationId, useVariationStock, product.name);
    }

    if (!consumedLinks.length) return { link: null, links: [], showInBot, showInWebsite };
    return { link: consumedLinks[0], links: consumedLinks, showInBot, showInWebsite };
  }

  // repeated mode: same link for all units
  const link = product.access_link || null;
  return { link, links: link ? Array(qty).fill(link) : [], showInBot, showInWebsite };
}

/**
 * Check if stock is empty after consumption. If so, switch delivery_mode to 'repeated'
 * and notify admin via Telegram.
 */
async function checkAndSwitchIfStockEmpty(
  supabase: any,
  productId: string,
  variationId: string | null,
  isVariationStock: boolean,
  productName: string,
) {
  try {
    let q = supabase
      .from("product_stock_items")
      .select("id", { count: "exact", head: true })
      .eq("is_used", false);

    if (isVariationStock && variationId) {
      q = q.eq("variation_id", variationId);
    } else {
      q = q.eq("product_id", productId).is("variation_id", null);
    }

    const { count } = await q;
    if (count !== null && count > 0) return; // still has stock

    // Switch to manual (repeated) mode
    if (isVariationStock && variationId) {
      // Get variation name before switching
      const { data: varData } = await supabase
        .from("product_variations")
        .select("name")
        .eq("id", variationId)
        .single();

      await supabase
        .from("product_variations")
        .update({ delivery_mode: "repeated" })
        .eq("id", variationId);

      console.log("[STOCK-EMPTY] Variation", variationId, "switched to manual mode");
      await notifyAdminStockEmpty(supabase, productName, varData?.name || "Unknown");
    } else {
      await supabase
        .from("products")
        .update({ delivery_mode: "repeated" })
        .eq("id", productId);

      console.log("[STOCK-EMPTY] Product", productId, "switched to manual mode");
      await notifyAdminStockEmpty(supabase, productName, null);
    }
  } catch (e) {
    console.error("[STOCK-CHECK] Error:", e);
  }
}

/**
 * Send admin notification via Telegram when stock runs out
 */
async function notifyAdminStockEmpty(supabase: any, productName: string, variationName: string | null) {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return;

    // Get admin chat ID from app_settings
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "admin_telegram_id")
      .single();

    const adminChatId = setting?.value;
    if (!adminChatId) return;

    const label = variationName
      ? `<b>${productName}</b> — <b>${variationName}</b>`
      : `<b>${productName}</b>`;

    const msg = `⚠️ <b>Auto Delivery Stock Empty!</b>\n\n` +
      `📦 Product: ${label}\n` +
      `🔄 Switched to <b>Manual Delivery</b> mode.\n\n` +
      `Please add new stock or deliver orders manually.`;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminChatId, text: msg, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("[ADMIN-NOTIFY] Stock empty notification failed:", e);
  }
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