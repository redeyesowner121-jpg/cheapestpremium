// ===== ADMIN MENU (Interactive Buttons) =====

import { SUPER_ADMIN_ID } from "../constants.ts";
import { sendMessage, sendPhoto } from "../telegram-api.ts";
import { getSettings, isSuperAdmin, getChildBotSettings, saveChildBotSetting } from "../db-helpers.ts";
import { getChildBotContext, isChildBotMode } from "../child-context.ts";

// ===== CHILD BOT SETTINGS DEFS (limited settings for child bot owners) =====
interface ChildSettingDef {
  key: string;
  label: string;
  emoji: string;
  description: string;
  defaultValue: string;
}

const CHILD_BOT_SETTINGS: ChildSettingDef[] = [
  { key: "app_name", label: "Store Name", emoji: "🏪", description: "Your bot's store name", defaultValue: "" },
  { key: "bot_welcome_message", label: "Welcome Message", emoji: "👋", description: "Custom welcome message for your bot", defaultValue: "" },
  { key: "support_contact", label: "Support Contact", emoji: "📞", description: "Your support contact (Telegram/Phone)", defaultValue: "" },
  { key: "currency_symbol", label: "Currency Symbol", emoji: "💱", description: "Price symbol (₹, $, ৳)", defaultValue: "₹" },
  { key: "no_return_policy", label: "Return Policy", emoji: "📜", description: "Your return policy text", defaultValue: "All sales are final. No returns." },
];

export function isChildBotOwner(userId: number): boolean {
  const ctx = getChildBotContext();
  return !!ctx && ctx.owner_telegram_id === userId;
}

// ===== CHILD BOT ADMIN MENU (Limited) =====
export async function handleChildBotAdminMenu(token: string, supabase: any, chatId: number, userId: number) {
  const ctx = getChildBotContext()!;
  const { count: userCount } = await supabase.from("child_bot_users").select("*", { count: "exact", head: true }).eq("child_bot_id", ctx.id);
  const { count: orderCount } = await supabase.from("child_bot_orders").select("*", { count: "exact", head: true }).eq("child_bot_id", ctx.id);

  const buttons: any[][] = [
    [{ text: "👥 My Bot Users", callback_data: "cadm_users", style: "primary" }, { text: "📦 My Orders", callback_data: "cadm_orders", style: "success" }],
    [{ text: "📊 My Analytics", callback_data: "cadm_analytics", style: "primary" }],
    [{ text: "⚙️ Bot Settings", callback_data: "cadm_settings", style: "success" }],
  ];

  await sendMessage(token, chatId,
    `🔐 <b>Child Bot Admin Panel</b>\n\n` +
    `🤖 Bot: <b>@${ctx.bot_username || "Unknown"}</b>\n` +
    `👥 Users: <b>${userCount || 0}</b> | 📦 Orders: <b>${orderCount || 0}</b>\n\n` +
    `Select an option below:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ===== CHILD BOT SETTINGS MENU =====
export async function handleChildBotSettingsMenu(token: string, supabase: any, chatId: number) {
  const ctx = getChildBotContext()!;
  const childSettings = await getChildBotSettings(supabase, ctx.id);
  const globalSettings = await getSettings(supabase);

  let text = `⚙️ <b>Your Bot Settings</b>\n<i>Changes only affect your bot (@${ctx.bot_username || "your bot"})</i>\n\n`;
  CHILD_BOT_SETTINGS.forEach(s => {
    const val = childSettings[s.key] || globalSettings[s.key] || s.defaultValue || "Not set";
    const isCustom = childSettings[s.key] ? " ✏️" : "";
    text += `${s.emoji} <b>${s.label}:</b> <code>${val}</code>${isCustom}\n`;
  });
  text += `\n✏️ = Customized for your bot\nClick a button below to change:`;

  const buttons = CHILD_BOT_SETTINGS.map(s => [{
    text: `${s.emoji} ${s.label}`,
    callback_data: `cadm_edit_${s.key}`,
   
  }]);
  buttons.push([{ text: "🔄 Reset All to Default", callback_data: "cadm_reset_settings" }]);
  buttons.push([{ text: "⬅️ Back", callback_data: "cadm_back" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function promptChildBotSettingEdit(token: string, supabase: any, chatId: number, settingKey: string) {
  const def = CHILD_BOT_SETTINGS.find(s => s.key === settingKey);
  if (!def) { await sendMessage(token, chatId, "❌ Setting not found."); return; }

  const ctx = getChildBotContext()!;
  const childSettings = await getChildBotSettings(supabase, ctx.id);
  const globalSettings = await getSettings(supabase);
  const currentValue = childSettings[settingKey] || globalSettings[settingKey] || def.defaultValue || "Not set";

  await sendMessage(token, chatId,
    `✏️ <b>Edit ${def.label}</b>\n\n` +
    `${def.emoji} <b>Current Value:</b> <code>${currentValue}</code>\n` +
    `📝 <b>Description:</b> ${def.description}\n\n` +
    `Type the new value:\nType /cancel to abort.`
  );
}

export async function saveChildBotSettingHandler(token: string, supabase: any, chatId: number, settingKey: string, value: string) {
  const def = CHILD_BOT_SETTINGS.find(s => s.key === settingKey);
  const ctx = getChildBotContext()!;

  await saveChildBotSetting(supabase, ctx.id, settingKey, value);

  const label = def?.label || settingKey;
  const emoji = def?.emoji || "⚙️";

  await sendMessage(token, chatId,
    `✅ <b>${label} updated!</b>\n\n${emoji} New value: <code>${value}</code>\n\n<i>This change only affects your bot @${ctx.bot_username || ""}.</i>`,
    { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Settings", callback_data: "cadm_settings" }]] } }
  );
}

export async function handleChildBotAnalytics(token: string, supabase: any, chatId: number) {
  const ctx = getChildBotContext()!;
  const { count: totalUsers } = await supabase.from("child_bot_users").select("*", { count: "exact", head: true }).eq("child_bot_id", ctx.id);
  const { count: totalOrders } = await supabase.from("child_bot_orders").select("*", { count: "exact", head: true }).eq("child_bot_id", ctx.id);
  const { data: earnings } = await supabase.from("child_bot_earnings").select("amount").eq("child_bot_id", ctx.id);
  const totalEarnings = earnings?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;
  const { count: pendingOrders } = await supabase.from("child_bot_orders").select("*", { count: "exact", head: true }).eq("child_bot_id", ctx.id).eq("status", "pending");

  await sendMessage(token, chatId,
    `📊 <b>Your Bot Analytics</b>\n\n` +
    `🤖 Bot: @${ctx.bot_username || "Unknown"}\n` +
    `👥 Total Users: <b>${totalUsers || 0}</b>\n` +
    `📦 Total Orders: <b>${totalOrders || 0}</b>\n` +
    `⏳ Pending: <b>${pendingOrders || 0}</b>\n` +
    `💰 Total Earnings: <b>₹${totalEarnings}</b>\n` +
    `📈 Revenue %: <b>${ctx.revenue_percent}%</b>`,
    { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "cadm_back" }]] } }
  );
}

export async function handleChildBotUsers(token: string, supabase: any, chatId: number) {
  const ctx = getChildBotContext()!;
  const { data: users } = await supabase.from("child_bot_users").select("*").eq("child_bot_id", ctx.id).order("last_active", { ascending: false }).limit(20);

  if (!users?.length) {
    await sendMessage(token, chatId, "👥 No users yet in your bot.",
      { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "cadm_back" }]] } });
    return;
  }

  let text = `👥 <b>Recent Users (${users.length})</b>\n\n`;
  users.forEach((u: any, i: number) => {
    text += `${i + 1}. ${u.first_name || "User"} ${u.username ? `(@${u.username})` : ""} — <code>${u.telegram_id}</code>\n`;
  });

  await sendMessage(token, chatId, text,
    { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "cadm_back" }]] } });
}

export async function handleChildBotOrders(token: string, supabase: any, chatId: number) {
  const ctx = getChildBotContext()!;
  const { data: orders } = await supabase.from("child_bot_orders").select("*").eq("child_bot_id", ctx.id).order("created_at", { ascending: false }).limit(10);

  if (!orders?.length) {
    await sendMessage(token, chatId, "📦 No orders yet in your bot.",
      { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "cadm_back" }]] } });
    return;
  }

  let text = `📦 <b>Recent Orders (${orders.length})</b>\n\n`;
  orders.forEach((o: any, i: number) => {
    const status = o.status === "confirmed" ? "✅" : o.status === "pending" ? "⏳" : "❌";
    text += `${i + 1}. ${status} ${o.product_name} — ₹${o.total_price} (Commission: ₹${o.owner_commission})\n`;
  });

  await sendMessage(token, chatId, text,
    { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "cadm_back" }]] } });
}

// ===== MAIN ADMIN MENU (Button-based) =====
export async function handleAdminMenu(token: string, supabase: any, chatId: number, userId: number) {
  // If child bot owner, show limited menu
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

// ===== SUB-MENU: Products =====
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

// ===== SUB-MENU: Users =====
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

// ===== SUB-MENU: Wallet =====
export async function handleAdminWalletMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `💰 <b>Wallet Management</b>\n\nUse the buttons below:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Balance", callback_data: "adm_add_balance", style: "success" }, { text: "➖ Deduct Balance", callback_data: "adm_deduct_balance", style: "danger" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

// ===== SUB-MENU: Channels =====
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

// ===== SUB-MENU: Owner =====
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

// ===== SETTINGS MENU (20+ items) =====
const SETTINGS_CATEGORIES = [
  { text: "💳 Payment Settings", callback_data: "adm_set_payment" },
  { text: "🎁 Bonus & Referral", callback_data: "adm_set_bonus" },
  { text: "🏪 Store Settings", callback_data: "adm_set_store" },
  { text: "🤖 Bot Settings", callback_data: "adm_set_bot" },
  { text: "🔒 Security & Limits", callback_data: "adm_set_security" },
];

export async function handleAdminSettingsMenu(token: string, chatId: number) {
  const buttons = SETTINGS_CATEGORIES.map(c => [c]);
  buttons.push([{ text: "⬅️ Back to Admin", callback_data: "adm_back" }]);
  
  await sendMessage(token, chatId,
    `⚙️ <b>Settings (20+ Configurable Items)</b>\n\nSelect a category:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ===== SETTINGS SUB-CATEGORIES =====

// All settings definitions
interface SettingDef {
  key: string;
  label: string;
  emoji: string;
  description: string;
  defaultValue: string;
}

const PAYMENT_SETTINGS: SettingDef[] = [
  { key: "upi_id", label: "UPI ID", emoji: "💳", description: "UPI ID for payments", defaultValue: "" },
  { key: "upi_name", label: "UPI Name", emoji: "👤", description: "UPI account name", defaultValue: "" },
  { key: "binance_id", label: "Binance Pay ID", emoji: "🔶", description: "Binance Pay ID", defaultValue: "" },
  { key: "binance_contact", label: "Binance Contact", emoji: "📞", description: "Binance contact message", defaultValue: "" },
  { key: "min_deposit_amount", label: "Min Deposit", emoji: "⬇️", description: "Minimum deposit amount (₹)", defaultValue: "10" },
  { key: "max_deposit_amount", label: "Max Deposit", emoji: "⬆️", description: "Maximum deposit amount (₹)", defaultValue: "10000" },
];

const BONUS_SETTINGS: SettingDef[] = [
  { key: "referral_bonus", label: "Referral Bonus", emoji: "🎁", description: "Referral bonus amount (₹)", defaultValue: "10" },
  { key: "min_referral_amount", label: "Min Referral Order", emoji: "📊", description: "Minimum order for referral bonus (₹)", defaultValue: "15" },
  { key: "daily_bonus_min", label: "Daily Bonus Min", emoji: "🎰", description: "Daily bonus minimum (₹)", defaultValue: "1" },
  { key: "daily_bonus_max", label: "Daily Bonus Max", emoji: "🎯", description: "Daily bonus maximum (₹)", defaultValue: "5" },
  { key: "reseller_commission", label: "Reseller Commission %", emoji: "💵", description: "Reseller commission percentage", defaultValue: "10" },
  { key: "first_purchase_bonus", label: "1st Purchase Bonus", emoji: "🎊", description: "First purchase bonus (₹)", defaultValue: "0" },
];

const STORE_SETTINGS: SettingDef[] = [
  { key: "app_name", label: "App/Store Name", emoji: "🏪", description: "App/Store name", defaultValue: "RKR Premium Store" },
  { key: "app_tagline", label: "App Tagline", emoji: "✨", description: "Splash screen subtitle", defaultValue: "" },
  { key: "app_url", label: "App URL", emoji: "🌐", description: "Website URL (for sharing/referrals)", defaultValue: "" },
  { key: "bot_username", label: "Bot Username", emoji: "🤖", description: "Telegram bot username (without @)", defaultValue: "Air1_Premium_bot" },
  { key: "currency_symbol", label: "Currency Symbol", emoji: "💱", description: "Price symbol (₹, $, ৳)", defaultValue: "₹" },
  { key: "support_contact", label: "Support Contact", emoji: "📞", description: "Support contact (Telegram/Phone)", defaultValue: "" },
  { key: "no_return_policy", label: "Return Policy Text", emoji: "📜", description: "No Return Policy text", defaultValue: "All sales are final. No returns." },
];

const BOT_SETTINGS: SettingDef[] = [
  { key: "bot_welcome_message", label: "Welcome Message", emoji: "👋", description: "Bot welcome message (custom)", defaultValue: "" },
  { key: "bot_maintenance", label: "Bot Maintenance", emoji: "🔧", description: "Bot maintenance mode (on/off)", defaultValue: "off" },
  { key: "auto_confirm_orders", label: "Auto Confirm Orders", emoji: "⚡", description: "Auto confirm wallet orders (on/off)", defaultValue: "off" },
  { key: "ai_enabled", label: "AI Auto Reply", emoji: "🤖", description: "AI auto reply (on/off)", defaultValue: "on" },
];

const SECURITY_SETTINGS: SettingDef[] = [
  { key: "maintenance_mode", label: "Maintenance Mode", emoji: "🚧", description: "Site maintenance mode (on/off)", defaultValue: "off" },
  { key: "max_orders_per_day", label: "Max Orders/Day", emoji: "📦", description: "Max orders per user per day", defaultValue: "10" },
  { key: "min_wallet_pay", label: "Min Wallet Pay", emoji: "💳", description: "Minimum wallet pay amount (₹)", defaultValue: "1" },
  { key: "max_wallet_balance", label: "Max Wallet Balance", emoji: "💰", description: "Maximum wallet balance (₹)", defaultValue: "50000" },
];

export function getAllSettingDefs(): Record<string, SettingDef[]> {
  return {
    payment: PAYMENT_SETTINGS,
    bonus: BONUS_SETTINGS,
    store: STORE_SETTINGS,
    bot: BOT_SETTINGS,
    security: SECURITY_SETTINGS,
  };
}

export function findSettingDef(key: string): SettingDef | undefined {
  const all = [...PAYMENT_SETTINGS, ...BONUS_SETTINGS, ...STORE_SETTINGS, ...BOT_SETTINGS, ...SECURITY_SETTINGS];
  return all.find(s => s.key === key);
}

export async function handleSettingsCategory(token: string, supabase: any, chatId: number, category: string) {
  const categoryMap: Record<string, { title: string; settings: SettingDef[] }> = {
    payment: { title: "💳 Payment Settings", settings: PAYMENT_SETTINGS },
    bonus: { title: "🎁 Bonus & Referral Settings", settings: BONUS_SETTINGS },
    store: { title: "🏪 Store Settings", settings: STORE_SETTINGS },
    bot: { title: "🤖 Bot Settings", settings: BOT_SETTINGS },
    security: { title: "🔒 Security & Limits", settings: SECURITY_SETTINGS },
  };

  const cat = categoryMap[category];
  if (!cat) return;

  const settings = await getSettings(supabase);

  let text = `${cat.title}\n\n`;
  cat.settings.forEach(s => {
    const val = settings[s.key] || s.defaultValue || "Not set";
    text += `${s.emoji} <b>${s.label}:</b> <code>${val}</code>\n`;
  });
  text += `\nClick a button below to change any setting:`;

  const buttons = cat.settings.map(s => [{
    text: `${s.emoji} ${s.label}`,
    callback_data: `adm_edit_set_${s.key}`,
   
  }]);
  buttons.push([{ text: "⬅️ Back to Settings", callback_data: "adm_settings" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== PROMPT FOR SETTING EDIT =====
export async function promptSettingEdit(token: string, supabase: any, chatId: number, settingKey: string) {
  const def = findSettingDef(settingKey);
  if (!def) {
    await sendMessage(token, chatId, "❌ Setting not found.");
    return;
  }

  const settings = await getSettings(supabase);
  const currentValue = settings[settingKey] || def.defaultValue || "Not set";

  await sendMessage(token, chatId,
    `✏️ <b>Edit ${def.label}</b>\n\n` +
    `${def.emoji} <b>Current Value:</b> <code>${currentValue}</code>\n` +
    `📝 <b>Description:</b> ${def.description}\n\n` +
    `Type the new value:\nType /cancel to abort.`
  );
}

// ===== SAVE SETTING =====
export async function saveSetting(token: string, supabase: any, chatId: number, settingKey: string, value: string) {
  const def = findSettingDef(settingKey);
  
  await supabase.from("app_settings").upsert(
    { key: settingKey, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  const label = def?.label || settingKey;
  const emoji = def?.emoji || "⚙️";

  await sendMessage(token, chatId,
    `✅ <b>${label} updated!</b>\n\n${emoji} New value: <code>${value}</code>`,
    { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Settings", callback_data: "adm_settings" }]] } }
  );
}

// ===== BOT SETTINGS COMMAND (legacy) =====
export async function handleBotSettings(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const allDefs = [...PAYMENT_SETTINGS, ...BONUS_SETTINGS, ...STORE_SETTINGS, ...BOT_SETTINGS, ...SECURITY_SETTINGS];
  
  let text = `⚙️ <b>All Bot Settings (${allDefs.length} items)</b>\n\n`;
  allDefs.forEach(s => {
    const val = settings[s.key] || s.defaultValue || "—";
    text += `${s.emoji} ${s.label}: <code>${val}</code>\n`;
  });
  text += `\nGo to ⚙️ Settings from /admin menu to edit.`;

  await sendMessage(token, chatId, text);
}

export async function handleSetMinReferral(token: string, supabase: any, chatId: number, amount: number) {
  if (!amount || amount < 0) {
    await sendMessage(token, chatId, "❌ Usage: /set_min_referral [amount]\nExample: /set_min_referral 15");
    return;
  }
  
  await supabase.from("app_settings").upsert(
    { key: "min_referral_amount", value: String(amount), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  
  await sendMessage(token, chatId, `✅ Minimum referral order amount set to <b>₹${amount}</b>`);
}

export async function handleReport(token: string, supabase: any, chatId: number) {
  const { count: totalUsers } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: totalWallets } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true });
  const { count: resellerCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true }).eq("is_reseller", true);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const { count: todayOrderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString());
  const { data: confirmedToday } = await supabase.from("telegram_orders").select("amount").eq("status", "confirmed").gte("created_at", today.toISOString());
  const todayRevenue = confirmedToday?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;

  const { count: allOrders } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { data: allConfirmed } = await supabase.from("telegram_orders").select("amount").eq("status", "confirmed");
  const allRevenue = allConfirmed?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;

  const { data: walletSum } = await supabase.from("telegram_wallets").select("balance");
  const totalWalletBalance = walletSum?.reduce((s: number, w: any) => s + (w.balance || 0), 0) || 0;

  await sendMessage(token, chatId,
    `📊 <b>Sales & Analytics Report</b>\n\n` +
    `👥 Users: <b>${totalUsers || 0}</b>\n` +
    `💰 Wallets: <b>${totalWallets || 0}</b>\n` +
    `🔄 Resellers: <b>${resellerCount || 0}</b>\n` +
    `💵 Total Wallet Balance: <b>₹${totalWalletBalance}</b>\n\n` +
    `📅 <b>Today:</b>\n• Orders: ${todayOrderCount || 0}\n• Revenue: ₹${todayRevenue}\n\n` +
    `📈 <b>All Time:</b>\n• Orders: ${allOrders || 0}\n• Revenue: ₹${allRevenue}`,
    { reply_markup: { inline_keyboard: [[{ text: "⬅️ Back to Admin", callback_data: "adm_back" }]] } }
  );
}

export async function executeBroadcast(token: string, supabase: any, adminChatId: number, msg: any) {
  // Gather users from ALL bots: Main, Resale, Giveaway, Mother, and every active Child bot.
  const mainToken = token;
  const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
  const giveawayToken = Deno.env.get("GIVEAWAY_BOT_TOKEN");
  const motherToken = Deno.env.get("MOTHER_BOT_TOKEN");

  // Track (telegram_id, botToken) pairs we've already queued so the same person on the same bot
  // never gets the message twice. Different bots = independent chats, so the user *should* get one
  // message per bot they use.
  const seen = new Set<string>(); // key = `${botToken}:${telegram_id}`
  const allTargets: { telegram_id: number; botToken: string; source: string }[] = [];
  const counts: Record<string, number> = { main: 0, resale: 0, giveaway: 0, mother: 0, child: 0 };

  const addTarget = (tid: number, botToken: string | undefined, source: string) => {
    if (!botToken || !tid) return;
    const key = `${botToken}:${tid}`;
    if (seen.has(key)) return;
    seen.add(key);
    allTargets.push({ telegram_id: tid, botToken, source });
    counts[source] = (counts[source] || 0) + 1;
  };

  // 1. Main bot users
  try {
    const { data: mainUsers } = await supabase
      .from("telegram_bot_users").select("telegram_id").eq("is_banned", false);
    (mainUsers || []).forEach((u: any) => addTarget(u.telegram_id, mainToken, "main"));
  } catch (e) { console.error("[broadcast] main users error:", e); }

  // 2. Resale bot users (table may or may not exist)
  if (resaleToken) {
    try {
      const { data: rUsers } = await supabase
        .from("resale_bot_users").select("telegram_id").eq("is_banned", false);
      (rUsers || []).forEach((u: any) => addTarget(u.telegram_id, resaleToken, "resale"));
    } catch (e) { /* table may not exist; ignore */ }
  }

  // 3. Giveaway bot users
  if (giveawayToken) {
    try {
      // Try a dedicated table first, then fall back to giveaway_points (which has telegram_id)
      const { data: gUsers } = await supabase
        .from("giveaway_points").select("telegram_id");
      (gUsers || []).forEach((u: any) => addTarget(u.telegram_id, giveawayToken, "giveaway"));
    } catch (e) { console.error("[broadcast] giveaway users error:", e); }
  }

  // 4. Mother bot users
  if (motherToken) {
    try {
      const { data: mUsers } = await supabase
        .from("mother_bot_users").select("telegram_id");
      (mUsers || []).forEach((u: any) => addTarget(u.telegram_id, motherToken, "mother"));
    } catch (e) { console.error("[broadcast] mother users error:", e); }
  }

  // 5. Every active Child bot
  try {
    const { data: childBots } = await supabase
      .from("child_bots").select("id, bot_token").eq("is_active", true);
    if (childBots?.length) {
      for (const cb of childBots) {
        const { data: cbUsers } = await supabase
          .from("child_bot_users").select("telegram_id").eq("child_bot_id", cb.id);
        (cbUsers || []).forEach((u: any) => addTarget(u.telegram_id, cb.bot_token, "child"));
      }
    }
  } catch (e) { console.error("[broadcast] child users error:", e); }

  if (!allTargets.length) { await sendMessage(token, adminChatId, "No users to broadcast to."); return; }

  await sendMessage(token, adminChatId,
    `📢 <b>Broadcasting to ${allTargets.length} chats…</b>\n\n` +
    `• Main: ${counts.main}\n• Resale: ${counts.resale}\n• Giveaway: ${counts.giveaway}\n• Mother: ${counts.mother}\n• Child bots: ${counts.child}`
  );

  let sent = 0, failed = 0, skipped = 0;
  const batchSize = 10;
  const delayBetweenBatches = 1000;

  for (let i = 0; i < allTargets.length; i += batchSize) {
    const batch = allTargets.slice(i, i + batchSize);
    const promises = batch.map(async (t) => {
      try {
        const copyRes = await fetch(`https://api.telegram.org/bot${t.botToken}/copyMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: t.telegram_id, from_chat_id: adminChatId, message_id: msg.message_id }),
        });
        const result = await copyRes.json();
        if (result.ok) sent++;
        else if (result.description?.includes("blocked")) skipped++;
        else failed++;
      } catch { failed++; }
    });
    await Promise.all(promises);
    if (i + batchSize < allTargets.length) await new Promise(r => setTimeout(r, delayBetweenBatches));
  }

  await sendMessage(token, adminChatId,
    `📢 <b>Broadcast Complete!</b>\n\n` +
    `📊 Main: ${counts.main} · Resale: ${counts.resale}\n` +
    `📊 Giveaway: ${counts.giveaway} · Mother: ${counts.mother}\n` +
    `📊 Child Bots: ${counts.child}\n\n` +
    `✅ Sent: ${sent}\n❌ Failed: ${failed}\n🚫 Blocked: ${skipped}\n📊 Total: ${allTargets.length}`
  );
}
