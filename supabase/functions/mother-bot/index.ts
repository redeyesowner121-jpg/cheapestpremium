// ===== MOTHER BOT - Multi-Bot Creation Platform =====
// Handles Mother Bot only. Child bots route through telegram-bot?child=<id>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

async function sendMsg(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  try {
    await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: opts?.parse_mode || "HTML", ...(opts?.reply_markup && { reply_markup: opts.reply_markup }) }),
    });
  } catch (e) { console.error("sendMsg error:", e); }
}

async function answerCb(token: string, cbId: string, text?: string) {
  await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId, text: text || "" }),
  }).catch(() => {});
}

async function getChatMemberStatus(token: string, chatId: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json();
    return data?.result?.status || "left";
  } catch { return "left"; }
}

async function validateBotToken(token: string): Promise<{ ok: boolean; username?: string; id?: number }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data?.ok && data.result) {
      return { ok: true, username: data.result.username, id: data.result.id };
    }
    return { ok: false };
  } catch { return { ok: false }; }
}

// ===== CONVERSATION STATE =====
async function getConvState(supabase: any, tgId: number) {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", tgId).single();
  return data ? { step: data.step, data: data.data || {} } : null;
}

async function setConvState(supabase: any, tgId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({ telegram_id: tgId, step, data: stateData, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
}

async function deleteConvState(supabase: any, tgId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", tgId);
}

// ===== MOTHER BOT OWNER =====
const MOTHER_OWNER_ID = 6898461453;

function isMotherOwner(userId: number): boolean {
  return userId === MOTHER_OWNER_ID;
}

// ===== Get admin telegram IDs =====
async function getAdminTelegramIds(supabase: any): Promise<number[]> {
  const SUPER_ADMIN_ID = 1667104164;
  const ids = [SUPER_ADMIN_ID, MOTHER_OWNER_ID];
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (data?.length) {
    for (const a of data) {
      if (!ids.includes(a.telegram_id)) ids.push(a.telegram_id);
    }
  }
  return ids;
}

async function notifyAdminsViaMainBot(mainToken: string, supabase: any, text: string, opts?: { reply_markup?: any }) {
  const adminIds = await getAdminTelegramIds(supabase);
  for (const adminId of adminIds) {
    try { await sendMsg(mainToken, adminId, text, opts); } catch { /* admin may have blocked bot */ }
  }
}

async function getRequiredChannels(supabase: any): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "mother_required_channels").maybeSingle();
  if (data?.value) {
    try { const ch = JSON.parse(data.value); if (Array.isArray(ch)) return ch; } catch {}
  }
  return [];
}

async function saveRequiredChannels(supabase: any, channels: string[]) {
  await supabase.from("app_settings").upsert(
    { key: "mother_required_channels", value: JSON.stringify(channels), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

async function upsertMotherUser(supabase: any, user: any) {
  await supabase.from("mother_bot_users").upsert({
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const MOTHER_TOKEN = Deno.env.get("MOTHER_BOT_TOKEN");
  if (!MOTHER_TOKEN) return new Response("MOTHER_BOT_TOKEN not set", { status: 500 });

  // Main Bot token for admin notifications
  const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || MOTHER_TOKEN;

  try {
    const update = await req.json();

    // ===== CALLBACK QUERIES =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      const userId = cq.from.id;
      await answerCb(MOTHER_TOKEN, cq.id);
      await upsertMotherUser(supabase, cq.from);

      if (data === "mother_create_bot") {
        await setConvState(supabase, userId, "mother_enter_token", {});
        await sendMsg(MOTHER_TOKEN, chatId,
          "🤖 <b>Create a New Bot</b>\n\n" +
          "Step 1/4: Send your <b>Bot API Token</b>\n\n" +
          "Get it from @BotFather → /newbot → copy the token.\n\n" +
          "Send /cancel to abort."
        );
        return jsonOk();
      }

      if (data === "mother_my_bots") {
        await showMyBots(MOTHER_TOKEN, supabase, chatId, userId);
        return jsonOk();
      }

      if (data === "mother_earnings") {
        await showEarnings(MOTHER_TOKEN, supabase, chatId, userId);
        return jsonOk();
      }

      if (data === "mother_help") {
        await sendMsg(MOTHER_TOKEN, chatId,
          "❓ <b>Help</b>\n\n" +
          "• <b>Create a Bot</b> — Create your own selling bot using our product catalog\n" +
          "• <b>My Bots</b> — View and manage your bots\n" +
          "• <b>Earnings</b> — Track your commissions\n\n" +
          "Your bot will sell products from our main store. When a customer orders through your bot, the order goes to our admin. After delivery, you earn your set commission percentage.\n\n" +
          "Max 3 bots per user. Commission: 1%-60% per sale.\n✅ Bot creation is <b>FREE!</b>\n\n" +
          "Your bot's referral & resale links will use your bot's @username.",
          { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
        );
        return jsonOk();
      }

      if (data === "mother_main") {
        await showMotherMenu(MOTHER_TOKEN, chatId);
        return jsonOk();
      }

      // ===== CONFIRM → Create bot directly (FREE) =====
      if (data === "mother_confirm_create") {
        const state = await getConvState(supabase, userId);
        if (state?.step === "mother_confirm" && state.data.bot_token) {
          await createChildBot(MOTHER_TOKEN, supabase, chatId, userId, state.data);
          await deleteConvState(supabase, userId);
          // Notify admins
          await notifyAdminsViaMainBot(MAIN_TOKEN, supabase,
            `🤖 <b>New Bot Created (Free)</b>\n\n👤 User: <code>${userId}</code>\n🤖 Bot: @${state.data.bot_username}\n📊 Revenue: ${state.data.revenue_percent}%`
          );
        }
        return jsonOk();
      }

      if (data === "mother_cancel_create") {
        await deleteConvState(supabase, userId);
        await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot creation cancelled.");
        await showMotherMenu(MOTHER_TOKEN, chatId);
        return jsonOk();
      }

      // Toggle child bot active/inactive (OWNER ONLY)
      if (data.startsWith("mother_toggle_")) {
        if (!isMotherOwner(userId)) {
          await sendMsg(MOTHER_TOKEN, chatId, "🔒 Only the owner can toggle bots.");
          return jsonOk();
        }
        const botId = data.replace("mother_toggle_", "");
        const { data: bot } = await supabase.from("child_bots").select("is_active, owner_telegram_id").eq("id", botId).single();
        if (bot) {
          await supabase.from("child_bots").update({ is_active: !bot.is_active }).eq("id", botId);
          await sendMsg(MOTHER_TOKEN, chatId, bot.is_active ? "⏸ Bot deactivated." : "▶️ Bot activated.");
        }
        await showAdminBots(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      // Delete child bot (OWNER ONLY)
      if (data.startsWith("mother_delete_")) {
        if (!isMotherOwner(userId)) return jsonOk();
        const botId = data.replace("mother_delete_", "");
        await supabase.from("child_bot_users").delete().eq("child_bot_id", botId);
        await supabase.from("child_bot_earnings").delete().eq("child_bot_id", botId);
        await supabase.from("child_bot_orders").delete().eq("child_bot_id", botId);
        await supabase.from("child_bots").delete().eq("id", botId);
        await sendMsg(MOTHER_TOKEN, chatId, "🗑 Bot deleted successfully.");
        await showAdminBots(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      // Change revenue % (OWNER ONLY)
      if (data.startsWith("mother_setrev_")) {
        if (!isMotherOwner(userId)) return jsonOk();
        const botId = data.replace("mother_setrev_", "");
        await setConvState(supabase, userId, "mother_admin_setrev", { bot_id: botId });
        await sendMsg(MOTHER_TOKEN, chatId, "📊 Enter new revenue percentage (1-60):");
        return jsonOk();
      }

      // Admin panel callbacks
      if (data === "mother_admin") {
        if (!isMotherOwner(userId)) {
          await sendMsg(MOTHER_TOKEN, chatId, "🔒 Owner only.");
          return jsonOk();
        }
        await showAdminPanel(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      // ===== CHANNEL MANAGEMENT =====
      if (data === "mother_admin_channels") {
        if (!isMotherOwner(userId)) return jsonOk();
        await showChannelManager(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      if (data === "mother_add_channel") {
        if (!isMotherOwner(userId)) return jsonOk();
        await setConvState(supabase, userId, "mother_add_channel", {});
        await sendMsg(MOTHER_TOKEN, chatId,
          "📢 <b>Add Channel</b>\n\n" +
          "Send the channel username (e.g. <code>@mychannel</code> or <code>mychannel</code>)\n\n" +
          "⚠️ Make sure the <b>main selling bot</b> is an admin in this channel.\n\n" +
          "Send /cancel to abort.",
          { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "mother_admin_channels", style: "danger" }]] } }
        );
        return jsonOk();
      }

      if (data.startsWith("mother_rmch_")) {
        if (!isMotherOwner(userId)) return jsonOk();
        const idx = parseInt(data.replace("mother_rmch_", ""));
        const channels = await getRequiredChannels(supabase);
        if (idx >= 0 && idx < channels.length) {
          const removed = channels.splice(idx, 1)[0];
          await saveRequiredChannels(supabase, channels);
          await sendMsg(MOTHER_TOKEN, chatId, `✅ Channel <b>${removed}</b> removed!`);
        }
        await showChannelManager(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      if (data === "mother_admin_bots") {
        if (!isMotherOwner(userId)) return jsonOk();
        await showAdminBots(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      if (data === "mother_admin_users") {
        if (!isMotherOwner(userId)) return jsonOk();
        const { count } = await supabase.from("mother_bot_users").select("id", { count: "exact", head: true });
        const { data: recent } = await supabase.from("mother_bot_users").select("*").order("last_active", { ascending: false }).limit(10);
        let text = `👥 <b>Mother Bot Users</b>\n\n📊 Total: ${count || 0}\n\n<b>Recent Active:</b>\n`;
        if (recent?.length) {
          for (const u of recent) {
            text += `• ${u.first_name || "Unknown"} ${u.username ? `(@${u.username})` : ""} — <code>${u.telegram_id}</code>\n`;
          }
        }
        await sendMsg(MOTHER_TOKEN, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: "mother_admin" }]] } });
        return jsonOk();
      }

      if (data === "mother_admin_stats") {
        if (!isMotherOwner(userId)) return jsonOk();
        const { data: bots } = await supabase.from("child_bots").select("*");
        const { count: usersCount } = await supabase.from("mother_bot_users").select("id", { count: "exact", head: true });
        const botsList = bots || [];
        const totalEarnings = botsList.reduce((s: number, b: any) => s + b.total_earnings, 0);
        const totalOrders = botsList.reduce((s: number, b: any) => s + b.total_orders, 0);
        await sendMsg(MOTHER_TOKEN, chatId,
          `📊 <b>Mother Bot Statistics</b>\n\n` +
          `🤖 Total Bots: ${botsList.length}\n` +
          `🟢 Active: ${botsList.filter((b: any) => b.is_active).length}\n` +
          `🔴 Inactive: ${botsList.filter((b: any) => !b.is_active).length}\n` +
          `👥 Total Users: ${usersCount || 0}\n` +
          `📦 Total Orders: ${totalOrders}\n` +
          `💰 Total Commissions: ₹${totalEarnings}`,
          { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: "mother_admin" }]] } }
        );
        return jsonOk();
      }

      // Verify join
      if (data === "mother_verify_join") {
        const channels = await getRequiredChannels(supabase);
        const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || MOTHER_TOKEN;
        const results = await Promise.all(channels.map(ch => getChatMemberStatus(mainToken, ch, userId)));
        const allJoined = results.every(s => ["member", "administrator", "creator"].includes(s));
        if (allJoined) {
          await showMotherMenu(MOTHER_TOKEN, chatId);
        } else {
          await sendMsg(MOTHER_TOKEN, chatId, "❌ You haven't joined all channels yet. Please join and try again.");
        }
        return jsonOk();
      }

      return jsonOk();
    }

    // ===== TEXT / PHOTO MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text || "";

      await upsertMotherUser(supabase, msg.from);

      // Handle commands — reset conversation
      if (text.startsWith("/")) {
        await deleteConvState(supabase, userId);
      } else {
        const state = await getConvState(supabase, userId);
        if (state) {
          await handleMotherConversation(MOTHER_TOKEN, MAIN_TOKEN, supabase, chatId, userId, text, msg, state);
          return jsonOk();
        }
      }

      const command = text.split(" ")[0].toLowerCase().split("@")[0];

      if (command === "/start") {
        const channels = await getRequiredChannels(supabase);
        if (channels.length > 0) {
          const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || MOTHER_TOKEN;
          const results = await Promise.all(channels.map(ch => getChatMemberStatus(mainToken, ch, userId)));
          const allJoined = results.every(s => ["member", "administrator", "creator"].includes(s));
          if (!allJoined) {
            const buttons: any[][] = channels.map(ch => {
              const name = ch.startsWith("@") ? ch : `@${ch}`;
              return [{ text: `Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }];
            });
            buttons.push([{ text: "✅ I've Joined - Verify", callback_data: "mother_verify_join" }]);
            await sendMsg(MOTHER_TOKEN, chatId, "🔒 <b>Please join our channels first!</b>", { reply_markup: { inline_keyboard: buttons } });
            return jsonOk();
          }
        }
        await showMotherMenu(MOTHER_TOKEN, chatId);
        return jsonOk();
      }

      if (command === "/menu") { await showMotherMenu(MOTHER_TOKEN, chatId); return jsonOk(); }
      if (command === "/cancel") { await sendMsg(MOTHER_TOKEN, chatId, "❌ Cancelled."); return jsonOk(); }

      if (command === "/admin") {
        if (!isMotherOwner(userId)) {
          await sendMsg(MOTHER_TOKEN, chatId, "🔒 This command is only for the owner.");
          return jsonOk();
        }
        await showAdminPanel(MOTHER_TOKEN, supabase, chatId);
        return jsonOk();
      }

      await showMotherMenu(MOTHER_TOKEN, chatId);
      return jsonOk();
    }

    return jsonOk();
  } catch (e) {
    console.error("Mother bot error:", e);
    return jsonOk();
  }
});

// ===== HELPERS =====

async function showMotherMenu(token: string, chatId: number) {
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

async function showMyBots(token: string, supabase: any, chatId: number, userId: number) {
  const { data: bots } = await supabase.from("child_bots").select("*").eq("owner_telegram_id", userId).order("created_at", { ascending: false });

  if (!bots?.length) {
    await sendMsg(token, chatId, "🤖 You haven't created any bots yet.\n\nTap <b>Create a Bot</b> to get started!",
      { reply_markup: { inline_keyboard: [[{ text: "➕ Create a Bot", callback_data: "mother_create_bot" }], [{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } });
    return;
  }

  let text = "🤖 <b>Your Bots</b>\n\n";
  const buttons: any[][] = [];

  for (const bot of bots) {
    const status = bot.is_active ? "🟢 Active" : "🔴 Inactive";
    // Count users for this bot
    const { count: botUsers } = await supabase.from("child_bot_users").select("id", { count: "exact", head: true }).eq("child_bot_id", bot.id);
    text += `🤖 <b>@${bot.bot_username || "unknown"}</b> — ${status}\n`;
    text += `   💰 Revenue: ${bot.revenue_percent}% | 📦 Orders: ${bot.total_orders}\n`;
    text += `   💵 Earned: ₹${bot.total_earnings} | 👥 Users: ${botUsers || 0}\n`;
    text += `   📅 Created: ${new Date(bot.created_at).toLocaleDateString("en-IN")}\n\n`;
    buttons.push([
      { text: `⚙️ Manage @${bot.bot_username || "bot"}`, callback_data: `mybot_manage_${bot.id}`, style: "primary" },
    ]);
  }

  buttons.push([{ text: "➕ Create New Bot", callback_data: "mother_create_bot", style: "success" }]);
  buttons.push([{ text: "🏠 Main Menu", callback_data: "mother_main" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function showEarnings(token: string, supabase: any, chatId: number, userId: number) {
  const { data: bots } = await supabase.from("child_bots").select("id, bot_username, total_earnings, total_orders, revenue_percent").eq("owner_telegram_id", userId);

  if (!bots?.length) {
    await sendMsg(token, chatId, "💰 No earnings yet. Create a bot to start earning!",
      { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } });
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

  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } });
}

async function handleMotherConversation(motherToken: string, mainToken: string, supabase: any, chatId: number, userId: number, text: string, msg: any, state: { step: string; data: Record<string, any> }) {
  if (text === "/cancel") {
    await deleteConvState(supabase, userId);
    await sendMsg(motherToken, chatId, "❌ Cancelled.");
    return;
  }

  // Step 1: Enter bot token
  if (state.step === "mother_enter_token") {
    const tokenVal = text.trim();
    const validation = await validateBotToken(tokenVal);
    if (!validation.ok) {
      await sendMsg(motherToken, chatId, "❌ Invalid bot token. Please send a valid Bot API token from @BotFather.\n\nSend /cancel to abort.");
      return;
    }

    const { data: existing } = await supabase.from("child_bots").select("id").eq("bot_token", tokenVal).maybeSingle();
    if (existing) {
      await sendMsg(motherToken, chatId, "❌ This bot token is already registered. Use a different bot.");
      return;
    }

    const { count } = await supabase.from("child_bots").select("id", { count: "exact", head: true }).eq("owner_telegram_id", userId);
    if ((count || 0) >= 3) {
      await sendMsg(motherToken, chatId, "❌ You can only create up to 3 bots. Deactivate or contact support.");
      await deleteConvState(supabase, userId);
      return;
    }

    await setConvState(supabase, userId, "mother_enter_username", { bot_token: tokenVal, bot_username: validation.username, bot_id: validation.id });
    await sendMsg(motherToken, chatId,
      `✅ Bot verified: @${validation.username}\n\n` +
      `Step 2/4: Enter the <b>Bot Username</b> (without @)\n\n` +
      `This will be used for referral & resale links.\n` +
      `Detected: <code>${validation.username}</code>\n\n` +
      `Send the username or just send <code>${validation.username}</code> to confirm.`
    );
    return;
  }

  // Step 2: Enter bot username
  if (state.step === "mother_enter_username") {
    const username = text.trim().replace(/^@/, "");
    if (!username || username.length < 3) {
      await sendMsg(motherToken, chatId, "❌ Invalid username. Please enter a valid bot username (min 3 characters).");
      return;
    }
    await setConvState(supabase, userId, "mother_enter_owner", { ...state.data, bot_username: username });
    await sendMsg(motherToken, chatId,
      `✅ Username: @${username}\n\n` +
      `Step 3/4: Enter the <b>Owner Telegram ID</b>\n\n` +
      `This is the person who will manage this bot.\nSend your own ID (<code>${userId}</code>) to be the owner yourself.`
    );
    return;
  }

  // Step 3: Enter owner ID
  if (state.step === "mother_enter_owner") {
    const ownerId = parseInt(text.trim());
    if (isNaN(ownerId) || ownerId <= 0) {
      await sendMsg(motherToken, chatId, "❌ Invalid Telegram ID. Please send a numeric ID.");
      return;
    }
    await setConvState(supabase, userId, "mother_enter_percent", { ...state.data, owner_telegram_id: ownerId });
    await sendMsg(motherToken, chatId,
      `Step 4/4: Enter your <b>Revenue Percentage</b> (1% – 60%)\n\n` +
      `This is the commission you'll earn per sale through your bot.\n` +
      `Price shown to users = Reseller Price + Your %`
    );
    return;
  }

  // Step 4: Enter revenue percentage → Show confirmation
  if (state.step === "mother_enter_percent") {
    const percent = parseFloat(text.trim());
    if (isNaN(percent) || percent < 1 || percent > 60) {
      await sendMsg(motherToken, chatId, "❌ Invalid percentage. Enter a number between 1 and 60.");
      return;
    }

    await setConvState(supabase, userId, "mother_confirm", { ...state.data, revenue_percent: percent });
    await sendMsg(motherToken, chatId,
      `📋 <b>Confirm Bot Creation</b>\n\n` +
      `🤖 Bot: @${state.data.bot_username}\n` +
      `👤 Owner ID: <code>${state.data.owner_telegram_id}</code>\n` +
      `💰 Revenue: ${percent}% per sale\n` +
      `📎 Referral/Resale links will use: @${state.data.bot_username}\n\n` +
      `✅ <b>FREE — No payment required!</b>\n\n` +
      `Confirm?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm", callback_data: "mother_confirm_create" }],
            [{ text: "❌ Cancel", callback_data: "mother_cancel_create" }],
          ],
        },
      }
    );
    return;
  }

  // Admin: Set revenue percentage
  if (state.step === "mother_admin_setrev") {
    if (!isMotherOwner(userId)) return;
    const percent = parseFloat(text.trim());
    if (isNaN(percent) || percent < 1 || percent > 60) {
      await sendMsg(motherToken, chatId, "❌ Enter a number between 1 and 60.");
      return;
    }
    await supabase.from("child_bots").update({ revenue_percent: percent }).eq("id", state.data.bot_id);
    await deleteConvState(supabase, userId);
    await sendMsg(motherToken, chatId, `✅ Revenue updated to ${percent}%`);
    await showAdminBots(motherToken, supabase, chatId);
    return;
  }

  // Admin: Add channel
  if (state.step === "mother_add_channel") {
    if (!isMotherOwner(userId)) return;
    const channelInput = text.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
    if (!channelInput || channelInput.length < 3) {
      await sendMsg(motherToken, chatId, "❌ Invalid channel username. Try again or send /cancel.");
      return;
    }
    const channels = await getRequiredChannels(supabase);
    const channelName = channelInput.startsWith("@") ? channelInput : `@${channelInput}`;
    if (channels.includes(channelName)) {
      await sendMsg(motherToken, chatId, `⚠️ Channel ${channelName} is already in the list.`);
      await deleteConvState(supabase, userId);
      await showChannelManager(motherToken, supabase, chatId);
      return;
    }
    channels.push(channelName);
    await saveRequiredChannels(supabase, channels);
    await deleteConvState(supabase, userId);
    await sendMsg(motherToken, chatId, `✅ Channel <b>${channelName}</b> added successfully!`);
    await showChannelManager(motherToken, supabase, chatId);
    return;
  }
}

async function createChildBot(token: string, supabase: any, chatId: number, creatorId: number, data: Record<string, any>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  const { data: newBot, error } = await supabase.from("child_bots").insert({
    bot_token: data.bot_token,
    bot_username: data.bot_username,
    owner_telegram_id: data.owner_telegram_id,
    revenue_percent: data.revenue_percent,
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
    `✅ <b>Bot Created Successfully!</b>\n\n` +
    `🤖 Bot: @${data.bot_username}\n` +
    `👤 Owner: <code>${data.owner_telegram_id}</code>\n` +
    `💰 Revenue: ${data.revenue_percent}%\n\n` +
    `Your bot is now live! Users can start using it at @${data.bot_username}.\n` +
    `Orders will be processed by our main admin team.\n\n` +
    `📎 Referral & resale links will use @${data.bot_username}.`,
    { reply_markup: { inline_keyboard: [[{ text: "🤖 My Bots", callback_data: "mother_my_bots" }], [{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
  );
}

// ===== ADMIN PANEL (OWNER ONLY) =====

async function showAdminPanel(token: string, supabase: any, chatId: number) {
  const { data: bots } = await supabase.from("child_bots").select("id, is_active, total_orders, total_earnings");
  const { count: usersCount } = await supabase.from("mother_bot_users").select("id", { count: "exact", head: true });
  const botsList = bots || [];

  await sendMsg(token, chatId,
    `🛡 <b>Owner Admin Panel</b>\n\n` +
    `🤖 Bots: ${botsList.length} (${botsList.filter((b: any) => b.is_active).length} active)\n` +
    `👥 Users: ${usersCount || 0}\n` +
    `📦 Orders: ${botsList.reduce((s: number, b: any) => s + b.total_orders, 0)}\n` +
    `💰 Commissions: ₹${botsList.reduce((s: number, b: any) => s + b.total_earnings, 0)}`,
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

async function showAdminBots(token: string, supabase: any, chatId: number) {
  const { data: bots } = await supabase.from("child_bots").select("*").order("created_at", { ascending: false });

  if (!bots?.length) {
    await sendMsg(token, chatId, "🤖 No child bots exist yet.",
      { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: "mother_admin" }]] } });
    return;
  }

  let text = "🛡 <b>All Child Bots (Admin)</b>\n\n";
  const buttons: any[][] = [];

  for (const bot of bots) {
    const status = bot.is_active ? "🟢" : "🔴";
    text += `${status} @${bot.bot_username || "unknown"}\n`;
    text += `   Owner: <code>${bot.owner_telegram_id}</code> | Rev: ${bot.revenue_percent}%\n`;
    text += `   Orders: ${bot.total_orders} | Earned: ₹${bot.total_earnings}\n\n`;
    buttons.push([
      { text: `${bot.is_active ? "⏸" : "▶️"} @${bot.bot_username || "bot"}`, callback_data: `mother_toggle_${bot.id}` },
      { text: `📊 Rev%`, callback_data: `mother_setrev_${bot.id}` },
      { text: `🗑`, callback_data: `mother_delete_${bot.id}`, style: "danger" },
    ]);
  }

  buttons.push([{ text: "◀️ Back", callback_data: "mother_admin" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function showChannelManager(token: string, supabase: any, chatId: number) {
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
  buttons.push([{ text: "◀️ Back", callback_data: "mother_admin" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}
