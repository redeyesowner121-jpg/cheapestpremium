// ===== MOTHER BOT MENUS =====

import { sendMsg, getRequiredChannels } from "./helpers.ts";

export async function showMotherMenu(token: string, chatId: number) {
  await sendMsg(token, chatId,
    "🏭 <b>Mother Bot — Create Your Own Selling Bot!</b>\n\n" +
    "Create a bot that sells products from our catalog.\n" +
    "Earn commission on every sale! 💰\n\n✅ Bot creation is <b>FREE!</b>\n\n" +
    "Choose an option:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Create a Bot", callback_data: "mother_create_bot", style: "success" }],
          [{ text: "🤖 My Bots", callback_data: "mother_my_bots", style: "primary" }],
          [{ text: "💰 Earnings", callback_data: "mother_earnings", style: "primary" }],
          [{ text: "❓ Help", callback_data: "mother_help", style: "danger" }],
        ],
      },
    }
  );
}

export async function showMyBots(token: string, supabase: any, chatId: number, userId: number) {
  const { data: bots } = await supabase.from("child_bots").select("*").eq("owner_telegram_id", userId).order("created_at", { ascending: false });

  if (!bots?.length) {
    await sendMsg(token, chatId, "🤖 You haven't created any bots yet.\n\nTap <b>Create a Bot</b> to get started!",
      { reply_markup: { inline_keyboard: [[{ text: "➕ Create a Bot", callback_data: "mother_create_bot", style: "success" }], [{ text: "🏠 Main Menu", callback_data: "mother_main", style: "primary" }]] } });
    return;
  }

  let text = "🤖 <b>Your Bots</b>\n\n";
  const buttons: any[][] = [];

  for (const bot of bots) {
    const status = bot.is_active ? "🟢 Active" : "🔴 Inactive";
    const { count: botUsers } = await supabase.from("child_bot_users").select("id", { count: "exact", head: true }).eq("child_bot_id", bot.id);
    text += `🤖 <b>@${bot.bot_username || "unknown"}</b> — ${status}\n`;
    text += `   💰 Revenue: ${bot.revenue_percent}% | 📦 Orders: ${bot.total_orders}\n`;
    text += `   💵 Earned: ₹${bot.total_earnings} | 👥 Users: ${botUsers || 0}\n`;
    text += `   📅 Created: ${new Date(bot.created_at).toLocaleDateString("en-IN")}\n\n`;
    buttons.push([{ text: `⚙️ Manage @${bot.bot_username || "bot"}`, callback_data: `mybot_manage_${bot.id}`, style: "primary" }]);
  }

  buttons.push([{ text: "➕ Create New Bot", callback_data: "mother_create_bot", style: "success" }]);
  buttons.push([{ text: "🏠 Main Menu", callback_data: "mother_main", style: "secondary" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function showEarnings(token: string, supabase: any, chatId: number, userId: number) {
  const { data: bots } = await supabase.from("child_bots").select("id, bot_username, total_earnings, total_orders, revenue_percent").eq("owner_telegram_id", userId);

  if (!bots?.length) {
    await sendMsg(token, chatId, "💰 No earnings yet. Create a bot to start earning!",
      { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main", style: "primary" }]] } });
    return;
  }

  let totalEarnings = 0;
  let totalOrders = 0;
  let text = "💰 <b>Your Earnings</b>\n\n";

  for (const bot of bots) {
    text += `🤖 @${bot.bot_username || "bot"} (${bot.revenue_percent}%)\n`;
    text += `   Orders: ${bot.total_orders} | Earned: ₹${bot.total_earnings}\n\n`;
    totalEarnings += bot.total_earnings;
    totalOrders += bot.total_orders;
  }

  text += `━━━━━━━━━━━━━\n`;
  text += `📊 <b>Total:</b> ${totalOrders} orders | ₹${totalEarnings} earned`;
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main", style: "secondary" }]] } });
}

export async function showBotManagement(token: string, supabase: any, chatId: number, userId: number, botId: string) {
  const { data: bot } = await supabase.from("child_bots").select("*").eq("id", botId).eq("owner_telegram_id", userId).single();
  if (!bot) {
    await sendMsg(token, chatId, "❌ Bot not found.", { reply_markup: { inline_keyboard: [[{ text: "🤖 My Bots", callback_data: "mother_my_bots", style: "primary" }]] } });
    return;
  }

  const { count: userCount } = await supabase.from("child_bot_users").select("id", { count: "exact", head: true }).eq("child_bot_id", botId);
  const status = bot.is_active ? "🟢 Active" : "🔴 Inactive";

  const text =
    `⚙️ <b>Manage: @${bot.bot_username}</b>\n\n` +
    `${status}\n💰 Revenue: ${bot.revenue_percent}%\n📦 Orders: ${bot.total_orders}\n💵 Earned: ₹${bot.total_earnings}\n👥 Users: ${userCount || 0}\n📅 Created: ${new Date(bot.created_at).toLocaleDateString("en-IN")}`;

  await sendMsg(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: bot.is_active ? "⏸ Deactivate" : "▶️ Activate", callback_data: `mybot_toggle_${botId}`, style: bot.is_active ? "danger" : "success" },
          { text: "📊 Stats", callback_data: `mybot_stats_${botId}`, style: "primary" },
        ],
        [{ text: "📝 Edit Revenue %", callback_data: `mybot_editrev_${botId}`, style: "primary" }],
        [{ text: "🗑 Delete Bot", callback_data: `mybot_delete_${botId}`, style: "danger" }],
        [{ text: "◀️ My Bots", callback_data: "mother_my_bots", style: "secondary" }],
      ],
    },
  });
}

export async function showAdminPanel(token: string, supabase: any, chatId: number) {
  const { data: bots } = await supabase.from("child_bots").select("id, is_active, total_orders, total_earnings");
  const { count: usersCount } = await supabase.from("mother_bot_users").select("id", { count: "exact", head: true });
  const botsList = bots || [];

  await sendMsg(token, chatId,
    `🛡 <b>Owner Admin Panel</b>\n\n🤖 Bots: ${botsList.length} (${botsList.filter((b: any) => b.is_active).length} active)\n👥 Users: ${usersCount || 0}\n📦 Orders: ${botsList.reduce((s: number, b: any) => s + b.total_orders, 0)}\n💰 Commissions: ₹${botsList.reduce((s: number, b: any) => s + b.total_earnings, 0)}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🤖 Manage Bots", callback_data: "mother_admin_bots", style: "primary" }],
          [{ text: "📢 Channels", callback_data: "mother_admin_channels", style: "primary" }, { text: "👥 Users", callback_data: "mother_admin_users", style: "primary" }],
          [{ text: "📊 Full Stats", callback_data: "mother_admin_stats", style: "success" }],
          [{ text: "🏠 Main Menu", callback_data: "mother_main", style: "danger" }],
        ],
      },
    }
  );
}

export async function showAdminBots(token: string, supabase: any, chatId: number) {
  const { data: bots } = await supabase.from("child_bots").select("*").order("created_at", { ascending: false });

  if (!bots?.length) {
    await sendMsg(token, chatId, "🤖 No child bots exist yet.",
      { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: "mother_admin", style: "secondary" }]] } });
    return;
  }

  let text = "🛡 <b>All Child Bots (Admin)</b>\n\n";
  const buttons: any[][] = [];

  for (const bot of bots) {
    const status = bot.is_active ? "🟢" : "🔴";
    text += `${status} @${bot.bot_username || "unknown"}\n   Owner: <code>${bot.owner_telegram_id}</code> | Rev: ${bot.revenue_percent}%\n   Orders: ${bot.total_orders} | Earned: ₹${bot.total_earnings}\n\n`;
    buttons.push([
      { text: `${bot.is_active ? "⏸" : "▶️"} @${bot.bot_username || "bot"}`, callback_data: `mother_toggle_${bot.id}`, style: bot.is_active ? "danger" : "success" },
      { text: `📊 Rev%`, callback_data: `mother_setrev_${bot.id}`, style: "primary" },
      { text: `🗑`, callback_data: `mother_delete_${bot.id}`, style: "danger" },
    ]);
  }

  buttons.push([{ text: "◀️ Back", callback_data: "mother_admin", style: "secondary" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function showChannelManager(token: string, supabase: any, chatId: number) {
  const channels = await getRequiredChannels(supabase);
  let text = "📢 <b>Required Channels</b>\n\n";
  const buttons: any[][] = [];

  if (channels.length === 0) {
    text += "No required channels set.\nUsers can access the bot without joining any channel.";
  } else {
    text += "Users must join these channels before using the bot:\n\n";
    channels.forEach((ch, i) => {
      text += `${i + 1}. ${ch}\n`;
      buttons.push([
        { text: `🔗 ${ch}`, url: `https://t.me/${ch.replace("@", "")}` },
        { text: `🗑 Remove`, callback_data: `mother_rmch_${i}`, style: "danger" },
      ]);
    });
  }

  buttons.push([{ text: "➕ Add Channel", callback_data: "mother_add_channel", style: "success" }]);
  buttons.push([{ text: "◀️ Back", callback_data: "mother_admin", style: "secondary" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function createChildBot(token: string, supabase: any, chatId: number, _creatorId: number, data: Record<string, any>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  const { data: newBot, error } = await supabase.from("child_bots").insert({
    bot_token: data.bot_token, bot_username: data.bot_username,
    owner_telegram_id: data.owner_telegram_id, revenue_percent: data.revenue_percent,
  }).select("id").single();

  if (error || !newBot) {
    await sendMsg(token, chatId, "❌ Failed to create bot. " + (error?.message || "Try again."));
    return;
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot?child=${newBot.id}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${data.bot_token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.error("setWebhook failed:", result);
      await sendMsg(token, chatId, "⚠️ Bot created but webhook setup failed. Contact support.");
      return;
    }
  } catch (e) {
    console.error("Webhook setup error:", e);
  }

  await sendMsg(token, chatId,
    `✅ <b>Bot Created Successfully!</b>\n\n🤖 Bot: @${data.bot_username}\n👤 Owner: <code>${data.owner_telegram_id}</code>\n💰 Revenue: ${data.revenue_percent}%\n\nYour bot is now live! Users can start using it at @${data.bot_username}.\nOrders will be processed by our main admin team.\n\n📎 Referral & resale links will use @${data.bot_username}.`,
    { reply_markup: { inline_keyboard: [[{ text: "🤖 My Bots", callback_data: "mother_my_bots", style: "primary" }], [{ text: "🏠 Main Menu", callback_data: "mother_main", style: "secondary" }]] } }
  );
}
