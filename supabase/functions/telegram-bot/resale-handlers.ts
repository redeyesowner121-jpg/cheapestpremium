// ===== RESALE HANDLERS =====

import { t, BOT_USERNAME } from "./constants.ts";
import { sendMessage } from "./telegram-api.ts";
import { getWallet, setConversationState, getConversationState, ensureWallet } from "./db-helpers.ts";
import { showPaymentInfo } from "./payment/buy-handlers.ts";

// ===== RESALE START =====

export async function handleResaleStart(token: string, supabase: any, chatId: number, userId: number, productId: string, variationId: string | null, lang: string) {
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

export async function handleResaleVariationStart(token: string, supabase: any, chatId: number, userId: number, variationId: string, lang: string) {
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

export async function handleResaleBuy(token: string, supabase: any, chatId: number, userId: number, telegramUser: any, linkCode: string, lang: string) {
  const { data: link } = await supabase.from("telegram_resale_links").select("*").eq("link_code", linkCode).eq("is_active", true).single();

  if (!link) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ লিংক পাওয়া যায়নি বা মেয়াদ শেষ।" : "❌ Link not found or expired.");
    return;
  }

  const { data: product } = await supabase.from("products").select("name").eq("id", link.product_id).single();
  let productName = product?.name || "Product";
  if (link.variation_id) {
    const { data: variation } = await supabase.from("product_variations").select("name").eq("id", link.variation_id).single();
    if (variation) productName += ` - ${variation.name}`;
  }

  await showPaymentInfo(token, supabase, chatId, telegramUser, productName, link.custom_price, link.product_id, link.variation_id, lang);

  const currentState = await getConversationState(supabase, userId);
  if (currentState) {
    await setConversationState(supabase, userId, currentState.step, {
      ...currentState.data,
      resale_link_id: link.id,
      reseller_telegram_id: link.reseller_telegram_id,
      reseller_profit: link.custom_price - link.reseller_price,
    });
  }

  await supabase.from("telegram_resale_links").update({ uses: link.uses + 1 }).eq("id", link.id);
}

// ===== START WITH REF =====

export async function handleStartWithRef(token: string, supabase: any, userId: number, telegramUser: any, refCode: string, lang: string) {
  const wallet = await ensureWallet(supabase, userId);
  if (wallet?.referred_by) return;

  const { data: referrer } = await supabase.from("telegram_wallets").select("telegram_id").eq("referral_code", refCode).single();
  if (referrer && referrer.telegram_id !== userId) {
    await supabase.from("telegram_wallets").update({ referred_by: referrer.telegram_id }).eq("telegram_id", userId);

    // Get referrer's info for welcome message
    const { data: referrerUser } = await supabase.from("telegram_bot_users").select("first_name, username").eq("telegram_id", referrer.telegram_id).single();
    const referrerName = referrerUser?.first_name || referrerUser?.username || "Someone";

    // Get referred user's name
    const newUserName = telegramUser.first_name || telegramUser.username || "New User";

    // Send welcome message to the new user
    const welcomeMsg = lang === "bn"
      ? `🎉 <b>স্বাগতম!</b>\n\nআপনি <b>${referrerName}</b> এর রেফারেল লিঙ্কের মাধ্যমে জয়েন করেছেন। 🤝\n\nআমাদের প্ল্যাটফর্মে আপনাকে পেয়ে আমরা আনন্দিত! দারুণ সব প্রোডাক্ট ও অফার উপভোগ করুন। 🛍️`
      : `🎉 <b>Welcome!</b>\n\nYou joined via <b>${referrerName}</b>'s referral link. 🤝\n\nWe're thrilled to have you! Explore amazing products & offers. 🛍️`;
    
    await sendMessage(token, userId, welcomeMsg);

    // Get referrer's language
    const { data: referrerLangData } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", referrer.telegram_id).single();
    const refLang = referrerLangData?.language || "en";

    // Send congratulation message to the referrer
    const congratsMsg = refLang === "bn"
      ? `🎊 <b>অভিনন্দন!</b> 🎊\n\n🥳 আপনার রেফারেল সফল হয়েছে!\n\n👤 <b>${newUserName}</b> আপনার রেফারেল লিঙ্কের মাধ্যমে আমাদের বটে জয়েন করেছে।\n\n🏆 আরো বেশি রেফার করুন, আরো বেশি বোনাস আর্ন করুন! 💰`
      : `🎊 <b>Congratulations!</b> 🎊\n\n🥳 Your referral was successful!\n\n👤 <b>${newUserName}</b> has joined the bot through your referral link.\n\n🏆 Keep referring & earn more bonuses! 💰`;
    
    await sendMessage(token, referrer.telegram_id, congratsMsg);
  }
}
