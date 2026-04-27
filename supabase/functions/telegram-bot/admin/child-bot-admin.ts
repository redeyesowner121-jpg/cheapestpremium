// ===== CHILD BOT ADMIN MENU & SETTINGS =====

import { sendMessage } from "../telegram-api.ts";
import { getSettings, getChildBotSettings, saveChildBotSetting } from "../db-helpers.ts";
import { getChildBotContext } from "../child-context.ts";

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

export async function handleChildBotAdminMenu(token: string, supabase: any, chatId: number, _userId: number) {
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
