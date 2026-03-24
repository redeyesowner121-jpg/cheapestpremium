// ===== PRODUCT BROWSING (Categories, Product Detail) =====

import { t } from "../constants.ts";
import { sendMessage, sendPhoto } from "../telegram-api.ts";
import { getSettings, getWallet } from "../db-helpers.ts";

export async function handleViewCategories(token: string, supabase: any, chatId: number, lang: string) {
  const { data: categories, error } = await supabase
    .from("categories")
    .select("name, slug, icon")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Category fetch error:", error);
  }

  if (!categories?.length) {
    await sendMessage(token, chatId, t("no_products", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] },
    });
    return;
  }

  const header = lang === "bn" ? "📂 <b>ক্যাটাগরি নির্বাচন করুন:</b>" : "📂 <b>Choose a Category:</b>";

  const categoryEmojis = ["🎬", "🎵", "🛠️", "🎮", "🔐", "📚"];
  const buttons: any[][] = [];
  for (let i = 0; i < categories.length; i += 2) {
    const emoji1 = categoryEmojis[i % categoryEmojis.length];
    const row: any[] = [{ text: `${emoji1} ${categories[i].name}`, callback_data: `cat_${encodeURIComponent(categories[i].slug)}` }];
    if (categories[i + 1]) {
      const emoji2 = categoryEmojis[(i + 1) % categoryEmojis.length];
      row.push({ text: `${emoji2} ${categories[i + 1].name}`, callback_data: `cat_${encodeURIComponent(categories[i + 1].slug)}` });
    }
    buttons.push(row);
  }
  buttons.push([{ text: `🔙 ${t("back_main", lang)}`, callback_data: "back_main" }]);

  await sendMessage(token, chatId, header, { reply_markup: { inline_keyboard: buttons } });
}

export async function handleCategoryProducts(token: string, supabase: any, chatId: number, category: string, lang: string) {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, stock")
    .eq("category", category)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Product fetch error:", error);
  }

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

  const productEmojis = ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣", "🟤", "⚫"];
  const buttons: any[][] = products.map((p: any, index: number) => {
    const emoji = productEmojis[index % productEmojis.length];
    return [{ text: `${emoji} ${p.name}`, callback_data: `product_${p.id}` }];
  });
  buttons.push([{ text: `🔙 ${t("back_products", lang)}`, callback_data: "back_products" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function handleProductDetail(token: string, supabase: any, chatId: number, productId: string, lang: string, userId: number) {
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    console.error("Product detail fetch error:", error);
  }

  if (!product) {
    await sendMessage(token, chatId, t("product_not_found", lang));
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  const wallet = await getWallet(supabase, userId);
  const isReseller = wallet?.is_reseller === true;

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

    const variationColors = ["🟢", "🔵", "🟡", "🟣", "🟠", "🔴"];
    for (let idx = 0; idx < variations.length; idx++) {
      const v = variations[idx];
      const colorEmoji = variationColors[idx % variationColors.length];
      if (isReseller) {
        buttons.push([
          { text: `${colorEmoji} ${v.name}`, callback_data: `buyvar_${v.id}` },
          { text: `🔄 Resale`, callback_data: `resalevar_${v.id}` },
        ]);
      } else {
        buttons.push([{ text: `${colorEmoji} ${v.name}`, callback_data: `buyvar_${v.id}` }]);
      }
    }
    buttons.push([{ text: `🔙 ${t("back_products", lang)}`, callback_data: "back_products" }]);

    if (product.image_url) {
      await sendPhoto(token, chatId, product.image_url, text, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
  } else {
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
          { text: `🟢 ${t("buy_now", lang)}`, callback_data: `buy_${productId}` },
          { text: `🔄 ${lang === "bn" ? "রিসেল" : "Resale"}`, callback_data: `resale_${productId}` },
        ]);
      } else {
        buttons.push([{ text: `🟢 ${t("buy_now", lang)}`, callback_data: `buy_${productId}` }]);
      }
    }

    buttons.push([{ text: `🔙 ${t("back_products", lang)}`, callback_data: "back_products" }]);

    if (product.image_url) {
      await sendPhoto(token, chatId, product.image_url, text, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
  }
}
