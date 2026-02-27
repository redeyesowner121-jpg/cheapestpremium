// ===== ADMIN PRODUCT MANAGEMENT =====

import { sendMessage } from "../telegram-api.ts";

export async function handleEditPrice(token: string, supabase: any, chatId: number, args: string) {
  const lastSpace = args.lastIndexOf(" ");
  if (lastSpace === -1) { await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>"); return; }
  const name = args.substring(0, lastSpace).trim();
  const newPrice = parseFloat(args.substring(lastSpace + 1));
  if (!name || isNaN(newPrice)) { await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>"); return; }

  const { data, error } = await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).ilike("name", `%${name}%`).select("name, price");
  if (error || !data?.length) { await sendMessage(token, chatId, `❌ "${name}" not found.`); }
  else { await sendMessage(token, chatId, `✅ ${data[0].name} → ₹${newPrice}`); }
}

export async function handleOutStock(token: string, supabase: any, chatId: number, name: string) {
  if (!name) { await sendMessage(token, chatId, "⚠️ Usage: <code>/out_stock Name</code>"); return; }
  const { data, error } = await supabase.from("products").update({ stock: 0, is_active: false }).ilike("name", `%${name}%`).select("name");
  if (error || !data?.length) { await sendMessage(token, chatId, `❌ "${name}" not found.`); }
  else { await sendMessage(token, chatId, `✅ ${data[0].name} → Out of Stock`); }
}
