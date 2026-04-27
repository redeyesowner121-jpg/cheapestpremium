// ===== ADMIN SETTINGS MENU & EDITOR (20+ items) =====

import { sendMessage } from "../telegram-api.ts";
import { getSettings } from "../db-helpers.ts";

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
