import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_ID = 6898461453;
const BOT_USERNAME = "Cheapest_Premiums_bot";
const REQUIRED_CHANNELS = ["@pocket_money27", "@RKRxOTT"];

function isSuperAdmin(userId: number): boolean {
  return userId === SUPER_ADMIN_ID;
}

async function isAdminBot(supabase: any, userId: number): Promise<boolean> {
  if (userId === SUPER_ADMIN_ID) return true;
  const { data } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", userId).maybeSingle();
  return !!data;
}
// Get all admin IDs (super admin + db admins)
async function getAllAdminIds(supabase: any): Promise<number[]> {
  const ids = [SUPER_ADMIN_ID];
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (data?.length) {
    for (const a of data) {
      if (!ids.includes(a.telegram_id)) ids.push(a.telegram_id);
    }
  }
  return ids;
}

// Send message to all admins
async function notifyAllAdmins(token: string, supabase: any, text: string, opts?: { reply_markup?: any }) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await sendMessage(token, adminId, text, opts); } catch { /* admin may have blocked bot */ }
  }
}

// Forward a message to all admins
async function forwardToAllAdmins(token: string, supabase: any, fromChatId: number, messageId: number) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await forwardMessage(token, adminId, fromChatId, messageId); } catch { /* */ }
  }
}

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

// DB-based conversation state helpers
async function getConversationState(supabase: any, telegramId: number): Promise<{ step: string; data: Record<string, any> } | null> {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", telegramId).single();
  return data ? { step: data.step, data: data.data || {} } : null;
}

async function setConversationState(supabase: any, telegramId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({
    telegram_id: telegramId,
    step,
    data: stateData,
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

async function deleteConversationState(supabase: any, telegramId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", telegramId);
}

// ===== TRANSLATIONS =====
const T: Record<string, Record<string, string>> = {
  welcome: {
    en: "🛍️ <b>Welcome to RKR Premium Store!</b>\n\n✨ Premium digital products at the cheapest prices\n⚡ Instant delivery\n🔒 Secure payments (UPI/Binance)\n💬 24/7 Support\n\nChoose an option below:",
    bn: "🛍️ <b>RKR প্রিমিয়াম স্টোরে স্বাগতম!</b>\n\n✨ সবচেয়ে কম দামে প্রিমিয়াম ডিজিটাল পণ্য\n⚡ তাৎক্ষণিক ডেলিভারি\n🔒 নিরাপদ পেমেন্ট (UPI/Binance)\n💬 ২৪/৭ সাপোর্ট\n\nনিচে একটি অপশন বেছে নিন:",
  },
  choose_lang: {
    en: "🌐 <b>Choose Your Language / ভাষা নির্বাচন করুন</b>",
    bn: "🌐 <b>Choose Your Language / ভাষা নির্বাচন করুন</b>",
  },
  lang_saved: {
    en: "✅ Language set to <b>English</b>!",
    bn: "✅ ভাষা <b>বাংলা</b> সেট করা হয়েছে!",
  },
  join_channels: {
    en: "🔒 <b>Please join our channels first!</b>\n\nYou must join both channels to use this bot.\nAfter joining, click \"✅ I've Joined - Verify\".",
    bn: "🔒 <b>প্রথমে আমাদের চ্যানেলে যোগ দিন!</b>\n\nবট ব্যবহার করতে উভয় চ্যানেলে যোগ দিতে হবে।\nযোগ দেওয়ার পর \"✅ যোগ দিয়েছি - যাচাই করুন\" ক্লিক করুন।",
  },
  not_joined: {
    en: "❌ You haven't joined all channels yet. Please join both channels and try again.",
    bn: "❌ আপনি এখনও সব চ্যানেলে যোগ দেননি। অনুগ্রহ করে উভয় চ্যানেলে যোগ দিন এবং আবার চেষ্টা করুন।",
  },
  verified: {
    en: "✅ Verified! Welcome aboard!",
    bn: "✅ যাচাই সম্পন্ন! স্বাগতম!",
  },
  view_products: { en: "🛍️ View Products", bn: "🛍️ পণ্য দেখুন" },
  my_orders: { en: "📦 My Orders", bn: "📦 আমার অর্ডার" },
  my_wallet: { en: "💰 My Wallet", bn: "💰 আমার ওয়ালেট" },
  refer_earn: { en: "🎁 Refer & Earn", bn: "🎁 রেফার ও আয়" },
  support: { en: "📞 Support", bn: "📞 সাপোর্ট" },
  get_offers: { en: "🔥 Offers", bn: "🔥 অফার" },
  back: { en: "⬅️ Back", bn: "⬅️ পিছনে" },
  back_products: { en: "⬅️ Back to Products", bn: "⬅️ পণ্যে ফিরুন" },
  back_main: { en: "⬅️ Main Menu", bn: "⬅️ মূল মেনু" },
  buy_now: { en: "🛒 Buy Now", bn: "🛒 এখন কিনুন" },
  details: { en: "📋 Details", bn: "📋 বিস্তারিত" },
  no_products: { en: "😔 No products available right now.", bn: "😔 এখন কোনো পণ্য নেই।" },
  product_not_found: { en: "❌ Product not found.", bn: "❌ পণ্য পাওয়া যায়নি।" },
  out_of_stock: { en: "❌ Sorry, this product is out of stock.", bn: "❌ দুঃখিত, এই পণ্যটি স্টকে নেই।" },
  order_confirmed: {
    en: "✅ <b>Payment Verified!</b>\n\nYour payment has been verified. Order confirmed! Your product will be delivered shortly. ⚡",
    bn: "✅ <b>পেমেন্ট যাচাই হয়েছে!</b>\n\nআপনার অর্ডার নিশ্চিত করা হয়েছে! পণ্যটি শীঘ্রই ডেলিভারি হবে। ⚡",
  },
  order_rejected: {
    en: "❌ <b>Payment Not Verified</b>\n\nYour payment could not be verified. Please contact support.",
    bn: "❌ <b>পেমেন্ট যাচাই ব্যর্থ</b>\n\nআপনার পেমেন্ট যাচাই করা যায়নি। সাপোর্টে যোগাযোগ করুন।",
  },
  order_shipped: {
    en: "📦 <b>Order Shipped!</b>\n\nYour product has been dispatched! It will reach you soon. 🎉",
    bn: "📦 <b>অর্ডার শিপ হয়েছে!</b>\n\nআপনার পণ্য পাঠানো হয়েছে! শীঘ্রই পৌঁছে যাবে। 🎉",
  },
  send_screenshot: {
    en: "📸 Now send your payment screenshot here. It will be forwarded to admin for verification.",
    bn: "📸 এখন আপনার পেমেন্ট স্ক্রিনশট এখানে পাঠান। যাচাইয়ের জন্য অ্যাডমিনের কাছে ফরোয়ার্ড হবে।",
  },
  wallet_header: {
    en: "💰 <b>My Bot Wallet</b>",
    bn: "💰 <b>আমার বট ওয়ালেট</b>",
  },
  referral_header: {
    en: "🎁 <b>Refer & Earn</b>",
    bn: "🎁 <b>রেফার ও আয়</b>",
  },
  no_return: {
    en: "We have a strict <b>No-Return Policy</b>. All sales are final.",
    bn: "আমাদের কোনো <b>রিটার্ন পলিসি নেই</b>। সকল বিক্রয় চূড়ান্ত।",
  },
  ai_forward: {
    en: "I'm not sure about that. Would you like me to forward your question to the admin?",
    bn: "আমি এই বিষয়ে নিশ্চিত নই। আপনি কি আপনার প্রশ্ন অ্যাডমিনের কাছে ফরোয়ার্ড করতে চান?",
  },
  resale_not_reseller: {
    en: "❌ You are not a reseller. Contact admin to become one.",
    bn: "❌ আপনি রিসেলার নন। রিসেলার হতে অ্যাডমিনের সাথে যোগাযোগ করুন।",
  },
  resale_enter_price: {
    en: "💰 Enter your custom selling price (must be higher than reseller price: ₹{price}):",
    bn: "💰 আপনার কাস্টম বিক্রয় মূল্য লিখুন (রিসেলার মূল্যের চেয়ে বেশি হতে হবে: ₹{price}):",
  },
  resale_price_low: {
    en: "❌ Price must be higher than reseller price ₹{price}.",
    bn: "❌ মূল্য রিসেলার মূল্য ₹{price} এর চেয়ে বেশি হতে হবে।",
  },
  resale_link_created: {
    en: "✅ <b>Resale Link Created!</b>\n\n🔗 Link: https://t.me/{bot}?start=buy_{code}\n💰 Your Price: ₹{custom}\n📦 Reseller Price: ₹{reseller}\n💵 Profit per sale: ₹{profit}",
    bn: "✅ <b>রিসেল লিংক তৈরি হয়েছে!</b>\n\n🔗 লিংক: https://t.me/{bot}?start=buy_{code}\n💰 আপনার মূল্য: ₹{custom}\n📦 রিসেলার মূল্য: ₹{reseller}\n💵 প্রতি বিক্রয়ে লাভ: ₹{profit}",
  },
  access_denied: {
    en: "🚫 <b>Access Denied.</b> You are not authorized.",
    bn: "🚫 <b>প্রবেশ নিষেধ।</b> আপনি অনুমোদিত নন।",
  },
  pay_with_wallet: {
    en: "💰 Pay with Wallet",
    bn: "💰 ওয়ালেট দিয়ে পে করুন",
  },
  wallet_paid: {
    en: "✅ <b>Paid from Wallet!</b>\n\n₹{amount} deducted from your wallet.\nOrder placed for <b>{product}</b>.\nAdmin will deliver shortly. ⚡",
    bn: "✅ <b>ওয়ালেট থেকে পেমেন্ট হয়েছে!</b>\n\n₹{amount} ওয়ালেট থেকে কাটা হয়েছে।\n<b>{product}</b> এর অর্ডার হয়েছে।\nঅ্যাডমিন শীঘ্রই ডেলিভারি করবে। ⚡",
  },
};

function t(key: string, lang: string): string {
  return T[key]?.[lang] || T[key]?.["en"] || key;
}

// ===== TELEGRAM HELPERS =====

async function sendMessage(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode || "HTML",
      ...(opts?.reply_markup && { reply_markup: opts.reply_markup }),
    }),
  });
}

async function sendPhoto(token: string, chatId: number, photoUrl: string, caption: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup }),
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

async function getChatMember(token: string, chatId: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json();
    return data?.result?.status || "left";
  } catch {
    return "left";
  }
}

// ===== DB HELPERS =====

async function getSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  data?.forEach((s: any) => (settings[s.key] = s.value));
  return settings;
}

async function upsertTelegramUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert(
    {
      telegram_id: user.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      last_active: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );
}

async function isBanned(supabase: any, telegramId: number): Promise<boolean> {
  const { data } = await supabase.from("telegram_bot_users").select("is_banned").eq("telegram_id", telegramId).single();
  return data?.is_banned === true;
}

async function getUserLang(supabase: any, telegramId: number): Promise<string | null> {
  const { data } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", telegramId).single();
  return data?.language || null;
}

async function setUserLang(supabase: any, telegramId: number, lang: string) {
  await supabase.from("telegram_bot_users").update({ language: lang }).eq("telegram_id", telegramId);
}

async function ensureWallet(supabase: any, telegramId: number): Promise<any> {
  const { data: existing } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  if (existing) return existing;

  const refCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: wallet } = await supabase.from("telegram_wallets").insert({
    telegram_id: telegramId,
    referral_code: refCode,
  }).select("*").single();
  return wallet;
}

async function getWallet(supabase: any, telegramId: number): Promise<any> {
  const { data } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  return data;
}

// ===== CHECK CHANNEL MEMBERSHIP =====

async function checkChannelMembership(token: string, userId: number): Promise<boolean> {
  for (const channel of REQUIRED_CHANNELS) {
    const status = await getChatMember(token, channel, userId);
    if (!["member", "administrator", "creator"].includes(status)) {
      return false;
    }
  }
  return true;
}

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) return new Response("Bot token not configured", { status: 500 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const update = await req.json();

    // ===== CALLBACK QUERIES =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      const telegramUser = cq.from;
      const userId = telegramUser.id;

      if (await isBanned(supabase, userId)) {
        await answerCallbackQuery(BOT_TOKEN, cq.id);
        return jsonOk();
      }

      await upsertTelegramUser(supabase, telegramUser);
      await answerCallbackQuery(BOT_TOKEN, cq.id);

      const lang = (await getUserLang(supabase, userId)) || "en";

      // Language selection
      if (data === "lang_en" || data === "lang_bn") {
        const selectedLang = data === "lang_en" ? "en" : "bn";
        await setUserLang(supabase, userId, selectedLang);
        await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
        // Check channels
        const joined = await checkChannelMembership(BOT_TOKEN, userId);
        if (!joined) {
          await showJoinChannels(BOT_TOKEN, chatId, selectedLang);
        } else {
          await ensureWallet(supabase, userId);
          await showMainMenu(BOT_TOKEN, supabase, chatId, selectedLang);
        }
        return jsonOk();
      }

      // Verify join
      if (data === "verify_join") {
        const joined = await checkChannelMembership(BOT_TOKEN, userId);
        if (!joined) {
          await sendMessage(BOT_TOKEN, chatId, t("not_joined", lang));
        } else {
          await sendMessage(BOT_TOKEN, chatId, t("verified", lang));
          await ensureWallet(supabase, userId);
          await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
        }
        return jsonOk();
      }

      // Forward to admin
      if (data === "forward_to_admin") {
        // Set user into "chatting_with_admin" mode so AI is disabled
        await setConversationState(supabase, userId, "chatting_with_admin", {});
        await notifyAllAdmins(BOT_TOKEN, supabase,
          `📩 User @${telegramUser.username || telegramUser.first_name} (${userId}) wants admin help.`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }]],
            },
          }
        );
        await sendMessage(BOT_TOKEN, chatId, lang === "bn"
          ? "✅ আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন।\n\n💬 এখন আপনি সরাসরি মেসেজ পাঠাতে পারেন। চ্যাট শেষ করতে /endchat লিখুন।"
          : "✅ Your question has been forwarded to admin. You'll get a reply soon.\n\n💬 You can now send messages directly. Type /endchat to end chat."
        );
        return jsonOk();
      }

      // Admin chat reply
      if (data.startsWith("admin_chat_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        const targetUserId = parseInt(data.replace("admin_chat_", ""));
        await setConversationState(supabase, userId, "admin_reply", { targetUserId });
        await sendMessage(BOT_TOKEN, chatId, `💬 <b>Chat mode with user <code>${targetUserId}</code></b>\n\nType messages to send. Each message will be delivered to the user.\n\nSend /endchat to end the conversation.`);
        return jsonOk();
      }

      // Admin actions
      if (data.startsWith("admin_confirm_") || data.startsWith("admin_reject_") || data.startsWith("admin_ship_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        const parts = data.split("_");
        const action = parts[1]; // confirm/reject/ship
        const orderId = data.substring(data.indexOf("_", data.indexOf("_") + 1) + 1);
        const statusMap: Record<string, string> = { confirm: "confirmed", reject: "rejected", ship: "shipped" };
        await handleAdminAction(BOT_TOKEN, supabase, orderId, statusMap[action] || "confirmed", chatId);
        return jsonOk();
      }

      // View products (categories)
      if (data === "view_products") {
        await handleViewCategories(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      // Category click
      if (data.startsWith("cat_")) {
        const category = decodeURIComponent(data.replace("cat_", ""));
        await handleCategoryProducts(BOT_TOKEN, supabase, chatId, category, lang);
        return jsonOk();
      }

      // Product detail
      if (data.startsWith("product_")) {
        const productId = data.replace("product_", "");
        await handleProductDetail(BOT_TOKEN, supabase, chatId, productId, lang, userId);
        return jsonOk();
      }

      // Variation buy
      if (data.startsWith("buyvar_")) {
        const varId = data.replace("buyvar_", "");
        await handleBuyVariation(BOT_TOKEN, supabase, chatId, varId, telegramUser, lang);
        return jsonOk();
      }

      // Buy product (no variation)
      if (data.startsWith("buy_")) {
        const productId = data.replace("buy_", "");
        await handleBuyProduct(BOT_TOKEN, supabase, chatId, productId, telegramUser, lang);
        return jsonOk();
      }

      // Wallet pay (confirm from conversation state)
      if (data === "walletpay_confirm") {
        const convState = await getConversationState(supabase, userId);
        if (convState?.step === "wallet_pay_confirm") {
          await deleteConversationState(supabase, userId);
          await handleWalletPay(BOT_TOKEN, supabase, chatId, userId, convState.data.price, convState.data.productName, lang);
        } else {
          await sendMessage(BOT_TOKEN, chatId, lang === "bn" ? "❌ সেশন মেয়াদ উত্তীর্ণ। আবার চেষ্টা করুন।" : "❌ Session expired. Please try again.");
        }
        return jsonOk();
      }

      // My orders
      if (data === "my_orders") {
        await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang);
        return jsonOk();
      }

      // My wallet
      if (data === "my_wallet") {
        await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang);
        return jsonOk();
      }

      // Refer & earn
      if (data === "refer_earn") {
        await handleReferEarn(BOT_TOKEN, supabase, chatId, userId, lang);
        return jsonOk();
      }

      // Support
      if (data === "support") {
        await handleSupport(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      // Offers
      if (data === "get_offers") {
        await handleGetOffers(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      // Back to main
      if (data === "back_main") {
        await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      if (data === "back_products") {
        await handleViewCategories(BOT_TOKEN, supabase, chatId, lang);
        return jsonOk();
      }

      // Resale button (product level)
      if (data.startsWith("resale_")) {
        const productId = data.replace("resale_", "");
        await handleResaleStart(BOT_TOKEN, supabase, chatId, userId, productId, null, lang);
        return jsonOk();
      }

      // Resale button (variation level)
      if (data.startsWith("resalevar_")) {
        const varId = data.replace("resalevar_", "");
        await handleResaleVariationStart(BOT_TOKEN, supabase, chatId, userId, varId, lang);
        return jsonOk();
      }

      // All users pagination
      if (data.startsWith("allusers_page_")) {
        if (!await isAdminBot(supabase, userId)) return jsonOk();
        const page = parseInt(data.replace("allusers_page_", ""));
        await handleAllUsers(BOT_TOKEN, supabase, chatId, page);
        return jsonOk();
      }

      return jsonOk();
    }

    // ===== TEXT/PHOTO MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUser = msg.from;
      const userId = telegramUser.id;
      const text = msg.text || "";

      if (await isBanned(supabase, userId)) return jsonOk();

      await upsertTelegramUser(supabase, telegramUser);

      // Check conversation state first (DB-based)
      const convState = await getConversationState(supabase, userId);
      if (convState) {
        await handleConversationStep(BOT_TOKEN, supabase, chatId, userId, msg, convState);
        return jsonOk();
      }

      // Commands
      if (text.startsWith("/")) {
        const parts = text.split(" ");
        const command = parts[0].toLowerCase().split("@")[0];
        const lang = (await getUserLang(supabase, userId)) || "en";

        switch (command) {
          case "/start": {
            // Check for referral or resale link
            const payload = parts[1] || "";
            await ensureWallet(supabase, userId);

            if (payload.startsWith("ref_")) {
              await handleStartWithRef(supabase, userId, payload.replace("ref_", ""));
            } else if (payload.startsWith("buy_")) {
              const linkCode = payload.replace("buy_", "");
              await handleResaleBuy(BOT_TOKEN, supabase, chatId, userId, telegramUser, linkCode, lang);
              return jsonOk();
            }

            // Check language
            const userLang = await getUserLang(supabase, userId);
            if (!userLang) {
              await showLanguageSelection(BOT_TOKEN, chatId);
              return jsonOk();
            }

            // Check channels
            const joined = await checkChannelMembership(BOT_TOKEN, userId);
            if (!joined) {
              await showJoinChannels(BOT_TOKEN, chatId, userLang);
              return jsonOk();
            }

            await showMainMenu(BOT_TOKEN, supabase, chatId, userLang);
            break;
          }
          case "/products":
          case "/categories":
            await handleViewCategories(BOT_TOKEN, supabase, chatId, lang);
            break;
          case "/myorders":
          case "/orders":
            await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang);
            break;
          case "/help":
            await sendMessage(BOT_TOKEN, chatId,
              lang === "bn"
                ? "📖 <b>কমান্ড:</b>\n/start - মূল মেনু\n/products - পণ্য দেখুন\n/myorders - আমার অর্ডার\n/help - সাহায্য"
                : "📖 <b>Commands:</b>\n/start - Main menu\n/products - View products\n/myorders - My orders\n/help - Show help"
            );
            break;
          // Admin commands
          case "/admin":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAdminMenu(BOT_TOKEN, supabase, chatId);
            break;
          case "/broadcast":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "broadcast_message", {});
            await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel.");
            break;
          case "/report":
          case "/stats":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleReport(BOT_TOKEN, supabase, chatId);
            break;
          case "/add_product":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await setConversationState(supabase, userId, "add_photo", {});
            await sendMessage(BOT_TOKEN, chatId, "📸 <b>Add Product (Step 1/4)</b>\n\nSend the product photo.\n/cancel to cancel.");
            break;
          case "/edit_price": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleEditPrice(BOT_TOKEN, supabase, chatId, text.substring("/edit_price".length).trim());
            break;
          }
          case "/out_stock": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleOutStock(BOT_TOKEN, supabase, chatId, text.substring("/out_stock".length).trim());
            break;
          }
          case "/users":
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleUsersCommand(BOT_TOKEN, supabase, chatId);
            break;
          case "/history": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleHistoryCommand(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0);
            break;
          }
          case "/ban": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleBanCommand(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0, true);
            break;
          }
          case "/unban": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleBanCommand(BOT_TOKEN, supabase, chatId, parseInt(parts[1]) || 0, false);
            break;
          }
          case "/make_reseller": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            const targetId = parseInt(parts[1]) || 0;
            await handleMakeReseller(BOT_TOKEN, supabase, chatId, targetId);
            break;
          }
          case "/add_admin": {
            if (!isSuperAdmin(userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            const addId = parseInt(parts[1]) || 0;
            await handleAddAdmin(BOT_TOKEN, supabase, chatId, addId);
            break;
          }
          case "/remove_admin": {
            if (!isSuperAdmin(userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            const removeId = parseInt(parts[1]) || 0;
            await handleRemoveAdmin(BOT_TOKEN, supabase, chatId, removeId);
            break;
          }
          case "/admins": {
            if (!isSuperAdmin(userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleListAdmins(BOT_TOKEN, supabase, chatId);
            break;
          }
          case "/allusers": {
            if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
            await handleAllUsers(BOT_TOKEN, supabase, chatId, 0);
            break;
          }
          default:
            break;
        }
        return jsonOk();
      }

      // Non-command messages from users
      const lang = (await getUserLang(supabase, userId)) || "en";

      // Check language first
      if (!await getUserLang(supabase, userId)) {
        await showLanguageSelection(BOT_TOKEN, chatId);
        return jsonOk();
      }

      // Check channels
      const joined = await checkChannelMembership(BOT_TOKEN, userId);
      if (!joined) {
        await showJoinChannels(BOT_TOKEN, chatId, lang);
        return jsonOk();
      }

      // If user sends a photo (payment screenshot etc.), forward directly to admin — skip AI
      if (msg.photo) {
        await forwardUserMessageToAdmin(BOT_TOKEN, supabase, msg, telegramUser, lang);
        return jsonOk();
      }

      // AI auto-reply for all non-admin text messages (only for actual text, not empty)
      if (!await isAdminBot(supabase, userId) && text && text.trim().length > 0) {
        await handleAIQuery(BOT_TOKEN, supabase, chatId, userId, text, lang);
        return jsonOk();
      }

      return jsonOk();
    }

    return jsonOk();
  } catch (error) {
    console.error("Telegram bot error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonOk() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ===== LANGUAGE SELECTION =====

async function showLanguageSelection(token: string, chatId: number) {
  await sendMessage(token, chatId, T.choose_lang.en, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: "lang_en" },
          { text: "🇧🇩 বাংলা", callback_data: "lang_bn" },
        ],
      ],
    },
  });
}

// ===== JOIN CHANNELS =====

async function showJoinChannels(token: string, chatId: number, lang: string) {
  await sendMessage(token, chatId, t("join_channels", lang), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Join @pocket_money27", url: "https://t.me/pocket_money27" }],
        [{ text: "📢 Join @RKRxOTT", url: "https://t.me/RKRxOTT" }],
        [{ text: "✅ I've Joined - Verify", callback_data: "verify_join" }],
      ],
    },
  });
}

// ===== MAIN MENU =====

async function showMainMenu(token: string, supabase: any, chatId: number, lang: string) {
  const settings = await getSettings(supabase);
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  await sendMessage(token, chatId, t("welcome", lang), {
    reply_markup: {
      inline_keyboard: [
        [{ text: t("view_products", lang), callback_data: "view_products" }],
        [
          { text: t("my_orders", lang), callback_data: "my_orders" },
          { text: t("my_wallet", lang), callback_data: "my_wallet" },
        ],
        [
          { text: t("refer_earn", lang), callback_data: "refer_earn" },
        ],
        [
          { text: `⭐ ${lang === "bn" ? "রিভিউ" : "Reviews"} ↗`, url: "https://t.me/RKRxProofs" },
          { text: t("support", lang), callback_data: "support" },
        ],
        [{ text: t("get_offers", lang), callback_data: "get_offers" }],
      ],
    },
  });
}

// ===== VIEW CATEGORIES =====

async function handleViewCategories(token: string, supabase: any, chatId: number, lang: string) {
  const { data: categories } = await supabase
    .from("categories")
    .select("name, icon_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!categories?.length) {
    await sendMessage(token, chatId, t("no_products", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] },
    });
    return;
  }

  const header = lang === "bn" ? "📂 <b>ক্যাটাগরি নির্বাচন করুন:</b>" : "📂 <b>Choose a Category:</b>";
  const buttons: any[][] = [];
  for (let i = 0; i < categories.length; i += 2) {
    const row: any[] = [{ text: categories[i].name, callback_data: `cat_${encodeURIComponent(categories[i].name)}` }];
    if (categories[i + 1]) {
      row.push({ text: categories[i + 1].name, callback_data: `cat_${encodeURIComponent(categories[i + 1].name)}` });
    }
    buttons.push(row);
  }
  buttons.push([{ text: t("back_main", lang), callback_data: "back_main" }]);

  await sendMessage(token, chatId, header, { reply_markup: { inline_keyboard: buttons } });
}

// ===== CATEGORY PRODUCTS =====

async function handleCategoryProducts(token: string, supabase: any, chatId: number, category: string, lang: string) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, stock")
    .eq("is_active", true)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!products?.length) {
    await sendMessage(token, chatId,
      lang === "bn" ? `<b>${category}</b> ক্যাটাগরিতে কোনো পণ্য নেই।` : `No products in <b>${category}</b>.`,
      { reply_markup: { inline_keyboard: [[{ text: t("back_products", lang), callback_data: "back_products" }]] } }
    );
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  // Build a compact product list message
  let text = `📂 <b>${category}</b>\n\n`;
  const buttons: any[][] = [];

  for (const p of products) {
    let displayPrice = p.price;
    if (p.price === 0) {
      const { data: firstVar } = await supabase
        .from("product_variations")
        .select("price")
        .eq("product_id", p.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (firstVar) displayPrice = firstVar.price;
    }

    const stockEmoji = p.stock !== null && p.stock <= 0 ? " ❌" : "";
    text += `• <b>${p.name}</b> — ${currency}${displayPrice}${stockEmoji}\n`;

    if (p.stock === null || p.stock > 0) {
      buttons.push([{ text: `📦 ${p.name} — ${currency}${displayPrice}`, callback_data: `product_${p.id}` }]);
    }
  }

  text += `\n${lang === "bn" ? "একটি পণ্যে ক্লিক করুন ভেরিয়েশন দেখতে:" : "Click a product to see variations:"}`;

  buttons.push([{ text: t("back_products", lang), callback_data: "back_products" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== PRODUCT DETAIL (Show Variations Directly) =====

async function handleProductDetail(token: string, supabase: any, chatId: number, productId: string, lang: string, userId: number) {
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }

  const { data: variations } = await supabase
    .from("product_variations")
    .select("id, name, price, original_price, reseller_price")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  // Check if user is reseller
  const wallet = await getWallet(supabase, userId);
  const isReseller = wallet?.is_reseller === true;

  const buttons: any[][] = [];

  if (variations?.length) {
    let text = `📦 <b>${product.name}</b>\n\n`;
    text += `${lang === "bn" ? "একটি ভেরিয়েশন সিলেক্ট করুন:" : "Select a variation:"}\n\n`;

    for (const v of variations) {
      if (isReseller) {
        // Resellers see reseller price and get Resell button
        const resellerPrice = v.reseller_price || v.price;
        text += `• ${v.name} — ${currency}${resellerPrice} (Reseller)\n`;
        buttons.push([
          { text: `🛒 ${v.name} — ${currency}${resellerPrice}`, callback_data: `buyvar_${v.id}` },
          { text: `🔄 Resell`, callback_data: `resalevar_${v.id}` },
        ]);
      } else {
        const priceStr = v.original_price && v.original_price > v.price
          ? `${currency}${v.price} (was ${currency}${v.original_price})`
          : `${currency}${v.price}`;
        text += `• ${v.name} — ${priceStr}\n`;
        buttons.push([{ text: `🛒 ${v.name} — ${currency}${v.price}`, callback_data: `buyvar_${v.id}` }]);
      }
    }

    buttons.push([{ text: t("back_products", lang), callback_data: "back_products" }]);

    if (product.image_url) {
      await sendPhoto(token, chatId, product.image_url, text, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
  } else {
    // No variations - show direct buy
    const displayPrice = isReseller ? (product.reseller_price || product.price) : product.price;
    const priceLabel = isReseller ? `${currency}${displayPrice} (Reseller)` : (
      product.original_price && product.original_price > product.price
        ? `<s>${currency}${product.original_price}</s> ${currency}${product.price}`
        : `${currency}${product.price}`
    );
    let text = `📦 <b>${product.name}</b>\n💰 ${lang === "bn" ? "মূল্য" : "Price"}: ${priceLabel}`;

    if (product.stock === null || product.stock > 0) {
      if (isReseller) {
        buttons.push([
          { text: t("buy_now", lang), callback_data: `buy_${productId}` },
          { text: `🔄 ${lang === "bn" ? "রিসেল" : "Resale"}`, callback_data: `resale_${productId}` },
        ]);
      } else {
        buttons.push([{ text: t("buy_now", lang), callback_data: `buy_${productId}` }]);
      }
    }

    buttons.push([{ text: t("back_products", lang), callback_data: "back_products" }]);

    if (product.image_url) {
      await sendPhoto(token, chatId, product.image_url, text, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
  }
}

// ===== BUY PRODUCT =====

async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any, lang: string) {
  const { data: product } = await supabase.from("products").select("name, price, stock, id").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  await showPaymentInfo(token, supabase, chatId, telegramUser, product.name, product.price, product.id, null, lang);
}

// ===== BUY VARIATION =====

async function handleBuyVariation(token: string, supabase: any, chatId: number, variationId: string, telegramUser: any, lang: string) {
  console.log("handleBuyVariation called with variationId:", variationId);
  
  const { data: variation, error: varError } = await supabase
    .from("product_variations")
    .select("id, name, price, reseller_price, product_id")
    .eq("id", variationId)
    .single();

  console.log("Variation query result:", JSON.stringify(variation), "Error:", JSON.stringify(varError));

  if (!variation) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }

  // Fetch product separately
  const { data: product } = await supabase
    .from("products")
    .select("name, stock")
    .eq("id", variation.product_id)
    .single();

  const productName = `${product?.name || "Product"} - ${variation.name}`;
  const stock = product?.stock;
  if (stock !== null && stock !== undefined && stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  // Check if reseller - use reseller price
  const wallet = await getWallet(supabase, telegramUser.id);
  const isReseller = wallet?.is_reseller === true;
  const price = isReseller ? (variation.reseller_price || variation.price) : variation.price;

  await showPaymentInfo(token, supabase, chatId, telegramUser, productName, price, variation.product_id, variation.id, lang);
}

// ===== PAYMENT INFO WITH WALLET =====

const UPI_ID = "8900684167@ibl";
const UPI_NAME = "Asif Ikbal Rubaiul Islam";

function generateUpiLink(amount: number, productName: string): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&mc=0000&mode=02&purpose=00&am=${amount}&cu=INR&tn=${encodeURIComponent(productName.substring(0, 50))}`;
}

function generateUpiQrUrl(amount: number, productName: string): string {
  const upiString = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&mc=0000&mode=02&purpose=00&am=${amount}&cu=INR&tn=${encodeURIComponent(productName.substring(0, 50))}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiString)}`;
}

async function showPaymentInfo(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, price: number, productId: string, variationId: string | null, lang: string
) {
  console.log("showPaymentInfo called:", { productName, price, productId, variationId });
  
  const userId = telegramUser.id;
  const wallet = await ensureWallet(supabase, userId);
  const walletBalance = wallet?.balance || 0;
  const finalAmount = Math.max(0, price - walletBalance);
  const walletDeduction = Math.min(walletBalance, price);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  let text = `🛒 <b>${lang === "bn" ? "অর্ডার" : "Order"}: ${productName}</b>\n\n`;
  text += `💰 ${lang === "bn" ? "মূল্য" : "Price"}: <b>${currency}${price}</b>\n`;
  text += `💳 ${lang === "bn" ? "ওয়ালেট ব্যালেন্স" : "Wallet Balance"}: <b>${currency}${walletBalance}</b>\n`;
  if (walletDeduction > 0) {
    text += `🔻 ${lang === "bn" ? "ওয়ালেট কর্তন" : "Wallet Deduction"}: <b>-${currency}${walletDeduction}</b>\n`;
  }
  text += `\n💵 <b>${lang === "bn" ? "পরিশোধযোগ্য" : "Payable"}: ${currency}${finalAmount}</b>\n\n`;

  const buttons: any[][] = [];

  if (finalAmount === 0) {
    // Full wallet pay - store data in conversation state to avoid callback_data 64-byte limit
    await setConversationState(supabase, userId, "wallet_pay_confirm", {
      productName, price, productId, variationId,
    });
    buttons.push([{ text: t("pay_with_wallet", lang), callback_data: "walletpay_confirm" }]);
  } else {
    // Generate dynamic UPI link with exact amount
    const upiLink = generateUpiLink(finalAmount, productName);
    const qrUrl = generateUpiQrUrl(finalAmount, productName);

    console.log("Generated UPI link:", upiLink);
    console.log("Generated QR URL:", qrUrl);

    text += `<b>💳 ${lang === "bn" ? "পেমেন্ট করুন" : "Make Payment"}:</b>\n\n`;
    text += `📱 UPI ID: <code>${UPI_ID}</code>\n`;
    text += `💵 ${lang === "bn" ? "পরিমাণ" : "Amount"}: <b>${currency}${finalAmount}</b>\n\n`;
    text += `🌐 ${lang === "bn" ? "ইন্টারন্যাশনাল/বাইন্যান্স পেমেন্টের জন্য" : "For International/Binance Payment"}:\n`;
    text += `🆔 Binance ID: <code>1178303416</code>\n\n`;
    text += `${lang === "bn" ? "নীচের বাটনে ক্লিক করে পেমেন্ট করুন। তারপর পেমেন্ট স্ক্রিনশট পাঠান।" : "Click the button below to pay. Then send payment screenshot."}`;

    // Payment link button - directly opens UPI payment
    buttons.push([{ text: `💳 ${lang === "bn" ? "পেমেন্ট লিংক" : "Payment Link"}`, url: qrUrl }]);

    await setConversationState(supabase, userId, "awaiting_screenshot", {
      productName, price, finalAmount, productId, variationId, walletDeduction,
    });

    // Try sending QR code image, fallback to text if it fails
    try {
      const photoRes = await fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: qrUrl,
          caption: text,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: buttons },
        }),
      });
      const photoResult = await photoRes.json();
      console.log("sendPhoto result:", JSON.stringify(photoResult));
      
      if (!photoResult.ok) {
        console.log("sendPhoto failed, falling back to text message");
        await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
      }
    } catch (e) {
      console.error("sendPhoto error:", e);
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
    
    // Follow up with screenshot request
    await sendMessage(token, chatId, t("send_screenshot", lang));
    return;
  }

  buttons.push([{ text: t("back_products", lang), callback_data: "back_products" }]);
  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== WALLET PAY =====

async function handleWalletPay(token: string, supabase: any, chatId: number, userId: number, amount: number, productName: string, lang: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet || wallet.balance < amount) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ পর্যাপ্ত ব্যালেন্স নেই।" : "❌ Insufficient wallet balance.");
    return;
  }

  // Deduct wallet
  await supabase.from("telegram_wallets").update({
    balance: wallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  // Record transaction
  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId,
    type: "purchase_deduction",
    amount: -amount,
    description: `Purchase: ${productName}`,
  });

  // Create order
  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    username: `wallet_pay`,
    product_name: productName,
    amount: amount,
    status: "confirmed",
  }).select("id").single();

  // Notify user
  await sendMessage(token, chatId,
    t("wallet_paid", lang).replace("{amount}", String(amount)).replace("{product}", productName)
  );

  // Notify all admins
  await notifyAllAdmins(token, supabase,
    `💰 <b>Wallet Payment</b>\n\n👤 User: ${userId}\n📦 Product: ${productName}\n💵 Amount: ₹${amount}\n✅ Auto-confirmed (wallet pay)\n🆔 Order: ${order?.id?.slice(0, 8) || "N/A"}`
  );

  // Check referral bonus
  await processReferralBonus(supabase, userId, token);
}

// ===== REFERRAL BONUS =====

async function processReferralBonus(supabase: any, userId: number, token: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet?.referred_by) return;

  // Check if this is user's first purchase
  const { count } = await supabase
    .from("telegram_orders")
    .select("*", { count: "exact", head: true })
    .eq("telegram_user_id", userId)
    .eq("status", "confirmed");

  if (count === 1) {
    // First purchase - give referral bonus
    const settings = await getSettings(supabase);
    const bonus = parseFloat(settings.referral_bonus) || 10;

    const referrerWallet = await getWallet(supabase, wallet.referred_by);
    if (referrerWallet) {
      await supabase.from("telegram_wallets").update({
        balance: referrerWallet.balance + bonus,
        total_earned: referrerWallet.total_earned + bonus,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", wallet.referred_by);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: wallet.referred_by,
        type: "referral_bonus",
        amount: bonus,
        description: `Referral bonus for user ${userId}`,
      });

      // Notify referrer
      await sendMessage(token, wallet.referred_by,
        `🎉 <b>Referral Bonus!</b>\n\n₹${bonus} added to your wallet! Your referred user made their first purchase.`
      );
    }
  }
}

// ===== MY ORDERS =====

async function handleMyOrders(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const { data: orders } = await supabase
    .from("telegram_orders")
    .select("*")
    .eq("telegram_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!orders?.length) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? "📦 আপনার কোনো অর্ডার নেই।\n\nপ্রোডাক্ট কিনতে নিচের বাটনে ক্লিক করুন!"
        : "📦 You have no orders yet.\n\nClick below to browse products!",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "🛍️ পণ্য দেখুন" : "🛍️ View Products", callback_data: "view_products" }],
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      }
    );
    return;
  }

  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    confirmed: "✅",
    rejected: "❌",
    shipped: "📦",
    delivered: "🎉",
  };

  const statusText: Record<string, Record<string, string>> = {
    pending: { en: "Pending", bn: "অপেক্ষমান" },
    confirmed: { en: "Confirmed", bn: "নিশ্চিত" },
    rejected: { en: "Rejected", bn: "প্রত্যাখ্যাত" },
    shipped: { en: "Shipped", bn: "শিপ হয়েছে" },
    delivered: { en: "Delivered", bn: "ডেলিভারি হয়েছে" },
  };

  let text = lang === "bn"
    ? "📦 <b>আমার অর্ডারসমূহ</b> (সর্বশেষ ১০টি)\n\n"
    : "📦 <b>My Orders</b> (Last 10)\n\n";

  orders.forEach((o: any, i: number) => {
    const emoji = statusEmoji[o.status] || "📋";
    const status = statusText[o.status]?.[lang] || o.status;
    const date = new Date(o.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });

    text += `${i + 1}. ${emoji} <b>${o.product_name || "N/A"}</b>\n`;
    text += `   💵 ₹${o.amount} | ${lang === "bn" ? "স্ট্যাটাস" : "Status"}: <b>${status}</b>\n`;
    text += `   📅 ${date}\n`;
    if (o.status === "shipped" && o.product_name) {
      text += `   ${lang === "bn" ? "🎉 শীঘ্রই ডেলিভারি হবে!" : "🎉 Arriving soon!"}\n`;
    }
    text += "\n";
  });

  text += lang === "bn"
    ? "💡 <i>সমস্যা থাকলে সাপোর্টে যোগাযোগ করুন।</i>"
    : "💡 <i>Contact support if you have any issues.</i>";

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === "bn" ? "🛍️ আরো কিনুন" : "🛍️ Buy More", callback_data: "view_products" }],
        [{ text: t("support", lang), callback_data: "support" }],
        [{ text: t("back_main", lang), callback_data: "back_main" }],
      ],
    },
  });
}

// ===== MY WALLET =====

async function handleMyWallet(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const wallet = await ensureWallet(supabase, userId);
  const balance = wallet?.balance || 0;
  const totalEarned = wallet?.total_earned || 0;
  const refCode = wallet?.referral_code || "N/A";

  const { data: recent } = await supabase
    .from("telegram_wallet_transactions")
    .select("type, amount, description, created_at")
    .eq("telegram_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  let text = `${t("wallet_header", lang)}\n\n`;
  text += `💵 ${lang === "bn" ? "ব্যালেন্স" : "Balance"}: <b>₹${balance}</b>\n`;
  text += `📈 ${lang === "bn" ? "মোট আয়" : "Total Earned"}: <b>₹${totalEarned}</b>\n`;
  text += `🔗 ${lang === "bn" ? "রেফারেল কোড" : "Referral Code"}: <code>${refCode}</code>\n`;
  text += `📎 ${lang === "bn" ? "রেফারেল লিংক" : "Referral Link"}: https://t.me/${BOT_USERNAME}?start=ref_${refCode}\n`;

  if (recent?.length) {
    text += `\n<b>${lang === "bn" ? "সাম্প্রতিক লেনদেন:" : "Recent Transactions:"}</b>\n`;
    for (const tx of recent) {
      const emoji = tx.amount > 0 ? "🟢" : "🔴";
      const sign = tx.amount > 0 ? "+" : "";
      text += `${emoji} ${sign}₹${tx.amount} - ${tx.description || tx.type}\n`;
    }
  }

  await sendMessage(token, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] },
  });
}

// ===== REFER & EARN =====

async function handleReferEarn(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const wallet = await ensureWallet(supabase, userId);
  const refCode = wallet?.referral_code || "N/A";
  const settings = await getSettings(supabase);
  const bonus = settings.referral_bonus || "10";

  let text = `${t("referral_header", lang)}\n\n`;
  text += lang === "bn"
    ? `প্রতিটি রেফারেলের জন্য ₹${bonus} বোনাস পান!\n\n🔗 আপনার রেফারেল লিংক:\nhttps://t.me/${BOT_USERNAME}?start=ref_${refCode}\n\n📋 কোড: <code>${refCode}</code>\n\n1️⃣ লিংক শেয়ার করুন\n2️⃣ বন্ধু যোগ দিক\n3️⃣ তারা কেনাকাটা করলে আপনি বোনাস পাবেন!`
    : `Earn ₹${bonus} for every referral!\n\n🔗 Your referral link:\nhttps://t.me/${BOT_USERNAME}?start=ref_${refCode}\n\n📋 Code: <code>${refCode}</code>\n\n1️⃣ Share the link\n2️⃣ Friend joins\n3️⃣ When they purchase, you get a bonus!`;

  await sendMessage(token, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] },
  });
}

// ===== SUPPORT =====

async function handleSupport(token: string, supabase: any, chatId: number, lang: string) {
  const supportNumber = "+201556690444";

  const text = lang === "bn"
    ? `📞 <b>সাপোর্ট</b>\n\n24/7 সাহায্যের জন্য আমরা আছি!\n\n📱 WhatsApp: ${supportNumber}\n✈️ Telegram: ${supportNumber}`
    : `📞 <b>Support</b>\n\nWe're here 24/7!\n\n📱 WhatsApp: ${supportNumber}\n✈️ Telegram: ${supportNumber}`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💬 WhatsApp", url: `https://wa.me/${supportNumber.replace("+", "")}` }],
        [{ text: "✈️ Telegram", url: `https://t.me/${supportNumber.replace("+", "")}` }],
        [{ text: t("back_main", lang), callback_data: "back_main" }],
      ],
    },
  });
}

// ===== OFFERS =====

async function handleGetOffers(token: string, supabase: any, chatId: number, lang: string) {
  const { data: flashSales } = await supabase
    .from("flash_sales")
    .select("*, products(name, price, image_url)")
    .eq("is_active", true)
    .gt("end_time", new Date().toISOString())
    .limit(5);

  const { data: coupons } = await supabase
    .from("coupons")
    .select("code, description, discount_type, discount_value")
    .eq("is_active", true)
    .limit(5);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  let text = `🔥 <b>${lang === "bn" ? "বর্তমান অফার" : "Current Offers"}</b>\n\n`;
  if (flashSales?.length) {
    text += `⚡ <b>${lang === "bn" ? "ফ্ল্যাশ সেল" : "Flash Sales"}:</b>\n`;
    flashSales.forEach((s: any) => {
      text += `• ${s.products?.name || "Product"}: <b>${currency}${s.sale_price}</b> (was ${currency}${s.products?.price})\n`;
    });
    text += "\n";
  }
  if (coupons?.length) {
    text += `🎟️ <b>${lang === "bn" ? "কুপন কোড" : "Coupon Codes"}:</b>\n`;
    coupons.forEach((c: any) => {
      const disc = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `${currency}${c.discount_value} OFF`;
      text += `• <code>${c.code}</code> - ${disc}\n`;
    });
  }
  if (!flashSales?.length && !coupons?.length) {
    text += lang === "bn" ? "এখন কোনো অফার নেই। পরে দেখুন! 🔜" : "No offers right now. Check back later! 🔜";
  }

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: t("view_products", lang), callback_data: "view_products" }],
        [{ text: t("back_main", lang), callback_data: "back_main" }],
      ],
    },
  });
}

// ===== FORWARD USER MESSAGE TO ADMIN =====

async function forwardUserMessageToAdmin(token: string, supabase: any, msg: any, telegramUser: any, lang: string) {
  const userId = telegramUser.id;
  const username = telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name || "Unknown";

  // Forward to ALL admins
  await forwardToAllAdmins(token, supabase, msg.chat.id, msg.message_id);

  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    username,
    product_name: msg.text || (msg.photo ? "Screenshot/Photo" : "Message"),
    amount: 0,
    status: "pending",
    screenshot_file_id: msg.photo ? msg.photo[msg.photo.length - 1]?.file_id : null,
  }).select("id").single();

  const orderId = order?.id || "unknown";

  await notifyAllAdmins(token, supabase,
    `📩 <b>New message from customer</b>\n\n👤 From: <b>${username}</b>\n🆔 ID: <code>${userId}</code>\n📋 Order: <code>${orderId.slice(0, 8)}</code>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: `admin_confirm_${orderId}` },
            { text: "❌ Reject", callback_data: `admin_reject_${orderId}` },
          ],
          [{ text: "📦 Shipped", callback_data: `admin_ship_${orderId}` }],
          [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
        ],
      },
    }
  );
}

// ===== ADMIN ACTION =====

async function handleAdminAction(token: string, supabase: any, orderId: string, newStatus: string, adminChatId: number) {
  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  // Get user language
  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";

  await supabase.from("telegram_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);

  const msgKey: Record<string, string> = { confirmed: "order_confirmed", rejected: "order_rejected", shipped: "order_shipped" };
  await sendMessage(token, order.telegram_user_id, t(msgKey[newStatus] || "order_confirmed", userLang));

  // If confirmed, process referral and reseller profit
  if (newStatus === "confirmed") {
    await processReferralBonus(supabase, order.telegram_user_id, token);

    // Credit reseller profit
    if (order.reseller_telegram_id && order.reseller_profit > 0) {
      const resellerWallet = await getWallet(supabase, order.reseller_telegram_id);
      if (resellerWallet) {
        await supabase.from("telegram_wallets").update({
          balance: resellerWallet.balance + order.reseller_profit,
          total_earned: resellerWallet.total_earned + order.reseller_profit,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.reseller_telegram_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.reseller_telegram_id,
          type: "resale_profit",
          amount: order.reseller_profit,
          description: `Resale profit: ${order.product_name}`,
        });

        // Notify reseller
        try {
          await sendMessage(token, order.reseller_telegram_id,
            `💰 <b>Resale Profit!</b>\n\n₹${order.reseller_profit} added to your wallet!\nProduct: ${order.product_name}`
          );
        } catch { /* reseller may have blocked bot */ }
      }
    }
  }

  const emoji: Record<string, string> = { confirmed: "✅", rejected: "❌", shipped: "📦" };
  await sendMessage(token, adminChatId, `${emoji[newStatus] || "📋"} Order <b>${orderId.slice(0, 8)}</b> → <b>${newStatus.toUpperCase()}</b>`);
}

// ===== ADMIN MENU =====

async function handleAdminMenu(token: string, supabase: any, chatId: number) {
  const { count: userCount } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: orderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { count: walletCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true });
  const { count: resellerCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true }).eq("is_reseller", true);

  await sendMessage(token, chatId,
    `🔐 <b>Admin Control Panel</b>\n\n` +
    `👥 Bot Users: <b>${userCount || 0}</b>\n` +
    `📦 Orders: <b>${orderCount || 0}</b>\n` +
    `💰 Wallets: <b>${walletCount || 0}</b>\n` +
    `🔄 Resellers: <b>${resellerCount || 0}</b>\n\n` +
    `<b>Commands:</b>\n` +
    `/broadcast - Broadcast to all\n` +
    `/report or /stats - Analytics\n` +
    `/add_product - Add product\n` +
    `/edit_price [name] [price]\n` +
    `/out_stock [name]\n` +
    `/users - Recent users\n` +
    `/allusers - All users list\n` +
    `/history [id] - Order history\n` +
    `/ban [id] / /unban [id]\n` +
    `/make_reseller [id]\n` +
    `/add_admin [id] - Add admin (Owner only)\n` +
    `/remove_admin [id] - Remove admin (Owner only)\n` +
    `/admins - List admins (Owner only)`
  );
}

// ===== REPORT =====

async function handleReport(token: string, supabase: any, chatId: number) {
  const { count: totalUsers } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: totalWallets } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true });
  const { count: resellerCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true }).eq("is_reseller", true);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const { count: todayOrderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString());
  const { data: confirmedToday } = await supabase.from("telegram_orders").select("amount").eq("status", "confirmed").gte("created_at", today.toISOString());
  const todayRevenue = confirmedToday?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;

  const { count: allOrders } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { data: allConfirmed } = await supabase.from("telegram_orders").select("amount").eq("status", "confirmed");
  const allRevenue = allConfirmed?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;

  const { data: walletSum } = await supabase.from("telegram_wallets").select("balance");
  const totalWalletBalance = walletSum?.reduce((s: number, w: any) => s + (w.balance || 0), 0) || 0;

  await sendMessage(token, chatId,
    `📊 <b>Sales & Analytics Report</b>\n\n` +
    `👥 Users: <b>${totalUsers || 0}</b>\n` +
    `💰 Wallets: <b>${totalWallets || 0}</b>\n` +
    `🔄 Resellers: <b>${resellerCount || 0}</b>\n` +
    `💵 Total Wallet Balance: <b>₹${totalWalletBalance}</b>\n\n` +
    `📅 <b>Today:</b>\n• Orders: ${todayOrderCount || 0}\n• Revenue: ₹${todayRevenue}\n\n` +
    `📈 <b>All Time:</b>\n• Orders: ${allOrders || 0}\n• Revenue: ₹${allRevenue}`
  );
}

// ===== CONVERSATION STEP =====

async function handleConversationStep(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  if (text === "/cancel") {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, "❌ Cancelled.");
    return;
  }

  // Awaiting payment screenshot
  if (state.step === "awaiting_screenshot") {
    if (!msg.photo) {
      const lang = (await getUserLang(supabase, userId)) || "en";
      await sendMessage(token, chatId, lang === "bn" ? "📸 অনুগ্রহ করে পেমেন্ট স্ক্রিনশট পাঠান (ছবি হিসেবে)।" : "📸 Please send the payment screenshot as a photo.");
      return;
    }

    const orderData = state.data;
    await deleteConversationState(supabase, userId);
    const lang = (await getUserLang(supabase, userId)) || "en";
    const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";

    // Create order in DB
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId,
      username,
      product_name: orderData.productName,
      product_id: orderData.productId || null,
      amount: orderData.finalAmount || orderData.price,
      status: "pending",
      screenshot_file_id: msg.photo[msg.photo.length - 1]?.file_id || null,
      reseller_telegram_id: orderData.reseller_telegram_id || null,
      reseller_profit: orderData.reseller_profit || null,
    }).select("id").single();

    const orderId = order?.id || "unknown";

    // Notify user
    await sendMessage(token, chatId,
      lang === "bn"
        ? "✅ <b>স্ক্রিনশট পাঠানো হয়েছে!</b>\n\nঅ্যাডমিন যাচাই করছে। শীঘ্রই আপডেট পাবেন। ⏳"
        : "✅ <b>Screenshot received!</b>\n\nAdmin is verifying your payment. You'll get an update soon. ⏳"
    );

    // Forward screenshot to all admins
    await forwardToAllAdmins(token, supabase, chatId, msg.message_id);

    // Send admin action buttons to all admins
    let adminMsg = `📩 <b>Payment Screenshot</b>\n\n` +
      `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
      `📦 Product: <b>${orderData.productName}</b>\n` +
      `💵 Amount: <b>₹${orderData.finalAmount || orderData.price}</b>\n` +
      `🆔 Order: <code>${orderId.toString().slice(0, 8)}</code>`;

    // Add variation info if available
    if (orderData.variationId) {
      const { data: varInfo } = await supabase.from("product_variations").select("name").eq("id", orderData.variationId).single();
      if (varInfo) {
        adminMsg += `\n📋 Variation: <b>${varInfo.name}</b>`;
      }
    }

    if (orderData.walletDeduction > 0) {
      adminMsg += `\n💳 Wallet Deduction: ₹${orderData.walletDeduction}`;
    }

    if (orderData.reseller_telegram_id) {
      adminMsg += `\n🔄 <b>Resale Order</b> — Reseller: <code>${orderData.reseller_telegram_id}</code>, Profit: ₹${orderData.reseller_profit}`;
    }

    await notifyAllAdmins(token, supabase, adminMsg,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `admin_confirm_${orderId}` },
              { text: "❌ Reject", callback_data: `admin_reject_${orderId}` },
            ],
            [{ text: "📦 Shipped", callback_data: `admin_ship_${orderId}` }],
            [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
          ],
        },
      }
    );
    return;
  }

  // Admin reply to user (persistent chat mode)
  if (state.step === "admin_reply") {
    const targetUserId = state.data.targetUserId;
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      await sendMessage(token, chatId, `✅ Chat with user <code>${targetUserId}</code> ended.`);
      return;
    }
    // Forward admin's message to the target user
    if (msg.photo) {
      await forwardMessage(token, targetUserId, chatId, msg.message_id);
    } else {
      await sendMessage(token, targetUserId, `📩 <b>Admin:</b>\n\n${text}`);
    }
    await sendMessage(token, chatId, `✅ Sent to <code>${targetUserId}</code>. Continue typing or /endchat to stop.`);
    // Don't delete state - keep chat mode active
    return;
  }

  // User chatting with admin (AI disabled, messages forwarded)
  if (state.step === "chatting_with_admin") {
    if (text === "/endchat" || text === "/cancel") {
      await deleteConversationState(supabase, userId);
      const lang2 = (await getUserLang(supabase, userId)) || "en";
      await sendMessage(token, chatId, lang2 === "bn"
        ? "✅ চ্যাট শেষ হয়েছে। মূল মেনুতে ফিরে যাচ্ছি..."
        : "✅ Chat ended. Returning to main menu..."
      );
      await showMainMenu(token, supabase, chatId, lang2);
      return;
    }
    // Forward user message (text or photo) to all admins
    const username = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || "Unknown";
    await forwardToAllAdmins(token, supabase, chatId, msg.message_id);
    await notifyAllAdmins(token, supabase,
      `💬 <b>Live Chat</b> from <b>${username}</b> (<code>${userId}</code>)`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "💬 Reply", callback_data: `admin_chat_${userId}` }]],
        },
      }
    );
    return;
  }

  // Broadcast
  if (state.step === "broadcast_message") {
    await deleteConversationState(supabase, userId);
    await executeBroadcast(token, supabase, chatId, msg);
    return;
  }

  // Resale price entry
  if (state.step === "resale_price") {
    const price = parseFloat(text);
    const resellerPrice = state.data.reseller_price;
    const lang = state.data.lang || "en";

    if (isNaN(price) || price <= resellerPrice) {
      await sendMessage(token, chatId, t("resale_price_low", lang).replace("{price}", String(resellerPrice)));
      return;
    }

    await deleteConversationState(supabase, userId);

    // Generate link
    const linkCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error: insertError } = await supabase.from("telegram_resale_links").insert({
      reseller_telegram_id: userId,
      product_id: state.data.product_id,
      variation_id: state.data.variation_id || null,
      custom_price: price,
      reseller_price: resellerPrice,
      link_code: linkCode,
    });

    if (insertError) {
      console.error("Resale link insert error:", insertError);
      await sendMessage(token, chatId, "❌ Failed to create resale link. Please try again.");
      return;
    }

    const profit = price - resellerPrice;
    const linkMsg = `✅ <b>${lang === "bn" ? "রিসেল লিংক তৈরি হয়েছে!" : "Resale Link Created!"}</b>\n\n` +
      `🔗 Link: <code>https://t.me/${BOT_USERNAME}?start=buy_${linkCode}</code>\n` +
      `💰 ${lang === "bn" ? "আপনার মূল্য" : "Your Price"}: ₹${price}\n` +
      `📦 ${lang === "bn" ? "রিসেলার মূল্য" : "Reseller Price"}: ₹${resellerPrice}\n` +
      `💵 ${lang === "bn" ? "প্রতি বিক্রয়ে লাভ" : "Profit per sale"}: ₹${profit}`;

    await sendMessage(token, chatId, linkMsg);
    return;
  }

  // Add product flow
  switch (state.step) {
    case "add_photo": {
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        const fileRes = await fetch(`${TELEGRAM_API(token)}/getFile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: photo.file_id }),
        });
        const fileData = await fileRes.json();
        const filePath = fileData.result?.file_path;
        const image_url = filePath ? `https://api.telegram.org/file/bot${token}/${filePath}` : "";
        await setConversationState(supabase, userId, "add_name", { ...state.data, image_url });
        await sendMessage(token, chatId, "✅ Photo received!\n📝 <b>Step 2/4:</b> Enter product name.");
      } else {
        await sendMessage(token, chatId, "⚠️ Please send a photo.");
      }
      break;
    }
    case "add_name":
      await setConversationState(supabase, userId, "add_price", { ...state.data, name: text });
      await sendMessage(token, chatId, `✅ Name: <b>${text}</b>\n💰 <b>Step 3/4:</b> Enter price.`);
      break;
    case "add_price": {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) { await sendMessage(token, chatId, "⚠️ Enter a valid price."); break; }
      await setConversationState(supabase, userId, "add_category", { ...state.data, price });
      await sendMessage(token, chatId, `✅ Price: ₹${price}\n📂 <b>Step 4/4:</b> Enter category.`);
      break;
    }
    case "add_category": {
      await deleteConversationState(supabase, userId);
      const slug = state.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
      const { data: product, error } = await supabase.from("products").insert({
        name: state.data.name, price: state.data.price, category: text,
        slug, image_url: state.data.image_url || null, is_active: true,
      }).select("id").single();

      if (error) {
        await sendMessage(token, chatId, `❌ Failed: ${error.message}`);
      } else {
        await sendMessage(token, chatId,
          `✅ <b>Product Added!</b>\n📦 ${state.data.name}\n💰 ₹${state.data.price}\n📂 ${text}\n🆔 <code>${product.id}</code>`
        );
      }
      break;
    }
  }
}

// ===== BROADCAST =====

async function executeBroadcast(token: string, supabase: any, adminChatId: number, msg: any) {
  const { data: users } = await supabase.from("telegram_bot_users").select("telegram_id").eq("is_banned", false);
  if (!users?.length) { await sendMessage(token, adminChatId, "No users to broadcast to."); return; }

  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      if (user.telegram_id === SUPER_ADMIN_ID) { sent++; continue; }
      if (msg.photo) {
        await sendPhoto(token, user.telegram_id, msg.photo[msg.photo.length - 1].file_id, msg.caption || "");
      } else if (msg.text) {
        await sendMessage(token, user.telegram_id, msg.text);
      }
      sent++;
    } catch { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }
  await sendMessage(token, adminChatId, `📢 <b>Broadcast Complete!</b>\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
}

// ===== EDIT PRICE =====

async function handleEditPrice(token: string, supabase: any, chatId: number, args: string) {
  const lastSpace = args.lastIndexOf(" ");
  if (lastSpace === -1) { await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>"); return; }
  const name = args.substring(0, lastSpace).trim();
  const newPrice = parseFloat(args.substring(lastSpace + 1));
  if (!name || isNaN(newPrice)) { await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>"); return; }

  const { data, error } = await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).ilike("name", `%${name}%`).select("name, price");
  if (error || !data?.length) { await sendMessage(token, chatId, `❌ "${name}" not found.`); }
  else { await sendMessage(token, chatId, `✅ ${data[0].name} → ₹${newPrice}`); }
}

// ===== OUT STOCK =====

async function handleOutStock(token: string, supabase: any, chatId: number, name: string) {
  if (!name) { await sendMessage(token, chatId, "⚠️ Usage: <code>/out_stock Name</code>"); return; }
  const { data, error } = await supabase.from("products").update({ stock: 0, is_active: false }).ilike("name", `%${name}%`).select("name");
  if (error || !data?.length) { await sendMessage(token, chatId, `❌ "${name}" not found.`); }
  else { await sendMessage(token, chatId, `✅ ${data[0].name} → Out of Stock`); }
}

// ===== USERS =====

async function handleUsersCommand(token: string, supabase: any, chatId: number) {
  const { count } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { data: recent } = await supabase.from("telegram_bot_users").select("telegram_id, username, first_name, created_at").order("created_at", { ascending: false }).limit(10);

  let text = `👥 <b>Users: ${count || 0}</b>\n\n`;
  recent?.forEach((u: any) => {
    text += `• ${u.username ? "@" + u.username : u.first_name || "?"} (${u.telegram_id})\n`;
  });
  await sendMessage(token, chatId, text);
}

// ===== HISTORY =====

async function handleHistoryCommand(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/history 123456</code>"); return; }
  const { data: orders } = await supabase.from("telegram_orders").select("*").eq("telegram_user_id", tgId).order("created_at", { ascending: false }).limit(20);
  if (!orders?.length) { await sendMessage(token, chatId, `No orders for ${tgId}.`); return; }

  let text = `📜 <b>History for ${tgId}</b>\n\n`;
  orders.forEach((o: any, i: number) => {
    const e = { pending: "⏳", confirmed: "✅", rejected: "❌", shipped: "📦" }[o.status] || "📋";
    text += `${i + 1}. ${e} ${o.product_name || "N/A"} - ₹${o.amount}\n`;
  });
  await sendMessage(token, chatId, text);
}

// ===== BAN =====

async function handleBanCommand(token: string, supabase: any, chatId: number, tgId: number, ban: boolean) {
  if (!tgId) { await sendMessage(token, chatId, `⚠️ Usage: <code>/${ban ? "ban" : "unban"} 123456</code>`); return; }
  await supabase.from("telegram_bot_users").update({ is_banned: ban }).eq("telegram_id", tgId);
  await sendMessage(token, chatId, ban ? `🚫 ${tgId} BANNED` : `✅ ${tgId} UNBANNED`);
}

// ===== MAKE RESELLER =====

async function handleMakeReseller(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/make_reseller 123456</code>"); return; }

  // Ensure wallet exists
  const wallet = await getWallet(supabase, tgId);
  if (!wallet) {
    await ensureWallet(supabase, tgId);
  }

  const currentWallet = await getWallet(supabase, tgId);
  const newStatus = !currentWallet?.is_reseller;

  await supabase.from("telegram_wallets").update({ is_reseller: newStatus }).eq("telegram_id", tgId);

  await sendMessage(token, chatId,
    newStatus
      ? `✅ User <code>${tgId}</code> is now a <b>RESELLER</b>!`
      : `❌ User <code>${tgId}</code> reseller status <b>REMOVED</b>.`
  );

  // Notify user
  try {
    await sendMessage(token, tgId,
      newStatus
        ? "🎉 You've been granted <b>Reseller</b> status! You can now create resale links on products."
        : "ℹ️ Your reseller status has been removed."
    );
  } catch { /* user may have blocked bot */ }
}

// ===== ADD ADMIN =====

async function handleAddAdmin(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/add_admin 123456</code>"); return; }

  // Check if already admin
  const { data: existing } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", tgId).maybeSingle();
  if (existing) { await sendMessage(token, chatId, `⚠️ User <code>${tgId}</code> is already an admin.`); return; }

  // Check if user exists in bot
  const { data: user } = await supabase.from("telegram_bot_users").select("username, first_name").eq("telegram_id", tgId).maybeSingle();
  if (!user) { await sendMessage(token, chatId, `❌ User <code>${tgId}</code> not found in bot users.`); return; }

  await supabase.from("telegram_bot_admins").insert({ telegram_id: tgId, added_by: SUPER_ADMIN_ID });

  const name = user.username ? `@${user.username}` : user.first_name || String(tgId);
  await sendMessage(token, chatId, `✅ <b>${name}</b> (<code>${tgId}</code>) is now an <b>Admin</b>!`);

  // Notify the new admin
  try {
    await sendMessage(token, tgId, "🎉 You've been granted <b>Admin</b> access on the bot! Use /admin to see commands.");
  } catch { /* user may have blocked bot */ }
}

// ===== REMOVE ADMIN =====

async function handleRemoveAdmin(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/remove_admin 123456</code>"); return; }

  if (tgId === SUPER_ADMIN_ID) { await sendMessage(token, chatId, "❌ Cannot remove the Super Admin."); return; }

  const { data: existing } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", tgId).maybeSingle();
  if (!existing) { await sendMessage(token, chatId, `⚠️ User <code>${tgId}</code> is not an admin.`); return; }

  await supabase.from("telegram_bot_admins").delete().eq("telegram_id", tgId);
  await sendMessage(token, chatId, `✅ Admin <code>${tgId}</code> has been <b>removed</b>.`);

  try {
    await sendMessage(token, tgId, "ℹ️ Your admin access has been revoked.");
  } catch { /* user may have blocked bot */ }
}

// ===== LIST ADMINS =====

async function handleListAdmins(token: string, supabase: any, chatId: number) {
  const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id, created_at").order("created_at", { ascending: true });

  let text = `👑 <b>Admin List</b>\n\n`;
  text += `🔹 <code>${SUPER_ADMIN_ID}</code> — <b>Super Admin (Owner)</b>\n`;

  if (admins?.length) {
    for (const a of admins) {
      const { data: user } = await supabase.from("telegram_bot_users").select("username, first_name").eq("telegram_id", a.telegram_id).maybeSingle();
      const name = user?.username ? `@${user.username}` : user?.first_name || "Unknown";
      text += `🔹 <code>${a.telegram_id}</code> — ${name}\n`;
    }
  }

  text += `\nTotal: <b>${(admins?.length || 0) + 1}</b> admins`;
  await sendMessage(token, chatId, text);
}

// ===== ALL USERS (PAGINATED) =====

async function handleAllUsers(token: string, supabase: any, chatId: number, page: number) {
  const PAGE_SIZE = 20;
  const offset = page * PAGE_SIZE;

  const { count } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const totalUsers = count || 0;
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

  const { data: users } = await supabase
    .from("telegram_bot_users")
    .select("telegram_id, username, first_name, last_name, is_banned, last_active")
    .order("last_active", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!users?.length) {
    await sendMessage(token, chatId, "📭 No users found.");
    return;
  }

  let text = `👥 <b>All Users</b> (Page ${page + 1}/${totalPages})\n`;
  text += `Total: <b>${totalUsers}</b>\n\n`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const name = u.username ? `@${u.username}` : `${u.first_name || ""}${u.last_name ? " " + u.last_name : ""}`.trim() || "Unknown";
    const banned = u.is_banned ? " 🚫" : "";
    text += `${offset + i + 1}. ${name}${banned}\n   ID: <code>${u.telegram_id}</code>\n`;
  }

  const buttons: any[][] = [];
  const navRow: any[] = [];
  if (page > 0) navRow.push({ text: "⬅️ Previous", callback_data: `allusers_page_${page - 1}` });
  if (page < totalPages - 1) navRow.push({ text: "Next ➡️", callback_data: `allusers_page_${page + 1}` });
  if (navRow.length) buttons.push(navRow);

  await sendMessage(token, chatId, text, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : undefined);
}

// ===== RESALE START =====

async function handleResaleStart(token: string, supabase: any, chatId: number, userId: number, productId: string, variationId: string | null, lang: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet?.is_reseller) {
    await sendMessage(token, chatId, t("resale_not_reseller", lang));
    return;
  }

  const { data: product } = await supabase.from("products").select("id, name, reseller_price, price").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }

  const resellerPrice = product.reseller_price || product.price;

  await setConversationState(supabase, userId, "resale_price", {
    product_id: productId, variation_id: variationId, reseller_price: resellerPrice, lang,
  });

  await sendMessage(token, chatId,
    t("resale_enter_price", lang).replace("{price}", String(resellerPrice))
  );
}

// ===== RESALE VARIATION START =====

async function handleResaleVariationStart(token: string, supabase: any, chatId: number, userId: number, variationId: string, lang: string) {
  const wallet = await getWallet(supabase, userId);
  if (!wallet?.is_reseller) {
    await sendMessage(token, chatId, t("resale_not_reseller", lang));
    return;
  }

  const { data: variation } = await supabase
    .from("product_variations")
    .select("id, name, price, reseller_price, product_id")
    .eq("id", variationId)
    .single();
  if (!variation) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }

  const resellerPrice = variation.reseller_price || variation.price;

  await setConversationState(supabase, userId, "resale_price", {
    product_id: variation.product_id, variation_id: variationId, reseller_price: resellerPrice, lang,
  });

  await sendMessage(token, chatId,
    `🔄 <b>${variation.name}</b>\n\n` + t("resale_enter_price", lang).replace("{price}", String(resellerPrice))
  );
}

// ===== RESALE BUY (via deep link) =====

async function handleResaleBuy(token: string, supabase: any, chatId: number, userId: number, telegramUser: any, linkCode: string, lang: string) {
  const { data: link } = await supabase.from("telegram_resale_links").select("*").eq("link_code", linkCode).eq("is_active", true).single();

  if (!link) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ লিংক পাওয়া যায়নি বা মেয়াদ শেষ।" : "❌ Link not found or expired.");
    return;
  }

  // Get product name + variation name
  const { data: product } = await supabase.from("products").select("name").eq("id", link.product_id).single();
  let productName = product?.name || "Product";
  if (link.variation_id) {
    const { data: variation } = await supabase.from("product_variations").select("name").eq("id", link.variation_id).single();
    if (variation) productName += ` - ${variation.name}`;
  }

  // Show payment for custom price - this sets conversation state to awaiting_screenshot
  await showPaymentInfo(token, supabase, chatId, telegramUser, productName, link.custom_price, link.product_id, link.variation_id, lang);

  // Update the conversation state to include resale link info for profit crediting
  const currentState = await getConversationState(supabase, userId);
  if (currentState) {
    await setConversationState(supabase, userId, currentState.step, {
      ...currentState.data,
      resale_link_id: link.id,
      reseller_telegram_id: link.reseller_telegram_id,
      reseller_profit: link.custom_price - link.reseller_price,
    });
  }

  // Increment uses
  await supabase.from("telegram_resale_links").update({ uses: link.uses + 1 }).eq("id", link.id);
}

// ===== START WITH REF =====

async function handleStartWithRef(supabase: any, userId: number, refCode: string) {
  const wallet = await ensureWallet(supabase, userId);
  if (wallet?.referred_by) return; // Already referred

  // Find referrer
  const { data: referrer } = await supabase.from("telegram_wallets").select("telegram_id").eq("referral_code", refCode).single();
  if (referrer && referrer.telegram_id !== userId) {
    await supabase.from("telegram_wallets").update({ referred_by: referrer.telegram_id }).eq("telegram_id", userId);
  }
}

// ===== AI QUERY =====

async function handleAIQuery(token: string, supabase: any, chatId: number, userId: number, question: string, lang: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    await sendMessage(token, chatId, lang === "bn" ? "AI সাময়িকভাবে অনুপলব্ধ।" : "AI is temporarily unavailable.");
    return;
  }

  // Fetch rich product context with variations
  const [productsRes, categoriesRes, flashSalesRes, couponsRes, walletRes] = await Promise.all([
    supabase.from("products").select("name, price, original_price, category, description, stock, reseller_price, is_active").eq("is_active", true).limit(100),
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
    supabase.from("flash_sales").select("sale_price, products(name, price)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
    supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
    supabase.from("telegram_wallets").select("balance, referral_code").eq("telegram_id", userId).single(),
  ]);

  // Fetch variations for all products
  const products = productsRes.data || [];
  const productIds = products.map((p: any) => p.name);
  const { data: allVariations } = await supabase.from("product_variations").select("name, price, original_price, reseller_price, product_id, is_active, products(name)").eq("is_active", true);

  // Build detailed product catalog
  const productCatalog = products.map((p: any) => {
    const vars = (allVariations || []).filter((v: any) => v.products?.name === p.name);
    let info = `📦 ${p.name} — ₹${p.price}`;
    if (p.original_price && p.original_price > p.price) info += ` (MRP: ₹${p.original_price}, ${Math.round((1 - p.price / p.original_price) * 100)}% OFF)`;
    if (p.stock !== null && p.stock !== undefined) info += ` | Stock: ${p.stock > 0 ? p.stock : "OUT OF STOCK ❌"}`;
    info += ` | Category: ${p.category}`;
    if (p.description) info += ` | ${p.description.slice(0, 80)}`;
    if (vars.length > 0) {
      info += `\n   Variations: ${vars.map((v: any) => {
        let vInfo = `${v.name}: ₹${v.price}`;
        if (v.original_price && v.original_price > v.price) vInfo += ` (was ₹${v.original_price})`;
        return vInfo;
      }).join(" | ")}`;
    }
    return info;
  }).join("\n");

  const categoryList = (categoriesRes.data || []).map((c: any) => c.name).join(", ");

  // Flash sales context
  const flashSaleInfo = (flashSalesRes.data || []).map((s: any) =>
    `⚡ ${s.products?.name || "Product"}: ₹${s.sale_price} (was ₹${s.products?.price})`
  ).join("\n") || "No active flash sales";

  // Coupon context
  const couponInfo = (couponsRes.data || []).map((c: any) => {
    const disc = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`;
    return `🎟️ ${c.code}: ${disc}${c.description ? ` - ${c.description}` : ""}`;
  }).join("\n") || "No active coupons";

  // User wallet context
  const walletBalance = walletRes.data?.balance || 0;
  const refCode = walletRes.data?.referral_code || "";

  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";
  const supportNumber = "+201556690444";

  const systemPrompt = `You are the smart, friendly AI assistant for "${appName}" — a Telegram-based digital premium products store. You are an expert sales assistant.

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}

${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

👤 THIS USER'S WALLET: ₹${walletBalance}
${refCode ? `🔗 Their Referral Code: ${refCode}` : ""}

📞 Support WhatsApp/Telegram: ${supportNumber}

STRICT RULES:
1. GREETINGS: If someone says "hi", "hello", "হাই", "হ্যালো", "hey", "assalamualaikum", "কেমন আছেন" etc., respond warmly, introduce the store, and highlight 2-3 best products or current offers.
2. PRODUCT QUERIES: When asked about a product, give EXACT price, variations (if any), stock status, and discount info. Never guess prices.
3. COMPARISONS: If asked to compare products or suggest alternatives, do it intelligently using the catalog data.
4. PRICE/BUDGET: If user mentions a budget, recommend products within that range.
5. STOCK: If a product is out of stock (stock=0), clearly say so and suggest alternatives in the same category.
6. OFFERS: Proactively mention flash sales and coupons when relevant to the user's query.
7. WALLET: If user asks about wallet/balance, tell them their balance (₹${walletBalance}).
8. REFERRAL: If asked about referral/earning, explain the referral system and share their code if available.
9. RETURNS/REFUNDS: ALWAYS say: "We have a strict No-Return Policy. All sales are final." / "আমাদের কোনো রিটার্ন পলিসি নেই। সকল বিক্রয় চূড়ান্ত।"
10. LANGUAGE: Answer in ${lang === "bn" ? "Bengali" : "English"}.
11. CONCISE: Keep responses helpful but concise (max 8-10 lines). Use emojis.
12. BUYING: If user wants to buy, tell them to click "🛒 View Products" in the menu or type /products to browse and purchase.
13. DO NOT share any website/store links. Only mention products, prices, and the bot's commands.
14. UPSELL: When relevant, suggest complementary or popular products.
15. If you truly cannot answer or the question is unrelated, say you'll forward to admin.
16. Never make up product info that's not in the catalog.
17. For order status questions, tell them to contact admin via Support button.`;

  try {
    await sendMessage(token, chatId, lang === "bn" ? "🤖 চিন্তা করছি..." : "🤖 Thinking...");

    // Fetch last 10 messages for conversation history
    const { data: historyRows } = await supabase
      .from("telegram_ai_messages")
      .select("role, content")
      .eq("telegram_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Build messages array: system + history (reversed to chronological) + new question
    const historyMessages = (historyRows || []).reverse().map((m: any) => ({
      role: m.role as string,
      content: m.content as string,
    }));

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: question },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content || "";

    // Save user question and AI answer to history
    await supabase.from("telegram_ai_messages").insert([
      { telegram_id: userId, role: "user", content: question },
      ...(answer ? [{ telegram_id: userId, role: "assistant", content: answer }] : []),
    ]);

    // Clean old messages (keep last 20 per user)
    const { data: oldMessages } = await supabase
      .from("telegram_ai_messages")
      .select("id")
      .eq("telegram_id", userId)
      .order("created_at", { ascending: false })
      .range(20, 1000);
    if (oldMessages?.length) {
      await supabase.from("telegram_ai_messages").delete().in("id", oldMessages.map((m: any) => m.id));
    }

    if (!answer || answer.toLowerCase().includes("forward") || answer.toLowerCase().includes("admin")) {
      await sendMessage(token, chatId, t("ai_forward", lang), {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin" }],
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      });
    } else {
      await sendMessage(token, chatId, `🤖 ${answer}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "🛒 প্রোডাক্ট দেখুন" : "🛒 View Products", callback_data: "view_products" }],
            [{ text: lang === "bn" ? "📩 অ্যাডমিনকে জিজ্ঞাসা করুন" : "📩 Ask Admin", callback_data: "forward_to_admin" }],
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      });
    }
  } catch (error) {
    console.error("AI query error:", error);
    await sendMessage(token, chatId, t("ai_forward", lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin" }],
        ],
      },
    });
  }
}
