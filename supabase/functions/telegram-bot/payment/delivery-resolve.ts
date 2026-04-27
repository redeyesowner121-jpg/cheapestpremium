// ===== Resolve access link for a product order =====
// Handles unique stock consumption + variation matching

import { checkAndSwitchIfStockEmpty } from "./delivery-stock.ts";

export async function resolveAccessLink(
  supabase: any,
  productId: string,
  orderId?: string,
  telegramOrderId?: string,
  quantity: number = 1,
): Promise<{ link: string | null; links: string[]; showInBot: boolean; showInWebsite: boolean; deliveryMessage?: string | null }> {
  const { data: product } = await supabase
    .from("products")
    .select("access_link, delivery_mode, show_link_in_bot, show_link_in_website, name")
    .eq("id", productId)
    .single();

  if (!product) return { link: null, links: [], showInBot: true, showInWebsite: true };

  const showInBot = product.show_link_in_bot !== false;
  const showInWebsite = product.show_link_in_website !== false;
  const qty = Math.max(1, Math.min(1000, Math.floor(quantity || 1)));

  // Try to resolve variation from order's product_name (e.g. "Netflix - 1 Month")
  let variationId: string | null = null;
  let variationDeliveryMode: string | null = null;
  let variationDeliveryMessage: string | null = null;
  let variationAccessLink: string | null = null;
  try {
    let orderProductName: string | null = null;
    if (orderId) {
      const { data: o } = await supabase.from("orders").select("product_name").eq("id", orderId).single();
      orderProductName = o?.product_name || null;
    } else if (telegramOrderId) {
      const { data: o } = await supabase.from("telegram_orders").select("product_name").eq("id", telegramOrderId).single();
      orderProductName = o?.product_name || null;
    }
    if (orderProductName) {
      const { data: vars } = await supabase
        .from("product_variations")
        .select("id, name, delivery_mode, delivery_message, access_link")
        .eq("product_id", productId)
        .eq("is_active", true);
      if (vars?.length) {
        const matched = vars
          .filter((v: any) => orderProductName!.toLowerCase().includes(v.name.toLowerCase().trim()))
          .sort((a: any, b: any) => b.name.length - a.name.length)[0];
        if (matched) {
          variationId = matched.id;
          variationDeliveryMode = matched.delivery_mode;
          variationDeliveryMessage = matched.delivery_message || null;
          variationAccessLink = matched.access_link || null;
        }
      }
    }
  } catch (e) {
    console.warn("[DELIVERY] variation resolve skipped:", e);
  }

  const useVariationStock = variationId && variationDeliveryMode === "unique";
  const useProductStock = !useVariationStock && product.delivery_mode === "unique";

  if (useVariationStock || useProductStock) {
    console.log("[UNIQUE-DELIVERY] Product", productId, "variation", variationId, "qty=", qty);
    const consumedLinks: string[] = [];

    for (let i = 0; i < qty; i++) {
      let consumedThis: string | null = null;

      const stockStrategies: Array<{ type: string; filter: (q: any) => any }> = [];
      if (useVariationStock) {
        stockStrategies.push({
          type: "variation",
          filter: (q: any) => q.eq("variation_id", variationId),
        });
        stockStrategies.push({
          type: "product-fallback",
          filter: (q: any) => q.eq("product_id", productId).is("variation_id", null),
        });
      } else {
        stockStrategies.push({
          type: "product",
          filter: (q: any) => q.eq("product_id", productId).is("variation_id", null),
        });
      }

      for (const strategy of stockStrategies) {
        for (let attempt = 0; attempt < 3; attempt++) {
          let q = supabase
            .from("product_stock_items")
            .select("id, access_link")
            .eq("is_used", false)
            .order("created_at", { ascending: true })
            .limit(1);
          q = strategy.filter(q);
          const { data: stockItems, error: fetchErr } = await q;
          if (fetchErr || !stockItems?.length) break;

          const stockItem = stockItems[0];
          const { data: consumedRows, error: consumeError } = await supabase
            .from("product_stock_items")
            .delete()
            .eq("id", stockItem.id)
            .eq("is_used", false)
            .select("access_link");

          if (consumeError) {
            console.error("[UNIQUE-DELIVERY] consume failed:", consumeError);
            break;
          }

          const link = consumedRows?.[0]?.access_link;
          if (link) { consumedThis = link; break; }
        }
        if (consumedThis) {
          if (strategy.type === "product-fallback") {
            console.log("[UNIQUE-DELIVERY] Used product-level fallback stock for variation", variationId);
          }
          break;
        }
      }
      if (!consumedThis) break;
      consumedLinks.push(consumedThis);
    }

    if (consumedLinks.length > 0) {
      await checkAndSwitchIfStockEmpty(supabase, productId, variationId, Boolean(useVariationStock), product.name);
    }

    if (!consumedLinks.length) return { link: null, links: [], showInBot, showInWebsite, deliveryMessage: variationDeliveryMessage };
    return { link: consumedLinks[0], links: consumedLinks, showInBot, showInWebsite, deliveryMessage: variationDeliveryMessage };
  }

  // repeated mode: prefer variation's access_link, fallback to product's
  const link = variationAccessLink || product.access_link || null;
  return { link, links: link ? [link] : [], showInBot, showInWebsite, deliveryMessage: variationDeliveryMessage };
}
