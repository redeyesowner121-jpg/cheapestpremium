// ===== Stock empty notifier =====

export async function notifyAdminStockEmpty(supabase: any, productName: string, variationName: string | null) {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return;

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
 * Check if stock is empty after consumption. If so, switch delivery_mode to 'repeated'
 * and notify admin via Telegram.
 */
export async function checkAndSwitchIfStockEmpty(
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
    if (count !== null && count > 0) return;

    if (isVariationStock && variationId) {
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
