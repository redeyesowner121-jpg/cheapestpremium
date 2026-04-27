// ===== MAIN ADMIN MENU & SUB-MENUS =====

import { sendMessage } from "../telegram-api.ts";
import { isSuperAdmin } from "../db-helpers.ts";
import { isChildBotMode } from "../child-context.ts";
import { isChildBotOwner, handleChildBotAdminMenu } from "./child-bot-admin.ts";

export async function handleAdminMenu(token: string, supabase: any, chatId: number, userId: number) {
  if (isChildBotMode() && isChildBotOwner(userId) && !isSuperAdmin(userId)) {
    return handleChildBotAdminMenu(token, supabase, chatId, userId);
  }

  const { count: userCount } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: orderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { count: pendingCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true }).eq("status", "pending");

  const buttons: any[][] = [
    [{ text: "📦 Products", callback_data: "adm_products", style: "primary" }, { text: "👥 Users", callback_data: "adm_users", style: "success" }],
    [{ text: "💰 Wallet", callback_data: "adm_wallet", style: "success" }, { text: "📊 Analytics", callback_data: "adm_analytics", style: "primary" }],
    [{ text: "📢 Broadcast", callback_data: "adm_broadcast", style: "danger" }, { text: "📢 Channels", callback_data: "adm_channels", style: "primary" }],
    [{ text: "🧠 AI Training", callback_data: "adm_ai_training", style: "primary" }, { text: "⚙️ Settings", callback_data: "adm_settings", style: "success" }],
  ];

  if (isSuperAdmin(userId)) {
    buttons.push([{ text: "👑 Owner Panel", callback_data: "adm_owner", style: "danger" }]);
  }

  await sendMessage(token, chatId,
    `🔐 <b>Admin Control Panel</b>\n\n` +
    `👥 Users: <b>${userCount || 0}</b> | 📦 Orders: <b>${orderCount || 0}</b> | ⏳ Pending: <b>${pendingCount || 0}</b>\n\n` +
    `Select a category below:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

export async function handleAdminProductsMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `📦 <b>Product Management</b>\n\nUse the buttons below:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Product", callback_data: "adm_add_product", style: "success" }],
      [{ text: "✏️ Edit Price", callback_data: "adm_edit_price", style: "primary" }, { text: "❌ Out of Stock", callback_data: "adm_out_stock", style: "danger" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

export async function handleAdminUsersMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `👥 <b>User Management</b>\n\nUse the buttons below:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "👥 Recent Users", callback_data: "adm_recent_users", style: "primary" }, { text: "📋 All Users", callback_data: "adm_all_users", style: "success" }],
      [{ text: "📜 Order History", callback_data: "adm_history", style: "primary" }, { text: "🔄 Make Reseller", callback_data: "adm_make_reseller", style: "success" }],
      [{ text: "🚫 Ban User", callback_data: "adm_ban", style: "danger" }, { text: "✅ Unban User", callback_data: "adm_unban", style: "success" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

export async function handleAdminWalletMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `💰 <b>Wallet Management</b>\n\nUse the buttons below:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Balance", callback_data: "adm_add_balance", style: "success" }, { text: "➖ Deduct Balance", callback_data: "adm_deduct_balance", style: "danger" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

export async function handleAdminChannelsMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `📢 <b>Channel Management</b>\n\nUse the buttons below:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "📋 List Channels", callback_data: "adm_list_channels" }],
      [{ text: "➕ Add Channel", callback_data: "adm_add_channel" }, { text: "➖ Remove Channel", callback_data: "adm_remove_channel" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

export async function handleAdminOwnerMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `👑 <b>Owner Panel</b>\n\nSuper Admin only:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Admin", callback_data: "adm_add_admin", style: "success" }, { text: "➖ Remove Admin", callback_data: "adm_remove_admin", style: "danger" }],
      [{ text: "📋 List Admins", callback_data: "adm_list_admins", style: "primary" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}
