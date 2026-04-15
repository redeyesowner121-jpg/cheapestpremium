// ===== RESALE BOT - Dedicated bot for resale link purchases =====
// This bot ONLY handles resale link purchases. No product browsing, no original prices.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";

const MAIN_BOT_USERNAME = "Air1_Premium_bot";
const RESALE_BOT_USERNAME = "AIR1XOTT_bot";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UPI_ID = "8900684167@ibl";
const UPI_NAME = "Asif Ikbal Rubaiul Islam";

// ===== TELEGRAM API HELPERS =====
const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

async function sendMessage(token: string, chatId: number, text: string, opts?: { reply_markup?: any }) {
  await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML",
      ...(opts?.reply_markup && { reply_markup: opts.reply_markup }),
    }),
  });
}

async function forwardMessage(token: string, chatId: number, fromChatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API(token)}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, from_chat_id: fromChatId, message_id: messageId }),
  });
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
  });
}

// ===== DB HELPERS =====
async function getConversationState(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", telegramId).single();
  return data ? { step: data.step, data: data.data || {} } : null;
}

async function setConversationState(supabase: any, telegramId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({
    telegram_id: telegramId, step, data: stateData, updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

async function deleteConversationState(supabase: any, telegramId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", telegramId);
}

async function ensureWallet(supabase: any, telegramId: number) {
  const { data: existing } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  if (existing) return existing;
  const refCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: wallet } = await supabase.from("telegram_wallets").insert({ telegram_id: telegramId, referral_code: refCode }).select("*").single();
  return wallet;
}

async function getWallet(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  return data;
}

async function upsertUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert({
    telegram_id: user.id, username: user.username || null,
    first_name: user.first_name || null, last_name: user.last_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

async function getUserLang(supabase: any, telegramId: number): Promise<string> {
  const { data } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", telegramId).single();
  return data?.language || "en";
}

// Admin helpers - uses MAIN bot token to notify admins
async function getAllAdminIds(supabase: any): Promise<number[]> {
  const SUPER_ADMIN_ID = 6898461453;
  const ids = [SUPER_ADMIN_ID];
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (data?.length) {
    for (const a of data) { if (!ids.includes(a.telegram_id)) ids.push(a.telegram_id); }
  }
  return ids;
}

async function notifyAllAdminsMainBot(mainBotToken: string, supabase: any, text: string, opts?: { reply_markup?: any }) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await sendMessage(mainBotToken, adminId, text, opts); } catch { /* */ }
  }
}

async function forwardToAllAdminsMainBot(mainBotToken: string, supabase: any, fromChatId: number, messageId: number) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await forwardMessage(mainBotToken, adminId, fromChatId, messageId); } catch { /* */ }
  }
}

// ===== UPI HELPERS =====
function generatePayUrl(amount: number): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR`;
}

function generateUpiQrUrl(amount: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatePayUrl(amount))}`;
}

function generateFallbackQrUrl(amount: number): string {
  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(generatePayUrl(amount))}`;
}

// ===== SHOW PAYMENT INFO =====
async function showPaymentInfo(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, price: number, productId: string, variationId: string | null, lang: string,
  resaleLinkData: { resale_link_id: string; reseller_telegram_id: number; reseller_profit: number }
) {
  const userId = telegramUser.id;
  const wallet = await ensureWallet(supabase, userId);
  const walletBalance = wallet?.balance || 0;
  const finalAmount = Math.max(0, price - walletBalance);
  const walletDeduction = Math.min(walletBalance, price);

  let text = `🛒 <b>${lang === "bn" ? "অর্ডার" : "Order"}: ${productName}</b>\n\n`;
  text += `💰 ${lang === "bn" ? "মূল্য" : "Price"}: <b>₹${price}</b>\n`;
  text += `💳 ${lang === "bn" ? "ওয়ালেট ব্যালেন্স" : "Wallet Balance"}: <b>₹${walletBalance}</b>\n`;
  if (walletDeduction > 0) {
    text += `🔻 ${lang === "bn" ? "ওয়ালেট কর্তন" : "Wallet Deduction"}: <b>-₹${walletDeduction}</b>\n`;
  }
  text += `\n💵 <b>${lang === "bn" ? "পরিশোধযোগ্য" : "Payable"}: ₹${finalAmount}</b>\n\n`;

  if (finalAmount === 0) {
    await setConversationState(supabase, userId, "resale_wallet_pay_confirm", {
      productName, price, productId, variationId, ...resaleLinkData,
    });
    text += lang === "bn"
      ? "💳 ওয়ালেট থেকে পেমেন্ট কনফার্ম করতে নীচের বাটনে ক্লিক করুন।"
      : "💳 Click the button below to confirm wallet payment.";
    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: lang === "bn" ? "💳 ওয়ালেট দিয়ে পে করুন" : "💳 Pay with Wallet", callback_data: "resale_walletpay_confirm" }]],
      },
    });
  } else {
    const upiIntentUrl = generatePayUrl(finalAmount);
    const escapedUpiIntentUrl = upiIntentUrl.replace(/&/g, "&amp;");

    text += `<b>💳 ${lang === "bn" ? "পেমেন্ট করুন" : "Make Payment"}:</b>\n\n`;
    text += `📱 UPI ID: <code>${UPI_ID}</code>\n`;
    text += `💵 ${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>₹${finalAmount}</b>\n`;
    text += `🔗 UPI: <code>${escapedUpiIntentUrl}</code>\n\n`;
    text += `🌐 ${lang === "bn" ? "ইন্টারন্যাশনাল/বাইন্যান্স পেমেন্টের জন্য" : "For International/Binance Payment"}:\n`;
    text += `🆔 Binance ID: <code>1178303416</code>\n\n`;
    text += `${lang === "bn" ? "QR স্ক্যান করুন বা UPI লিংক কপি করে পেমেন্ট করুন। তারপর পেমেন্ট স্ক্রিনশট পাঠান।" : "Scan QR or copy the UPI link to pay. Then send payment screenshot."}`;

    await setConversationState(supabase, userId, "resale_awaiting_screenshot", {
      productName, price, finalAmount, productId, variationId, walletDeduction, ...resaleLinkData,
    });

    let sent = false;
    for (const qrUrl of [generateUpiQrUrl(finalAmount), generateFallbackQrUrl(finalAmount)]) {
      try {
        const res = await fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: qrUrl, caption: text, parse_mode: "HTML" }),
        });
        const result = await res.json();
        if (result.ok) { sent = true; break; }
      } catch { /* try next */ }
    }

    if (!sent) {
      await sendMessage(token, chatId, text);
      await sendMessage(token, chatId, `📎 QR Link:\n${generateFallbackQrUrl(finalAmount)}`);
    }

    await sendMessage(token, chatId, `🔗 UPI Link:\n<code>${escapedUpiIntentUrl}</code>`);
    await sendMessage(token, chatId, lang === "bn"
      ? "📸 পেমেন্ট করার পর <b>স্ক্রিনশট</b> পাঠান।"
      : "📸 After payment, send the <b>screenshot</b>.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📖 How to Pay (Tutorial)", url: "https://t.me/Cheapest_premiums_Help/3" }],
        ],
      },
    });
  }
}

// ===== HANDLE WALLET PAY FOR RESALE =====
async function handleResaleWalletPay(
  token: string, mainBotToken: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string
) {
  const { price, productName, productId, resale_link_id, reseller_telegram_id, reseller_profit } = stateData;
  const wallet = await getWallet(supabase, userId);
  if (!wallet || wallet.balance < price) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ পর্যাপ্ত ব্যালেন্স নেই।" : "❌ Insufficient wallet balance.");
    return;
  }

  await supabase.from("telegram_wallets").update({ balance: wallet.balance - price, updated_at: new Date().toISOString() }).eq("telegram_id", userId);
  await supabase.from("telegram_wallet_transactions").insert({ telegram_id: userId, type: "purchase_deduction", amount: -price, description: `Resale Purchase: ${productName}` });

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId, username: "resale_wallet_pay", product_name: productName,
    product_id: productId || null, amount: price, status: "confirmed",
    reseller_telegram_id: reseller_telegram_id || null, reseller_profit: reseller_profit || null,
  }).select("id").single();

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>ওয়ালেট থেকে পেমেন্ট হয়েছে!</b>\n\n₹${price} ওয়ালেট থেকে কাটা হয়েছে।\n<b>${productName}</b> এর অর্ডার হয়েছে।\nঅ্যাডমিন শীঘ্রই ডেলিভারি করবে। ⚡`
      : `✅ <b>Paid from Wallet!</b>\n\n₹${price} deducted from your wallet.\nOrder placed for <b>${productName}</b>.\nAdmin will deliver shortly. ⚡`
  );

  // Auto-send access link
  if (productId) {
    const { data: product } = await supabase.from("products").select("access_link").eq("id", productId).single();
    if (product?.access_link) {
      await sendMessage(token, chatId,
        lang === "bn"
          ? `🔗 <b>আপনার প্রোডাক্ট লিংক:</b>\n\n${product.access_link}\n\n⚠️ এই লিংক শুধুমাত্র আপনার জন্য।`
          : `🔗 <b>Your Product Access Link:</b>\n\n${product.access_link}\n\n⚠️ This link is for you only. Do not share.`
      );
    }
  }

  // Notify admins on MAIN bot
  await notifyAllAdminsMainBot(mainBotToken, supabase,
    `💰 <b>Resale Wallet Payment</b>\n\n👤 User: ${userId}\n📦 Product: ${productName}\n💵 Amount: ₹${price}\n🔄 Reseller: <code>${reseller_telegram_id}</code>\n💵 Reseller Profit: ₹${reseller_profit}\n✅ Auto-confirmed\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
  );

  // Credit reseller profit
  if (reseller_telegram_id && reseller_profit > 0) {
    const resellerWallet = await getWallet(supabase, reseller_telegram_id);
    if (resellerWallet) {
      await supabase.from("telegram_wallets").update({
        balance: resellerWallet.balance + reseller_profit,
        total_earned: resellerWallet.total_earned + reseller_profit,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", reseller_telegram_id);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: reseller_telegram_id, type: "resale_profit", amount: reseller_profit,
        description: `Resale profit: ${productName}`,
      });

      try {
        await sendMessage(mainBotToken, reseller_telegram_id,
          `💰 <b>Resale Profit!</b>\n\n₹${reseller_profit} added to your wallet!\nProduct: ${productName}`
        );
      } catch { /* */ }
    }
  }

  await deleteConversationState(supabase, userId);
}

// ===== HANDLE SCREENSHOT FOR RESALE =====
async function handleResaleScreenshot(
  token: string, mainBotToken: string, supabase: any, chatId: number, userId: number, msg: any, stateData: any, lang: string
) {
  const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || String(userId);
  const walletDeduction = stateData.walletDeduction || 0;

  // Deduct wallet if applicable
  if (walletDeduction > 0) {
    const wallet = await getWallet(supabase, userId);
    if (wallet && wallet.balance >= walletDeduction) {
      await supabase.from("telegram_wallets").update({ balance: wallet.balance - walletDeduction, updated_at: new Date().toISOString() }).eq("telegram_id", userId);
      await supabase.from("telegram_wallet_transactions").insert({ telegram_id: userId, type: "purchase_deduction", amount: -walletDeduction, description: `Partial wallet: ${stateData.productName}` });
    }
  }

  await deleteConversationState(supabase, userId);

  let orderId = "unknown";
  try {
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId, username, product_name: stateData.productName,
      product_id: stateData.productId || null, amount: stateData.price, status: "pending",
      screenshot_file_id: msg.photo?.[msg.photo.length - 1]?.file_id || null,
      reseller_telegram_id: stateData.reseller_telegram_id || null,
      reseller_profit: stateData.reseller_profit || null,
    }).select("id").single();
    orderId = order?.id || "unknown";
  } catch (e) { console.error("Order insert error:", e); }

  // Notify buyer
  let userMsg = lang === "bn" ? "✅ <b>স্ক্রিনশট পাঠানো হয়েছে!</b>\n\n" : "✅ <b>Screenshot received!</b>\n\n";
  if (walletDeduction > 0) {
    userMsg += lang === "bn" ? `💳 ওয়ালেট থেকে ₹${walletDeduction} কাটা হয়েছে।\n` : `💳 ₹${walletDeduction} deducted from wallet.\n`;
  }
  userMsg += lang === "bn" ? "অ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন। ⏳" : "Admin is verifying your payment. You'll get an update soon. ⏳";
  await sendMessage(token, chatId, userMsg);

  // Build admin message
  let adminMsg = `📩 <b>Resale Payment Screenshot</b>\n\n` +
    `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
    `📦 Product: <b>${stateData.productName}</b>\n` +
    `💰 Total Price: <b>₹${stateData.price}</b>\n`;
  if (walletDeduction > 0) adminMsg += `💳 Wallet Deducted: <b>₹${walletDeduction}</b>\n`;
  adminMsg += `💵 UPI Paid: <b>₹${stateData.finalAmount || stateData.price}</b>\n`;
  adminMsg += `🔄 <b>Resale Order</b> — Reseller: <code>${stateData.reseller_telegram_id}</code>, Profit: ₹${stateData.reseller_profit}\n`;
  adminMsg += `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

  const adminButtons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `admin_confirm_${orderId}`, style: "success" },
          { text: "❌ Reject", callback_data: `admin_reject_${orderId}`, style: "danger" },
        ],
        [{ text: "📦 Shipped", callback_data: `admin_ship_${orderId}`, style: "primary" }],
        [{ text: "💬 Chat", callback_data: `admin_chat_${userId}`, style: "primary" }],
      ],
    },
  };

  // Forward screenshot to admins on MAIN bot, then send action buttons
  try { await forwardToAllAdminsMainBot(mainBotToken, supabase, chatId, msg.message_id); } catch (e) { console.error("Forward error:", e); }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await notifyAllAdminsMainBot(mainBotToken, supabase, adminMsg, adminButtons);
      break;
    } catch (e) {
      console.error(`Admin notify attempt ${attempt + 1} failed:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { mainBotToken, resaleBotToken } = await resolveTelegramBotTokens({
    configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
    configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
    expectedMainUsername: MAIN_BOT_USERNAME,
    expectedResaleUsername: RESALE_BOT_USERNAME,
  });

  const RESALE_BOT_TOKEN = resaleBotToken;
  const MAIN_BOT_TOKEN = mainBotToken || resaleBotToken;

  if (!RESALE_BOT_TOKEN || !MAIN_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "Bot tokens not configured" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const update = await req.json();
    const msg = update.message;
    const callbackQuery = update.callback_query;

    // ===== CALLBACK QUERY (wallet pay confirm) =====
    if (callbackQuery) {
      const cbData = callbackQuery.data;
      const chatId = callbackQuery.message?.chat?.id;
      const userId = callbackQuery.from?.id;
      await answerCallbackQuery(RESALE_BOT_TOKEN, callbackQuery.id);

      if (cbData === "resale_walletpay_confirm" && chatId && userId) {
        const state = await getConversationState(supabase, userId);
        if (state?.step === "resale_wallet_pay_confirm") {
          const lang = await getUserLang(supabase, userId);
          await handleResaleWalletPay(RESALE_BOT_TOKEN, MAIN_BOT_TOKEN, supabase, chatId, userId, state.data, lang);
        }
      }
      return new Response("OK", { headers: corsHeaders });
    }

    if (!msg) return new Response("OK", { headers: corsHeaders });

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text?.trim() || "";

    if (!userId) return new Response("OK", { headers: corsHeaders });

    // Upsert user
    await upsertUser(supabase, msg.from);

    const lang = await getUserLang(supabase, userId);

    // ===== /start with resale code =====
    if (text.startsWith("/start")) {
      // Clear any existing state
      await deleteConversationState(supabase, userId);

      const parts = text.split(" ");
      if (parts.length > 1 && parts[1].startsWith("buy_")) {
        const linkCode = parts[1].replace("buy_", "");

        // Look up from BOTH tables (telegram_resale_links and web resale_links)
        let link: any = null;

        // Try telegram_resale_links first
        const { data: tgLink } = await supabase.from("telegram_resale_links").select("*").eq("link_code", linkCode).eq("is_active", true).single();
        if (tgLink) {
          link = tgLink;
        } else {
          // Try web resale_links
          const { data: webLink } = await supabase.from("resale_links").select("*").eq("link_code", linkCode).eq("is_active", true).single();
          if (webLink) {
            link = {
              ...webLink,
              reseller_telegram_id: null, // web resale doesn't have telegram ID
            };
          }
        }

        if (!link) {
          await sendMessage(RESALE_BOT_TOKEN, chatId,
            lang === "bn" ? "❌ লিংক পাওয়া যায়নি বা মেয়াদ শেষ।" : "❌ Link not found or expired."
          );
          return new Response("OK", { headers: corsHeaders });
        }

        // Get product name
        const { data: product } = await supabase.from("products").select("name").eq("id", link.product_id).single();
        let productName = product?.name || "Product";
        if (link.variation_id) {
          const { data: variation } = await supabase.from("product_variations").select("name").eq("id", link.variation_id).single();
          if (variation) productName += ` - ${variation.name}`;
        }

        const resaleLinkData = {
          resale_link_id: link.id,
          reseller_telegram_id: link.reseller_telegram_id || link.reseller_id || null,
          reseller_profit: link.custom_price - link.reseller_price,
        };

        await showPaymentInfo(RESALE_BOT_TOKEN, supabase, chatId, msg.from, productName, link.custom_price, link.product_id, link.variation_id, lang, resaleLinkData);

        // Increment uses
        const table = tgLink ? "telegram_resale_links" : "resale_links";
        await supabase.from(table).update({ uses: link.uses + 1 }).eq("id", link.id);

        return new Response("OK", { headers: corsHeaders });
      }

      // Plain /start - no resale code
      await sendMessage(RESALE_BOT_TOKEN, chatId,
        lang === "bn"
          ? "🛍️ <b>রিসেল পার্চেজ বট</b>\n\nএই বটটি শুধুমাত্র রিসেল লিংকের মাধ্যমে পণ্য কেনার জন্য।\n\nঅনুগ্রহ করে একটি বৈধ রিসেল লিংক ব্যবহার করুন।"
          : "🛍️ <b>Resale Purchase Bot</b>\n\nThis bot is for purchasing products via resale links only.\n\nPlease use a valid resale link to proceed."
      );
      return new Response("OK", { headers: corsHeaders });
    }

    // ===== Check conversation state for screenshots =====
    const state = await getConversationState(supabase, userId);

    if (state?.step === "resale_awaiting_screenshot" && msg.photo) {
      await handleResaleScreenshot(RESALE_BOT_TOKEN, MAIN_BOT_TOKEN, supabase, chatId, userId, msg, state.data, lang);
      return new Response("OK", { headers: corsHeaders });
    }

    if (state?.step === "resale_awaiting_screenshot" && !msg.photo) {
      await sendMessage(RESALE_BOT_TOKEN, chatId,
        lang === "bn" ? "📸 অনুগ্রহ করে পেমেন্ট স্ক্রিনশট পাঠান (ছবি)।" : "📸 Please send the payment screenshot (photo)."
      );
      return new Response("OK", { headers: corsHeaders });
    }

    // Any other message
    await sendMessage(RESALE_BOT_TOKEN, chatId,
      lang === "bn"
        ? "🛍️ এই বটটি শুধুমাত্র রিসেল লিংকের মাধ্যমে পণ্য কেনার জন্য।\n\nঅনুগ্রহ করে একটি বৈধ রিসেল লিংক ব্যবহার করুন।"
        : "🛍️ This bot is for purchasing via resale links only.\n\nPlease use a valid resale link to proceed."
    );

    return new Response("OK", { headers: corsHeaders });
  } catch (error) {
    console.error("Resale bot error:", error);
    return new Response("OK", { headers: corsHeaders });
  }
});
