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

    // Handle /start command
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === "/start") {
        // Get app settings
        const { data: settingsData } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", ["app_name", "currency_symbol", "app_tagline"]);

        const settings: Record<string, string> = {};
        settingsData?.forEach((s: any) => (settings[s.key] = s.value));
        const appName = settings.app_name || "RKR Premium Store";
        const tagline = settings.app_tagline || "Premium Digital Products";

        await sendMessage(BOT_TOKEN, chatId, 
          `🎉 <b>Welcome to ${appName}!</b>\n\n${tagline}\n\nBrowse our premium products and buy directly from Telegram!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛍️ Browse Products", callback_data: "browse_all" }],
                [{ text: "📂 Categories", callback_data: "categories" }],
                [{ text: "🌐 Visit Store", url: settings.app_url || "https://cheapest-premiums.lovable.app" }],
              ],
            },
          }
        );
      } else if (text === "/products") {
        await handleBrowseAll(BOT_TOKEN, supabase, chatId);
      } else if (text === "/categories") {
        await handleCategories(BOT_TOKEN, supabase, chatId);
      } else if (text === "/help") {
        await sendMessage(BOT_TOKEN, chatId,
          `📖 <b>Commands:</b>\n\n/start - Start the bot\n/products - Browse all products\n/categories - Browse by category\n/help - Show this help`
        );
      }
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      await answerCallbackQuery(BOT_TOKEN, callbackQuery.id);

      if (data === "browse_all") {
        await handleBrowseAll(BOT_TOKEN, supabase, chatId);
      } else if (data === "categories") {
        await handleCategories(BOT_TOKEN, supabase, chatId);
      } else if (data.startsWith("cat_")) {
        const category = data.replace("cat_", "");
        await handleCategoryProducts(BOT_TOKEN, supabase, chatId, category);
      } else if (data.startsWith("product_")) {
        const productId = data.replace("product_", "");
        await handleProductDetail(BOT_TOKEN, supabase, chatId, productId);
      } else if (data.startsWith("buy_")) {
        const productId = data.replace("buy_", "");
        await handleBuyProduct(BOT_TOKEN, supabase, chatId, productId, callbackQuery.from);
      } else if (data === "back_main") {
        await sendMessage(BOT_TOKEN, chatId, "🏠 <b>Main Menu</b>\n\nChoose an option:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛍️ Browse Products", callback_data: "browse_all" }],
              [{ text: "📂 Categories", callback_data: "categories" }],
            ],
          },
        });
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

async function handleBrowseAll(token: string, supabase: any, chatId: number) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, stock")
    .eq("is_active", true)
    .order("sold_count", { ascending: false })
    .limit(10);

  if (!products?.length) {
    await sendMessage(token, chatId, "😔 No products available right now.");
    return;
  }

  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("key", "currency_symbol");
  const currency = settingsData?.[0]?.value || "₹";

  await sendMessage(token, chatId, "🛍️ <b>Our Products:</b>\n\nSelect a product to view details:");

  for (const p of products) {
    const priceText = p.original_price && p.original_price > p.price
      ? `<s>${currency}${p.original_price}</s> ${currency}${p.price}`
      : `${currency}${p.price}`;
    
    const stockText = p.stock !== null && p.stock <= 0 ? " ❌ Out of Stock" : "";
    const caption = `<b>${p.name}</b>\n💰 ${priceText}${stockText}`;

    const buttons: any[][] = [
      [{ text: "📋 Details", callback_data: `product_${p.id}` }],
    ];
    if (p.stock === null || p.stock > 0) {
      buttons[0].push({ text: "🛒 Buy Now", callback_data: `buy_${p.id}` });
    }

    if (p.image_url) {
      await sendPhoto(token, chatId, p.image_url, caption, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
    }
  }

  await sendMessage(token, chatId, "⬅️", {
    reply_markup: {
      inline_keyboard: [[{ text: "🏠 Back to Menu", callback_data: "back_main" }]],
    },
  });
}

async function handleCategories(token: string, supabase: any, chatId: number) {
  const { data: categories } = await supabase
    .from("categories")
    .select("name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!categories?.length) {
    await sendMessage(token, chatId, "No categories found.");
    return;
  }

  const buttons = categories.map((c: any) => [
    { text: `📁 ${c.name}`, callback_data: `cat_${c.name}` },
  ]);
  buttons.push([{ text: "🏠 Back to Menu", callback_data: "back_main" }]);

  await sendMessage(token, chatId, "📂 <b>Categories:</b>\n\nSelect a category:", {
    reply_markup: { inline_keyboard: buttons },
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
    .select("id, name, price, original_price, image_url, stock")
    .eq("is_active", true)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!products?.length) {
    await sendMessage(token, chatId, `No products found in <b>${category}</b>.`, {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Back", callback_data: "categories" }]],
      },
    });
    return;
  }

  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("key", "currency_symbol");
  const currency = settingsData?.[0]?.value || "₹";

  await sendMessage(token, chatId, `📁 <b>${category}:</b>`);

  for (const p of products) {
    const priceText = p.original_price && p.original_price > p.price
      ? `<s>${currency}${p.original_price}</s> ${currency}${p.price}`
      : `${currency}${p.price}`;

    const caption = `<b>${p.name}</b>\n💰 ${priceText}`;
    const buttons: any[][] = [
      [
        { text: "📋 Details", callback_data: `product_${p.id}` },
        ...(p.stock === null || p.stock > 0
          ? [{ text: "🛒 Buy Now", callback_data: `buy_${p.id}` }]
          : []),
      ],
    ];

    if (p.image_url) {
      await sendPhoto(token, chatId, p.image_url, caption, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
    }
  }

  await sendMessage(token, chatId, "⬅️", {
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back to Categories", callback_data: "categories" }]],
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

  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("key", "currency_symbol");
  const currency = settingsData?.[0]?.value || "₹";

  let text = `<b>${product.name}</b>\n\n`;
  if (product.description) text += `${product.description}\n\n`;

  const priceText = product.original_price && product.original_price > product.price
    ? `<s>${currency}${product.original_price}</s> ${currency}${product.price}`
    : `${currency}${product.price}`;
  text += `💰 Price: ${priceText}\n`;
  text += `⭐ Rating: ${product.rating || "N/A"}\n`;
  text += `📦 Sold: ${product.sold_count || 0}\n`;

  if (product.stock !== null) {
    text += `📊 Stock: ${product.stock > 0 ? product.stock : "Out of Stock"}\n`;
  }

  if (variations?.length) {
    text += `\n<b>Variations:</b>\n`;
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
  buttons.push([{ text: "⬅️ Back", callback_data: "browse_all" }]);

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

  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["currency_symbol", "contact_whatsapp", "app_url"]);

  const settings: Record<string, string> = {};
  settingsData?.forEach((s: any) => (settings[s.key] = s.value));
  const currency = settings.currency_symbol || "₹";
  const whatsapp = settings.contact_whatsapp || "+918900684167";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  const userName = telegramUser?.first_name || "User";
  const whatsappMsg = encodeURIComponent(
    `Hi! I want to buy "${product.name}" (${currency}${product.price}) from Telegram. My name: ${userName}`
  );

  await sendMessage(
    token,
    chatId,
    `✅ <b>Order: ${product.name}</b>\n\n💰 Price: ${currency}${product.price}\n\nTo complete your purchase:\n1️⃣ Visit our store and pay via wallet\n2️⃣ Or contact us on WhatsApp`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 Buy on Store", url: `${appUrl}/products` }],
          [{ text: "💬 WhatsApp Order", url: `https://wa.me/${whatsapp.replace("+", "")}?text=${whatsappMsg}` }],
          [{ text: "🏠 Back to Menu", callback_data: "back_main" }],
        ],
      },
    }
  );
}
