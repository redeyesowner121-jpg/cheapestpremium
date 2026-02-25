import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = (token: string) =>
  `https://api.telegram.org/bot${token}`;

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  opts?: { reply_markup?: any; parse_mode?: string }
) {
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

async function sendPhoto(
  token: string,
  chatId: number,
  photoUrl: string,
  caption: string,
  replyMarkup?: any
) {
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

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "",
    }),
  });
}

async function getSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value");
  const settings: Record<string, string> = {};
  data?.forEach((s: any) => (settings[s.key] = s.value));
  return settings;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) {
    return new Response("Bot token not configured", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const update = await req.json();

    // Handle text messages
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const telegramUser = update.message.from;

      if (text === "/start") {
        await handleStart(BOT_TOKEN, supabase, chatId);
      } else if (text === "/products") {
        await handleViewProducts(BOT_TOKEN, supabase, chatId);
      } else if (text === "/categories") {
        await handleViewProducts(BOT_TOKEN, supabase, chatId);
      } else if (text === "/help") {
        await sendMessage(BOT_TOKEN, chatId,
          `📖 <b>Commands:</b>\n\n/start - Start the bot\n/products - View products\n/help - Show this help`
        );
      }
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const telegramUser = callbackQuery.from;

      await answerCallbackQuery(BOT_TOKEN, callbackQuery.id);

      if (data === "view_products") {
        await handleViewProducts(BOT_TOKEN, supabase, chatId);
      } else if (data === "refer_earn") {
        await handleReferEarn(BOT_TOKEN, supabase, chatId);
      } else if (data === "my_wallet") {
        await handleMyWallet(BOT_TOKEN, supabase, chatId, telegramUser);
      } else if (data === "support") {
        await handleSupport(BOT_TOKEN, supabase, chatId);
      } else if (data === "get_offers") {
        await handleGetOffers(BOT_TOKEN, supabase, chatId);
      } else if (data.startsWith("cat_")) {
        const category = decodeURIComponent(data.replace("cat_", ""));
        await handleCategoryProducts(BOT_TOKEN, supabase, chatId, category);
      } else if (data.startsWith("product_")) {
        const productId = data.replace("product_", "");
        await handleProductDetail(BOT_TOKEN, supabase, chatId, productId);
      } else if (data.startsWith("buy_")) {
        const productId = data.replace("buy_", "");
        await handleBuyProduct(BOT_TOKEN, supabase, chatId, productId, telegramUser);
      } else if (data === "back_main") {
        await handleStart(BOT_TOKEN, supabase, chatId);
      } else if (data === "back_products") {
        await handleViewProducts(BOT_TOKEN, supabase, chatId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telegram bot error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== HANDLERS =====

async function handleStart(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";
  const tagline = settings.app_tagline || "Premium Digital Products";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  const welcomeText = `<b>${appName}</b>\n\nWhat we offer:\n- Premium subscriptions\n- Instant delivery\n- 24/7 support\n- Secure payments (UPI)\n\nSelect an option below to get started:`;

  await sendMessage(token, chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍️ View Products", callback_data: "view_products" }],
        [
          { text: "🎁 Refer & Earn", callback_data: "refer_earn" },
          { text: "💰 My Wallet", callback_data: "my_wallet" },
        ],
        [
          { text: "⭐ Reviews ↗", url: `${appUrl}` },
          { text: "📞 Support ↗", callback_data: "support" },
        ],
        [{ text: "🔥 Get Offers ↗", callback_data: "get_offers" }],
      ],
    },
  });
}

async function handleViewProducts(token: string, supabase: any, chatId: number) {
  // Get categories that have active products
  const { data: categories } = await supabase
    .from("categories")
    .select("name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!categories?.length) {
    await sendMessage(token, chatId, "😔 No products available right now.", {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back_main" }]],
      },
    });
    return;
  }

  // Get products grouped by category to show as buttons
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category")
    .eq("is_active", true)
    .order("sold_count", { ascending: false });

  if (!products?.length) {
    await sendMessage(token, chatId, "😔 No products available right now.", {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back_main" }]],
      },
    });
    return;
  }

  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";

  let text = `<b>${appName} – Product Catalog</b>\n\nChoose from our premium digital products:\n\n<i>All products come with instant delivery and 24/7 support</i>`;

  // Group products by category and create 2-column button grid
  const productButtons: any[][] = [];
  const productNames = products.map((p: any) => p);
  
  // Create rows of 2 buttons each
  for (let i = 0; i < productNames.length; i += 2) {
    const row: any[] = [
      { text: productNames[i].name, callback_data: `product_${productNames[i].id}` }
    ];
    if (productNames[i + 1]) {
      row.push({ text: productNames[i + 1].name, callback_data: `product_${productNames[i + 1].id}` });
    }
    productButtons.push(row);
  }

  // Add navigation buttons at bottom
  productButtons.push([
    { text: "🎁 Refer & Earn", callback_data: "refer_earn" },
    { text: "💰 My Wallet", callback_data: "my_wallet" },
  ]);
  productButtons.push([
    { text: "⭐ Reviews ↗", url: settings.app_url || "https://cheapest-premiums.lovable.app" },
    { text: "📞 Support ↗", callback_data: "support" },
  ]);
  productButtons.push([
    { text: "🔥 Get Offers ↗", callback_data: "get_offers" },
  ]);

  await sendMessage(token, chatId, text, {
    reply_markup: { inline_keyboard: productButtons },
  });
}

async function handleCategoryProducts(
  token: string,
  supabase: any,
  chatId: number,
  category: string
) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, stock, description")
    .eq("is_active", true)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!products?.length) {
    await sendMessage(token, chatId, `No products found in <b>${category}</b>.`, {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Back to Products", callback_data: "view_products" }]],
      },
    });
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  for (const p of products) {
    const priceText = p.original_price && p.original_price > p.price
      ? `<s>${currency}${p.original_price}</s> ${currency}${p.price}`
      : `${currency}${p.price}`;

    const stockText = p.stock !== null && p.stock <= 0 ? "\n❌ Out of Stock" : "";
    const caption = `<b>${p.name}</b>\n💰 ${priceText}${stockText}`;

    const buttons: any[][] = [];
    if (p.stock === null || p.stock > 0) {
      buttons.push([
        { text: "📋 Details", callback_data: `product_${p.id}` },
        { text: "🛒 Buy Now", callback_data: `buy_${p.id}` },
      ]);
    } else {
      buttons.push([{ text: "📋 Details", callback_data: `product_${p.id}` }]);
    }

    if (p.image_url) {
      await sendPhoto(token, chatId, p.image_url, caption, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
    }
  }

  await sendMessage(token, chatId, "⬇️", {
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back to Products", callback_data: "view_products" }]],
    },
  });
}

async function handleProductDetail(
  token: string,
  supabase: any,
  chatId: number,
  productId: string
) {
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (!product) {
    await sendMessage(token, chatId, "Product not found.");
    return;
  }

  const { data: variations } = await supabase
    .from("product_variations")
    .select("id, name, price, original_price")
    .eq("product_id", productId)
    .eq("is_active", true);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  const priceText = product.original_price && product.original_price > product.price
    ? `<s>${currency}${product.original_price}</s> ${currency}${product.price}`
    : `${currency}${product.price}`;

  let text = `<b>${product.name}</b>\n\n`;
  if (product.description) text += `${product.description}\n\n`;
  text += `💰 Price: ${priceText}\n`;
  text += `⭐ Rating: ${product.rating || "N/A"}\n`;
  text += `📦 Sold: ${product.sold_count || 0}\n`;

  if (product.stock !== null) {
    text += `📊 Stock: ${product.stock > 0 ? product.stock : "Out of Stock"}\n`;
  }

  if (variations?.length) {
    text += `\n<b>📋 Variations:</b>\n`;
    variations.forEach((v: any) => {
      const vPrice = v.original_price && v.original_price > v.price
        ? `<s>${currency}${v.original_price}</s> ${currency}${v.price}`
        : `${currency}${v.price}`;
      text += `• ${v.name}: ${vPrice}\n`;
    });
  }

  const buttons: any[][] = [];
  if (product.stock === null || product.stock > 0) {
    buttons.push([{ text: "🛒 Buy Now", callback_data: `buy_${productId}` }]);
  }
  buttons.push([{ text: "⬅️ Back to Products", callback_data: "view_products" }]);

  if (product.image_url) {
    await sendPhoto(token, chatId, product.image_url, text, { inline_keyboard: buttons });
  } else {
    await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
  }
}

async function handleBuyProduct(
  token: string,
  supabase: any,
  chatId: number,
  productId: string,
  telegramUser: any
) {
  const { data: product } = await supabase
    .from("products")
    .select("name, price, stock")
    .eq("id", productId)
    .single();

  if (!product) {
    await sendMessage(token, chatId, "❌ Product not found.");
    return;
  }

  if (product.stock !== null && product.stock <= 0) {
    await sendMessage(token, chatId, "❌ Sorry, this product is out of stock.");
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const whatsapp = settings.contact_whatsapp || "+918900684167";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";
  const binanceId = settings.binance_id || "";
  const paymentQr = settings.payment_qr_code || "";
  const paymentLink = settings.payment_link || "";

  const userName = telegramUser?.first_name || "User";
  const whatsappMsg = encodeURIComponent(
    `Hi! I want to buy "${product.name}" (${currency}${product.price}) from Telegram.\nName: ${userName}\nTelegram ID: ${telegramUser?.id || "N/A"}`
  );

  // Payment info text with UPI/Binance details
  let paymentText = `🛒 <b>Order: ${product.name}</b>\n\n💰 Price: <b>${currency}${product.price}</b>\n\n`;
  paymentText += `<b>💳 Payment Methods:</b>\n\n`;
  
  // UPI Payment
  paymentText += `📱 <b>UPI Payment:</b>\n`;
  if (paymentLink) {
    paymentText += `🔗 Payment Link: ${paymentLink}\n`;
  }
  if (paymentQr) {
    paymentText += `📷 QR Code available on our website\n`;
  }
  paymentText += `\n`;

  // Binance Payment  
  if (binanceId) {
    paymentText += `🪙 <b>Binance Pay:</b>\n`;
    paymentText += `Binance ID: <code>${binanceId}</code>\n\n`;
  }

  paymentText += `<b>📝 How to order:</b>\n`;
  paymentText += `1️⃣ Pay using any method above\n`;
  paymentText += `2️⃣ Send payment screenshot on WhatsApp\n`;
  paymentText += `3️⃣ Get instant delivery! ⚡\n`;

  const buttons: any[][] = [];
  
  if (paymentLink) {
    buttons.push([{ text: "💳 Pay Now (UPI)", url: paymentLink }]);
  }
  
  buttons.push([{ text: "🌐 Buy on Website", url: `${appUrl}/products` }]);
  buttons.push([{ text: "💬 WhatsApp Order", url: `https://wa.me/${whatsapp.replace("+", "")}?text=${whatsappMsg}` }]);
  buttons.push([{ text: "⬅️ Back to Products", callback_data: "view_products" }]);

  await sendMessage(token, chatId, paymentText, {
    reply_markup: { inline_keyboard: buttons },
  });

  // Log the order attempt
  try {
    await supabase.from("search_logs").insert({
      search_term: `telegram_order:${product.name}`,
      results_count: 1,
    });
  } catch (_) {
    // ignore logging errors
  }
}

async function handleReferEarn(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const referralBonus = settings.referral_bonus || "10";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  await sendMessage(token, chatId,
    `🎁 <b>Refer & Earn!</b>\n\n` +
    `Refer your friends and earn <b>${currency}${referralBonus}</b> for each successful referral!\n\n` +
    `📝 <b>How it works:</b>\n` +
    `1️⃣ Sign up on our website\n` +
    `2️⃣ Get your unique referral code\n` +
    `3️⃣ Share with friends\n` +
    `4️⃣ Earn wallet balance! 💰`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 Sign Up & Get Referral Code", url: `${appUrl}/auth` }],
          [{ text: "⬅️ Back", callback_data: "back_main" }],
        ],
      },
    }
  );
}

async function handleMyWallet(token: string, supabase: any, chatId: number, telegramUser: any) {
  const settings = await getSettings(supabase);
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  await sendMessage(token, chatId,
    `💰 <b>My Wallet</b>\n\n` +
    `View your wallet balance, deposit funds, and manage transactions on our website.\n\n` +
    `✅ Deposit via UPI\n` +
    `✅ International payments via Binance\n` +
    `✅ Instant top-up`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Open Wallet", url: `${appUrl}/wallet` }],
          [{ text: "⬅️ Back", callback_data: "back_main" }],
        ],
      },
    }
  );
}

async function handleSupport(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const whatsapp = settings.contact_whatsapp || "+918900684167";
  const email = settings.contact_email || "";

  let supportText = `📞 <b>Customer Support</b>\n\n`;
  supportText += `We're here to help you 24/7!\n\n`;
  supportText += `📱 WhatsApp: ${whatsapp}\n`;
  if (email) supportText += `📧 Email: ${email}\n`;

  await sendMessage(token, chatId, supportText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💬 Chat on WhatsApp", url: `https://wa.me/${whatsapp.replace("+", "")}` }],
        [{ text: "⬅️ Back", callback_data: "back_main" }],
      ],
    },
  });
}

async function handleGetOffers(token: string, supabase: any, chatId: number) {
  // Get active flash sales
  const { data: flashSales } = await supabase
    .from("flash_sales")
    .select("*, products(name, price, image_url)")
    .eq("is_active", true)
    .gt("end_time", new Date().toISOString())
    .limit(5);

  // Get active coupons
  const { data: coupons } = await supabase
    .from("coupons")
    .select("code, description, discount_type, discount_value")
    .eq("is_active", true)
    .limit(5);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  let text = `🔥 <b>Current Offers & Deals</b>\n\n`;

  if (flashSales?.length) {
    text += `⚡ <b>Flash Sales:</b>\n`;
    flashSales.forEach((sale: any) => {
      const productName = sale.products?.name || "Product";
      text += `• ${productName}: <b>${currency}${sale.sale_price}</b> (was ${currency}${sale.products?.price})\n`;
    });
    text += `\n`;
  }

  if (coupons?.length) {
    text += `🎟️ <b>Coupon Codes:</b>\n`;
    coupons.forEach((c: any) => {
      const discount = c.discount_type === 'percentage' 
        ? `${c.discount_value}% OFF` 
        : `${currency}${c.discount_value} OFF`;
      text += `• <code>${c.code}</code> - ${discount}\n`;
      if (c.description) text += `  ${c.description}\n`;
    });
    text += `\n`;
  }

  if (!flashSales?.length && !coupons?.length) {
    text += `No special offers right now. Check back later! 🔜`;
  }

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍️ View Products", callback_data: "view_products" }],
        [{ text: "⬅️ Back", callback_data: "back_main" }],
      ],
    },
  });
}
