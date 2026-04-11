// ===== PRODUCT & RESALE CONVERSATION HANDLERS =====

import { t, RESALE_BOT_USERNAME } from "../constants.ts";
import { sendMessage, getTelegramApiUrl } from "../telegram-api.ts";
import { deleteConversationState, setConversationState } from "../db-helpers.ts";

export async function handleProductAndResaleSteps(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  // Resale price entry
  if (state.step === "resale_price") {
    const price = parseFloat(text);
    const resellerPrice = state.data.reseller_price;
    const lang = state.data.lang || "en";

    if (isNaN(price) || price <= resellerPrice) {
      await sendMessage(token, chatId, t("resale_price_low", lang).replace("{price}", String(resellerPrice)));
      return true;
    }

    await deleteConversationState(supabase, userId);

    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const linkCode = `${timestamp}${randomPart}`;

    const { error: insertError } = await supabase.from("telegram_resale_links").insert({
      reseller_telegram_id: userId, product_id: state.data.product_id,
      variation_id: state.data.variation_id || null, custom_price: price,
      reseller_price: resellerPrice, link_code: linkCode,
    });

    if (insertError) {
      console.error("Resale link insert error:", insertError);
      await sendMessage(token, chatId, "❌ Failed to create resale link. Please try again.");
      return true;
    }

    const profit = price - resellerPrice;
    const linkMsg = `✅ <b>${lang === "bn" ? "রিসেল লিংক তৈরি হয়েছে!" : "Resale Link Created!"}</b>\n\n` +
      `🔗 Link: <code>https://t.me/${RESALE_BOT_USERNAME}?start=buy_${encodeURIComponent(linkCode)}</code>\n` +
      `💰 ${lang === "bn" ? "আপনার মূল্য" : "Your Price"}: ₹${price}\n` +
      `📦 ${lang === "bn" ? "রিসেলার মূল্য" : "Reseller Price"}: ₹${resellerPrice}\n` +
      `💵 ${lang === "bn" ? "প্রতি বিক্রয়ে লাভ" : "Profit per sale"}: ₹${profit}`;

    await sendMessage(token, chatId, linkMsg);
    return true;
  }

  // Add product flow
  switch (state.step) {
    case "add_photo": {
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        const fileRes = await fetch(`${getTelegramApiUrl(token)}/getFile`, {
          method: "POST", headers: { "Content-Type": "application/json" },
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
      return true;
    }
    case "add_name":
      await setConversationState(supabase, userId, "add_price", { ...state.data, name: text });
      await sendMessage(token, chatId, `✅ Name: <b>${text}</b>\n💰 <b>Step 3/4:</b> Enter price.`);
      return true;
    case "add_price": {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) { await sendMessage(token, chatId, "⚠️ Enter a valid price."); return true; }
      await setConversationState(supabase, userId, "add_category", { ...state.data, price });
      await sendMessage(token, chatId, `✅ Price: ₹${price}\n📂 <b>Step 4/4:</b> Enter category.`);
      return true;
    }
    case "add_category": {
      await deleteConversationState(supabase, userId);
      const baseSlug = state.data.name.toLowerCase().replace(/[^a-z0-9\s]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "product";
      const { data: existingProducts } = await supabase.from("products").select("slug").like("slug", `${baseSlug}%`);
      const existingSlugs = new Set((existingProducts || []).map((p: any) => p.slug));
      let slug = baseSlug;
      if (existingSlugs.has(slug)) { let c = 2; while (existingSlugs.has(`${baseSlug}-${c}`)) c++; slug = `${baseSlug}-${c}`; }
      const { data: product, error } = await supabase.from("products").insert({
        name: state.data.name, price: state.data.price, category: text,
        slug, image_url: state.data.image_url || null, is_active: true,
      }).select("id").single();

      if (error) {
        await sendMessage(token, chatId, `❌ Failed: ${error.message}`);
      } else {
        await sendMessage(token, chatId, `✅ <b>Product Added!</b>\n📦 ${state.data.name}\n💰 ₹${state.data.price}\n📂 ${text}\n🆔 <code>${product.id}</code>`);
      }
      return true;
    }
  }

  return false;
}
