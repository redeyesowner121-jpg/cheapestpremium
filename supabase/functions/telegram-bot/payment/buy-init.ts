// ===== Buy initiation & quantity selector =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { ensureWallet, getWallet, setConversationState, deleteConversationState, getSettings } from "../db-helpers.ts";
import { getChildBotContext, childBotPrice } from "../child-context.ts";

export async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any, lang: string) {
  const { data: product } = await supabase.from("products").select("name, price, stock, id, reseller_price").eq("id", productId).single();
  if (!product) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  const childCtx = getChildBotContext();
  let buyPrice = product.price;
  if (childCtx) {
    buyPrice = childBotPrice(product.reseller_price, product.price);
  }

  await showQuantitySelector(token, supabase, chatId, telegramUser, product.name, buyPrice, product.id, null, product.stock, lang);
}

export async function handleBuyVariation(token: string, supabase: any, chatId: number, variationId: string, telegramUser: any, lang: string) {
  const { data: variation } = await supabase
    .from("product_variations")
    .select("id, name, price, reseller_price, product_id")
    .eq("id", variationId)
    .single();

  if (!variation) { await sendMessage(token, chatId, t("product_not_found", lang)); return; }

  const { data: product } = await supabase
    .from("products")
    .select("name, stock")
    .eq("id", variation.product_id)
    .single();

  const productName = `${product?.name || "Product"} - ${variation.name}`;
  const stock = product?.stock;
  if (stock !== null && stock !== undefined && stock <= 0) { await sendMessage(token, chatId, t("out_of_stock", lang)); return; }

  const childCtx = getChildBotContext();
  let price: number;
  if (childCtx) {
    price = childBotPrice(variation.reseller_price, variation.price);
  } else {
    const wallet = await getWallet(supabase, telegramUser.id);
    const isReseller = wallet?.is_reseller === true;
    price = isReseller ? (variation.reseller_price || variation.price) : variation.price;
  }

  await showQuantitySelector(token, supabase, chatId, telegramUser, productName, price, variation.product_id, variation.id, stock ?? null, lang);
}

export async function showQuantitySelector(
  token: string, supabase: any, chatId: number, telegramUser: any,
  productName: string, unitPrice: number, productId: string, variationId: string | null,
  stock: number | null, lang: string,
) {
  const userId = telegramUser.id;
  const childCtx = getChildBotContext();
  const childBotData = childCtx ? { childBotId: childCtx.id, childBotRevenue: childCtx.revenue_percent } : {};

  await setConversationState(supabase, userId, "awaiting_quantity_choice", {
    productName, unitPrice, productId, variationId, stock, ...childBotData,
  });

  const quickQuantities = [1, 2, 3, 5, 10];
  const allowedQuantities = stock != null ? quickQuantities.filter((q) => q <= stock) : quickQuantities;
  const finalQuantities = allowedQuantities.length ? allowedQuantities : [1];

  const rows: any[][] = [];
  for (let i = 0; i < finalQuantities.length; i += 3) {
    rows.push(
      finalQuantities.slice(i, i + 3).map((q) => ({
        text: `${q}×`,
        callback_data: `qty_${q}`,
        style: "primary",
      })),
    );
  }
  rows.push([{ text: lang === "bn" ? "✏️ কাস্টম পরিমাণ" : "✏️ Custom Quantity", callback_data: "qty_custom", style: "success" }]);
  rows.push([{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "qty_cancel", style: "danger" }]);

  let text = `<b>${productName}</b>\n\n`;
  if (stock != null) {
    text += lang === "bn" ? `স্টক: <b>${stock}</b>\n\n` : `Stock: <b>${stock}</b>\n\n`;
  }
  text += lang === "bn"
    ? "নিচ থেকে পরিমাণ বেছে নাও অথবা কাস্টম লিখো:"
    : "Pick a quantity below, or enter a custom amount:";

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: rows } });
}

export async function proceedToPaymentWithQuantity(
  token: string, supabase: any, chatId: number, telegramUser: any,
  state: { productName: string; unitPrice: number; productId: string; variationId: string | null; stock: number | null; childBotId?: string; childBotRevenue?: number },
  quantity: number, lang: string,
) {
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ অবৈধ পরিমাণ। ১ থেকে ২০ এর মধ্যে দাও।" : "❌ Invalid quantity. Enter a number between 1 and 20.");
    return;
  }
  if (state.stock != null && quantity > state.stock) {
    await sendMessage(token, chatId, lang === "bn" ? `❌ স্টকে শুধু ${state.stock} টা আছে।` : `❌ Only ${state.stock} in stock.`);
    return;
  }

  const totalPrice = state.unitPrice * quantity;
  const labeledName = quantity > 1 ? `${state.productName} × ${quantity}` : state.productName;

  // Lazy import to avoid circular dependency
  const { showPaymentMethodChoice } = await import("./payment-method-flow.ts");
  await showPaymentMethodChoice(
    token, supabase, chatId, telegramUser,
    labeledName, totalPrice, state.productId, state.variationId, lang,
    quantity, state.unitPrice,
  );
}
