// ===== PRODUCT BROWSING (Categories, Product Detail) =====

import { t } from "../constants.ts";
import { sendMessage, sendPhoto } from "../telegram-api.ts";
import { getSettings, getWallet } from "../db-helpers.ts";
import { getChildBotContext, childBotPrice, isChildBotMode } from "../child-context.ts";

export async function handleViewCategories(token: string, supabase: any, chatId: number, lang: string) {
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, icon_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Category fetch error:", error);
  }

  if (!categories?.length) {
    await sendMessage(token, chatId, t("no_products", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main", style: "secondary" }]] },
    });
    return;
  }

  const header = lang === "bn" ? "📂 <b>ক্যাটাগরি নির্বাচন করুন:</b>" : "📂 <b>Choose a Category:</b>";

  const buttons: any[][] = [];
  for (let i = 0; i < categories.length; i += 2) {
    const colorIdx = Math.floor(i / 2) % 2;
    const catColors = ["primary", "success"];
    const row: any[] = [{ text: categories[i].name, callback_data: `cat_${encodeURIComponent(categories[i].name)}`, style: catColors[colorIdx] }];
    if (categories[i + 1]) {
      row.push({ text: categories[i + 1].name, callback_data: `cat_${encodeURIComponent(categories[i + 1].name)}`, style: catColors[1 - colorIdx] });
    }
    buttons.push(row);
  }
  buttons.push([{ text: t("back_main", lang), callback_data: "back_main", style: "secondary" }]);

  await sendMessage(token, chatId, header, { reply_markup: { inline_keyboard: buttons } });
}

export async function handleCategoryProducts(token: string, supabase: any, chatId: number, categoryName: string, lang: string) {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, reseller_price, button_style")
    .eq("category", categoryName)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Product fetch error:", error);
  }

  if (!products?.length) {
    await sendMessage(token, chatId, t("no_products", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("back_products", lang), callback_data: "back_products", style: "secondary" }]] },
    });
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const childCtx = getChildBotContext();
  let text = `📂 <b>${categoryName}</b>\n\n`;

  products.forEach((p: any) => {
    let displayPrice: number;
    if (childCtx) {
      // Child bot: reseller_price + markup
      displayPrice = childBotPrice(p.reseller_price, p.price);
    } else {
      displayPrice = p.price;
    }

    const priceText = (!childCtx && p.original_price && p.original_price > p.price)
      ? `<s>${currency}${p.original_price}</s> ${currency}${displayPrice}`
      : `${currency}${displayPrice}`;
    text += `• <b>${p.name}</b> — ${priceText}\n`;
  });

  // Alternating blue-green pattern for product buttons
  const altColors = ["primary", "success"]; // blue, green
  const buttons: any[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    const row: any[] = [];
    const colorIdx = Math.floor(i / 2) % 2; // alternates per row
    const p1 = products[i];
    row.push({ text: p1.name, callback_data: `product_${p1.id}`, style: altColors[colorIdx] });
    if (products[i + 1]) {
      const p2 = products[i + 1];
      row.push({ text: p2.name, callback_data: `product_${p2.id}`, style: altColors[1 - colorIdx] });
    }
    buttons.push(row);
  }
  buttons.push([{ text: t("back_products", lang), callback_data: "back_products", style: "secondary" }]);

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
  const childCtx = getChildBotContext();

  const wallet = await getWallet(supabase, userId);
  const isReseller = !childCtx && wallet?.is_reseller === true; // No reseller features in child bots

  const { data: variations } = await supabase
    .from("product_variations")
    .select("id, name, price, original_price, reseller_price")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("price", { ascending: true });

  // Parse image_url (could be JSON array or single URL)
  let primaryImage = product.image_url;
  if (primaryImage) {
    try {
      const parsed = JSON.parse(primaryImage);
      if (Array.isArray(parsed) && parsed.length > 0) {
        primaryImage = parsed[0];
      }
    } catch { /* single URL, use as-is */ }
  }

  const buttons: any[][] = [];

  if (variations?.length) {
    let text = `<b>${product.name}</b>\n`;
    if (product.description) text += `\n${product.description}\n`;
    text += `\n${lang === "bn" ? "ভেরিয়েশন নির্বাচন করুন:" : "Choose a variation:"}\n\n`;

    variations.forEach((v: any) => {
      let displayPrice: number;
      let priceLabel: string;

      if (childCtx) {
        displayPrice = childBotPrice(v.reseller_price, v.price);
        priceLabel = `${currency}${displayPrice}`;
      } else if (isReseller) {
        displayPrice = v.reseller_price || v.price;
        priceLabel = `${currency}${displayPrice} (Reseller)`;
      } else {
        displayPrice = v.price;
        priceLabel = v.original_price && v.original_price > v.price
          ? `${currency}${v.price} (was ${currency}${v.original_price})`
          : `${currency}${v.price}`;
      }
      text += `• <b>${v.name}</b> — ${priceLabel}\n`;
    });

    // Alternating blue-green for variation buttons
    const varColors = ["primary", "success"];
    
    if (isReseller && !childCtx) {
      for (let ri = 0; ri < variations.length; ri++) {
        const v = variations[ri];
        const colorIdx = ri % 2;
        buttons.push([
          { text: `${v.name} - ${currency}${v.reseller_price || v.price}`, callback_data: `buyvar_${v.id}`, style: varColors[colorIdx] },
          { text: `Resale`, callback_data: `resalevar_${v.id}`, style: varColors[1 - colorIdx] },
        ]);
      }
    } else {
      for (let i = 0; i < variations.length; i += 2) {
        const row: any[] = [];
        const colorIdx = Math.floor(i / 2) % 2;
        const v1 = variations[i];
        const dp1 = childCtx ? childBotPrice(v1.reseller_price, v1.price) : v1.price;
        row.push({ text: `${v1.name} - ${currency}${dp1}`, callback_data: `buyvar_${v1.id}`, style: varColors[colorIdx] });
        if (variations[i + 1]) {
          const v2 = variations[i + 1];
          const dp2 = childCtx ? childBotPrice(v2.reseller_price, v2.price) : v2.price;
          row.push({ text: `${v2.name} - ${currency}${dp2}`, callback_data: `buyvar_${v2.id}`, style: varColors[1 - colorIdx] });
        }
        buttons.push(row);
      }
    }
    buttons.push([{ text: t("back_products", lang), callback_data: "back_products", style: "secondary" }]);

    if (primaryImage) {
      await sendPhoto(token, chatId, primaryImage, text, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
  } else {
    let displayPrice: number;
    let priceLabel: string;

    if (childCtx) {
      displayPrice = childBotPrice(product.reseller_price, product.price);
      priceLabel = `${currency}${displayPrice}`;
    } else if (isReseller) {
      displayPrice = product.reseller_price || product.price;
      priceLabel = `${currency}${displayPrice} (Reseller)`;
    } else {
      displayPrice = product.price;
      priceLabel = product.original_price && product.original_price > product.price
        ? `<s>${currency}${product.original_price}</s> ${currency}${product.price}`
        : `${currency}${product.price}`;
    }

    let text = `<b>${product.name}</b>\n`;
    if (product.description) text += `${product.description}\n`;
    text += `\n${lang === "bn" ? "মূল্য" : "Price"}: ${priceLabel}`;

    if (product.stock !== null && product.stock <= 0) {
      text += `\n\n❌ ${lang === "bn" ? "স্টক শেষ" : "Out of Stock"}`;
    }

    if (product.stock === null || product.stock > 0) {
      if (childCtx) {
        buttons.push([{ text: `${t("buy_now", lang)} - ${currency}${displayPrice}`, callback_data: `buy_${productId}`, style: "primary" }]);
      } else if (isReseller) {
        buttons.push([
          { text: `${t("buy_now", lang)} - ${currency}${displayPrice}`, callback_data: `buy_${productId}`, style: "primary" },
          { text: lang === "bn" ? "রিসেল" : "Resale", callback_data: `resale_${productId}`, style: "success" },
        ]);
      } else {
        buttons.push([{ text: `${t("buy_now", lang)} - ${currency}${displayPrice}`, callback_data: `buy_${productId}`, style: "primary" }]);
      }
    }

    buttons.push([{ text: t("back_products", lang), callback_data: "back_products", style: "secondary" }]);

    if (primaryImage) {
      await sendPhoto(token, chatId, primaryImage, text, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
  }
}
