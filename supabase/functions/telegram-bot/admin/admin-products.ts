// ===== ADMIN PRODUCT MANAGEMENT =====

import { sendMessage } from "../telegram-api.ts";

export async function handleEditPrice(token: string, supabase: any, chatId: number, args: string) {
  const lastSpace = args.lastIndexOf(" ");
  if (lastSpace === -1) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>");
    return;
  }
  const name = args.substring(0, lastSpace).trim();
  const newPrice = parseFloat(args.substring(lastSpace + 1));
  if (!name || isNaN(newPrice)) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>");
    return;
  }

  try {
    const { data, error } = await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).ilike("name", `%${name}%`).select("name, price");
    if (error) {
      console.error("Edit price error:", error);
      await sendMessage(token, chatId, `❌ Failed to update price: ${error.message}`);
      return;
    }
    if (!data?.length) {
      await sendMessage(token, chatId, `❌ "${name}" not found.`);
      return;
    }
    await sendMessage(token, chatId, `✅ ${data[0].name} → ₹${newPrice}`);
  } catch (e) {
    console.error("Edit price exception:", e);
    await sendMessage(token, chatId, `❌ Error updating price`);
  }
}

export async function handleOutStock(token: string, supabase: any, chatId: number, name: string) {
  if (!name) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/out_stock Name</code>");
    return;
  }

  try {
    const { data, error } = await supabase.from("products").update({ stock: 0, is_active: false }).ilike("name", `%${name}%`).select("name");
    if (error) {
      console.error("Out of stock error:", error);
      await sendMessage(token, chatId, `❌ Failed to update stock: ${error.message}`);
      return;
    }
    if (!data?.length) {
      await sendMessage(token, chatId, `❌ "${name}" not found.`);
      return;
    }
    await sendMessage(token, chatId, `✅ ${data[0].name} → Out of Stock`);
  } catch (e) {
    console.error("Out of stock exception:", e);
    await sendMessage(token, chatId, `❌ Error updating stock`);
  }
}
