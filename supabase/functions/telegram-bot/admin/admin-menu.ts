// ===== ADMIN MENU (Interactive Buttons) =====

import { SUPER_ADMIN_ID } from "../constants.ts";
import { sendMessage, sendPhoto } from "../telegram-api.ts";
import { getSettings, isSuperAdmin } from "../db-helpers.ts";

// ===== MAIN ADMIN MENU (Button-based) =====
export async function handleAdminMenu(token: string, supabase: any, chatId: number, userId: number) {
  const { count: userCount } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: orderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { count: pendingCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true }).eq("status", "pending");

  const buttons: any[][] = [
    [{ text: "📦 Products", callback_data: "adm_products" }, { text: "👥 Users", callback_data: "adm_users" }],
    [{ text: "💰 Wallet", callback_data: "adm_wallet" }, { text: "📊 Analytics", callback_data: "adm_analytics" }],
    [{ text: "📢 Broadcast", callback_data: "adm_broadcast" }, { text: "📢 Channels", callback_data: "adm_channels" }],
    [{ text: "🧠 AI Training", callback_data: "adm_ai_training" }, { text: "⚙️ Settings", callback_data: "adm_settings" }],
  ];

  if (isSuperAdmin(userId)) {
    buttons.push([{ text: "👑 Owner Panel", callback_data: "adm_owner" }]);
  }

  await sendMessage(token, chatId,
    `🔐 <b>Admin Control Panel</b>\n\n` +
    `👥 Users: <b>${userCount || 0}</b> | 📦 Orders: <b>${orderCount || 0}</b> | ⏳ Pending: <b>${pendingCount || 0}</b>\n\n` +
    `নিচের বাটনে ক্লিক করে ক্যাটেগরি সিলেক্ট করুন:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ===== SUB-MENU: Products =====
export async function handleAdminProductsMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `📦 <b>Product Management</b>\n\nনিচের বাটন ব্যবহার করুন:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Product", callback_data: "adm_add_product" }],
      [{ text: "✏️ Edit Price", callback_data: "adm_edit_price" }, { text: "❌ Out of Stock", callback_data: "adm_out_stock" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

// ===== SUB-MENU: Users =====
export async function handleAdminUsersMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `👥 <b>User Management</b>\n\nনিচের বাটন ব্যবহার করুন:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "👥 Recent Users", callback_data: "adm_recent_users" }, { text: "📋 All Users", callback_data: "adm_all_users" }],
      [{ text: "📜 Order History", callback_data: "adm_history" }, { text: "🔄 Make Reseller", callback_data: "adm_make_reseller" }],
      [{ text: "🚫 Ban User", callback_data: "adm_ban" }, { text: "✅ Unban User", callback_data: "adm_unban" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

// ===== SUB-MENU: Wallet =====
export async function handleAdminWalletMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `💰 <b>Wallet Management</b>\n\nনিচের বাটন ব্যবহার করুন:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Balance", callback_data: "adm_add_balance" }, { text: "➖ Deduct Balance", callback_data: "adm_deduct_balance" }],
      [{ text: "⬅️ Back to Admin", callback_data: "adm_back" }],
    ]}}
  );
}

// ===== SUB-MENU: Channels =====
export async function handleAdminChannelsMenu(token: string, chatId: number) {
  await sendMessage(token, chatId,
    `📢 <b>Channel Management</b>\n\nনিচের বাটন ব্যবহার করুন:`,
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
    `👑 <b>Owner Panel</b>\n\nশুধুমাত্র সুপার অ্যাডমিনের জন্য:`,
    { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Admin", callback_data: "adm_add_admin" }, { text: "➖ Remove Admin", callback_data: "adm_remove_admin" }],
      [{ text: "📋 List Admins", callback_data: "adm_list_admins" }],
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
    `⚙️ <b>Settings (20+ Configurable Items)</b>\n\nক্যাটেগরি সিলেক্ট করুন:`,
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
  { key: "upi_id", label: "UPI ID", emoji: "💳", description: "পেমেন্টের জন্য UPI আইডি", defaultValue: "" },
  { key: "upi_name", label: "UPI Name", emoji: "👤", description: "UPI অ্যাকাউন্ট নাম", defaultValue: "" },
  { key: "binance_id", label: "Binance Pay ID", emoji: "🔶", description: "Binance Pay ID", defaultValue: "" },
  { key: "binance_contact", label: "Binance Contact", emoji: "📞", description: "Binance কন্টাক্ট মেসেজ", defaultValue: "" },
  { key: "min_deposit_amount", label: "Min Deposit", emoji: "⬇️", description: "সর্বনিম্ন ডিপোজিট অ্যামাউন্ট (₹)", defaultValue: "10" },
  { key: "max_deposit_amount", label: "Max Deposit", emoji: "⬆️", description: "সর্বোচ্চ ডিপোজিট অ্যামাউন্ট (₹)", defaultValue: "10000" },
];

const BONUS_SETTINGS: SettingDef[] = [
  { key: "referral_bonus", label: "Referral Bonus", emoji: "🎁", description: "রেফারাল বোনাস অ্যামাউন্ট (₹)", defaultValue: "10" },
  { key: "min_referral_amount", label: "Min Referral Order", emoji: "📊", description: "রেফারাল বোনাসের জন্য সর্বনিম্ন অর্ডার (₹)", defaultValue: "15" },
  { key: "daily_bonus_min", label: "Daily Bonus Min", emoji: "🎰", description: "দৈনিক বোনাস সর্বনিম্ন (₹)", defaultValue: "1" },
  { key: "daily_bonus_max", label: "Daily Bonus Max", emoji: "🎯", description: "দৈনিক বোনাস সর্বোচ্চ (₹)", defaultValue: "5" },
  { key: "reseller_commission", label: "Reseller Commission %", emoji: "💵", description: "রিসেলার কমিশন শতাংশ", defaultValue: "10" },
  { key: "first_purchase_bonus", label: "1st Purchase Bonus", emoji: "🎊", description: "প্রথম পার্চেজ বোনাস (₹)", defaultValue: "0" },
];

const STORE_SETTINGS: SettingDef[] = [
  { key: "app_name", label: "App/Store Name", emoji: "🏪", description: "অ্যাপ/স্টোরের নাম", defaultValue: "RKR Premium Store" },
  { key: "app_tagline", label: "App Tagline", emoji: "✨", description: "স্প্ল্যাশ স্ক্রিন সাবটাইটেল", defaultValue: "" },
  { key: "app_url", label: "App URL", emoji: "🌐", description: "ওয়েবসাইট URL (শেয়ারিং/রেফারেলের জন্য)", defaultValue: "" },
  { key: "currency_symbol", label: "Currency Symbol", emoji: "💱", description: "মূল্যের প্রতীক (₹, $, ৳)", defaultValue: "₹" },
  { key: "support_contact", label: "Support Contact", emoji: "📞", description: "সাপোর্ট কন্টাক্ট (Telegram/Phone)", defaultValue: "" },
  { key: "no_return_policy", label: "Return Policy Text", emoji: "📜", description: "No Return Policy টেক্সট", defaultValue: "All sales are final. No returns." },
];

const BOT_SETTINGS: SettingDef[] = [
  { key: "bot_welcome_message", label: "Welcome Message", emoji: "👋", description: "বটের ওয়েলকাম মেসেজ (কাস্টম)", defaultValue: "" },
  { key: "bot_maintenance", label: "Bot Maintenance", emoji: "🔧", description: "বট মেনটেন্যান্স মোড (on/off)", defaultValue: "off" },
  { key: "auto_confirm_orders", label: "Auto Confirm Orders", emoji: "⚡", description: "ওয়ালেট অর্ডার অটো কনফার্ম (on/off)", defaultValue: "off" },
  { key: "ai_enabled", label: "AI Auto Reply", emoji: "🤖", description: "AI অটো রিপ্লাই (on/off)", defaultValue: "on" },
];

const SECURITY_SETTINGS: SettingDef[] = [
  { key: "maintenance_mode", label: "Maintenance Mode", emoji: "🚧", description: "সাইট মেনটেন্যান্স মোড (on/off)", defaultValue: "off" },
  { key: "max_orders_per_day", label: "Max Orders/Day", emoji: "📦", description: "প্রতি ইউজার দৈনিক সর্বোচ্চ অর্ডার", defaultValue: "10" },
  { key: "min_wallet_pay", label: "Min Wallet Pay", emoji: "💳", description: "ওয়ালেট পে-এর সর্বনিম্ন অ্যামাউন্ট (₹)", defaultValue: "1" },
  { key: "max_wallet_balance", label: "Max Wallet Balance", emoji: "💰", description: "সর্বোচ্চ ওয়ালেট ব্যালেন্স (₹)", defaultValue: "50000" },
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
  text += `\nনিচের বাটনে ক্লিক করে যেকোনো সেটিং পরিবর্তন করুন:`;

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
    `✏️ <b>${def.label} পরিবর্তন করুন</b>\n\n` +
    `${def.emoji} <b>বর্তমান মান:</b> <code>${currentValue}</code>\n` +
    `📝 <b>বিবরণ:</b> ${def.description}\n\n` +
    `নতুন মান টাইপ করুন:\n/cancel করলে বাতিল হবে।`
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
    `✅ <b>${label} আপডেট হয়েছে!</b>\n\n${emoji} নতুন মান: <code>${value}</code>`,
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
  text += `\n/admin মেনু থেকে ⚙️ Settings-এ গিয়ে পরিবর্তন করুন।`;

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
  const { data: users } = await supabase.from("telegram_bot_users").select("telegram_id").eq("is_banned", false);
  if (!users?.length) { await sendMessage(token, adminChatId, "No users to broadcast to."); return; }

  let sent = 0, failed = 0, skipped = 0;
  const batchSize = 10;
  const delayBetweenBatches = 1000;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const promises = batch.map(async (user: any) => {
      try {
        if (user.telegram_id === SUPER_ADMIN_ID) {
          skipped++;
          return true;
        }
        if (msg.photo) {
          await sendPhoto(token, user.telegram_id, msg.photo[msg.photo.length - 1].file_id, msg.caption || "");
        } else if (msg.text) {
          await sendMessage(token, user.telegram_id, msg.text);
        }
        sent++;
        return true;
      } catch (e) {
        console.error(`Broadcast to user ${user.telegram_id} failed:`, e);
        failed++;
        return false;
      }
    });

    await Promise.all(promises);
    if (i + batchSize < users.length) {
      await new Promise(r => setTimeout(r, delayBetweenBatches));
    }
  }

  await sendMessage(token, adminChatId, `📢 <b>Broadcast Complete!</b>\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n⏭️ Skipped: ${skipped}\n📊 Total: ${users.length}`);
}
