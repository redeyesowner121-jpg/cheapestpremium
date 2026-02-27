// ===== MENU & NAVIGATION HANDLERS =====

import { T, t, BOT_USERNAME } from "./constants.ts";
import { sendMessage, sendPhoto } from "./telegram-api.ts";
import { getSettings, ensureWallet, getWallet, getRequiredChannels } from "./db-helpers.ts";

// ===== LANGUAGE SELECTION =====

export async function showLanguageSelection(token: string, chatId: number) {
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

export async function showJoinChannels(token: string, supabase: any, chatId: number, lang: string) {
  const channels = await getRequiredChannels(supabase);
  const buttons: any[][] = channels.map((ch: string) => {
    const name = ch.startsWith("@") ? ch : `@${ch}`;
    return [{ text: `📢 Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }];
  });
  buttons.push([{ text: "✅ I've Joined - Verify", callback_data: "verify_join" }]);

  await sendMessage(token, chatId, t("join_channels", lang), {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ===== MAIN MENU =====

export async function showMainMenu(token: string, supabase: any, chatId: number, lang: string) {
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

export async function handleViewCategories(token: string, supabase: any, chatId: number, lang: string) {
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

export async function handleCategoryProducts(token: string, supabase: any, chatId: number, category: string, lang: string) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, stock")
    .eq("category", category)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!products?.length) {
    await sendMessage(token, chatId, t("no_products", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("back_products", lang), callback_data: "back_products" }]] },
    });
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const header = `📂 <b>${category}</b>\n\n`;
  let text = header;

  products.forEach((p: any) => {
    const priceText = p.original_price && p.original_price > p.price
      ? `<s>${currency}${p.original_price}</s> ${currency}${p.price}`
      : `${currency}${p.price}`;
    const stock = p.stock !== null && p.stock <= 0 ? " ❌" : "";
    text += `📦 <b>${p.name}</b> — ${priceText}${stock}\n`;
  });

  const buttons: any[][] = products.map((p: any) => [
    { text: `📦 ${p.name}`, callback_data: `product_${p.id}` },
  ]);
  buttons.push([{ text: t("back_products", lang), callback_data: "back_products" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== PRODUCT DETAIL =====

export async function handleProductDetail(token: string, supabase: any, chatId: number, productId: string, lang: string, userId: number) {
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (!product) {
    await sendMessage(token, chatId, t("product_not_found", lang));
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  // Check if user is reseller
  const wallet = await getWallet(supabase, userId);
  const isReseller = wallet?.is_reseller === true;

  // Check for variations
  const { data: variations } = await supabase
    .from("product_variations")
    .select("id, name, price, original_price, reseller_price")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("price", { ascending: true });

  const buttons: any[][] = [];

  if (variations?.length) {
    let text = `📦 <b>${product.name}</b>\n\n`;
    text += `${lang === "bn" ? "📋 ভেরিয়েশন নির্বাচন করুন:" : "📋 Choose a variation:"}\n\n`;

    variations.forEach((v: any) => {
      const displayPrice = isReseller ? (v.reseller_price || v.price) : v.price;
      const priceLabel = isReseller ? `${currency}${displayPrice} (Reseller)` : (
        v.original_price && v.original_price > v.price
          ? `${currency}${v.price} (was ${currency}${v.original_price})`
          : `${currency}${v.price}`
      );
      text += `• <b>${v.name}</b> — ${priceLabel}\n`;
    });

    for (const v of variations) {
      if (isReseller) {
        buttons.push([
          { text: `🛒 ${v.name}`, callback_data: `buyvar_${v.id}` },
          { text: `🔄 Resale`, callback_data: `resalevar_${v.id}` },
        ]);
      } else {
        buttons.push([{ text: `🛒 ${v.name}`, callback_data: `buyvar_${v.id}` }]);
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

// ===== MY ORDERS =====

export async function handleMyOrders(token: string, supabase: any, chatId: number, userId: number, lang: string) {
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

  const statusEmoji: Record<string, string> = { pending: "⏳", confirmed: "✅", rejected: "❌", shipped: "📦", delivered: "🎉" };
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
    if (o.status === "shipped") text += `   ${lang === "bn" ? "🎉 শীঘ্রই ডেলিভারি হবে!" : "🎉 Arriving soon!"}\n`;
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

export async function handleMyWallet(token: string, supabase: any, chatId: number, userId: number, lang: string) {
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

export async function handleReferEarn(token: string, supabase: any, chatId: number, userId: number, lang: string) {
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

export async function handleSupport(token: string, supabase: any, chatId: number, lang: string) {
  const supportNumber = "+201556690444";

  await sendMessage(token, chatId,
    lang === "bn"
      ? `📞 <b>সাপোর্ট</b>\n\nযেকোনো সমস্যায় নিচের মাধ্যমে যোগাযোগ করুন:\n\n📱 WhatsApp: ${supportNumber}\n📱 Telegram: ${supportNumber}\n\nঅথবা নিচের বাটনে ক্লিক করুন:`
      : `📞 <b>Support</b>\n\nContact us for any issues:\n\n📱 WhatsApp: ${supportNumber}\n📱 Telegram: ${supportNumber}\n\nOr click a button below:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 WhatsApp", url: `https://wa.me/${supportNumber.replace("+", "")}` }],
          [{ text: "📱 Telegram", url: `https://t.me/${supportNumber}` }],
          [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin" }],
          [{ text: t("back_main", lang), callback_data: "back_main" }],
        ],
      },
    }
  );
}

// ===== OFFERS =====

export async function handleGetOffers(token: string, supabase: any, chatId: number, lang: string) {
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

  let text = lang === "bn" ? "🔥 <b>অফার ও ডিসকাউন্ট</b>\n\n" : "🔥 <b>Offers & Discounts</b>\n\n";

  if (flashSales?.length) {
    text += lang === "bn" ? "<b>⚡ ফ্ল্যাশ সেল:</b>\n" : "<b>⚡ Flash Sales:</b>\n";
    flashSales.forEach((s: any) => {
      const name = s.products?.name || "Product";
      text += `• ${name}: <b>₹${s.sale_price}</b> (was ₹${s.products?.price || "?"})\n`;
    });
    text += "\n";
  }

  if (coupons?.length) {
    text += lang === "bn" ? "<b>🎟️ কুপন কোড:</b>\n" : "<b>🎟️ Coupon Codes:</b>\n";
    coupons.forEach((c: any) => {
      const disc = c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`;
      text += `• <code>${c.code}</code> — ${disc} OFF${c.description ? ` (${c.description})` : ""}\n`;
    });
  }

  if (!flashSales?.length && !coupons?.length) {
    text += lang === "bn" ? "😔 এখন কোনো অফার নেই।" : "😔 No offers available right now.";
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

export async function forwardUserMessageToAdmin(token: string, supabase: any, msg: any, telegramUser: any, lang: string) {
  const { forwardToAllAdmins, notifyAllAdmins } = await import("./db-helpers.ts");
  const username = telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name || "Unknown";

  await forwardToAllAdmins(token, supabase, msg.chat.id, msg.message_id);
  await notifyAllAdmins(token, supabase,
    `📸 <b>Photo from</b> ${username} (<code>${telegramUser.id}</code>)`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 Chat", callback_data: `admin_chat_${telegramUser.id}` }],
        ],
      },
    }
  );

  await sendMessage(token, msg.chat.id,
    lang === "bn"
      ? "✅ আপনার মেসেজ অ্যাডমিনের কাছে ফরোয়ার্ড করা হয়েছে।"
      : "✅ Your message has been forwarded to admin."
  );
}
