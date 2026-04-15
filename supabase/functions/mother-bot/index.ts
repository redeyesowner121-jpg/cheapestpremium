// ===== MOTHER BOT - Multi-Bot Creation Platform =====
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMsg, answerCb, getChatMemberStatus, getConvState, setConvState, deleteConvState, isMotherOwner, notifyAdminsViaMainBot, getRequiredChannels, upsertMotherUser } from "./helpers.ts";
import { showMotherMenu, showMyBots, showEarnings, showBotManagement, showAdminPanel, showAdminBots, showChannelManager, createChildBot } from "./menus.ts";
import { handleMotherConversation } from "./conversations.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const MOTHER_TOKEN = Deno.env.get("MOTHER_BOT_TOKEN");
  if (!MOTHER_TOKEN) return new Response("MOTHER_BOT_TOKEN not set", { status: 500 });
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

      if (data === "mother_create_bot") { await setConvState(supabase, userId, "mother_enter_token", {}); await sendMsg(MOTHER_TOKEN, chatId, "🤖 <b>Create a New Bot</b>\n\nStep 1/4: Send your <b>Bot API Token</b>\n\nGet it from @BotFather → /newbot → copy the token.\n\nSend /cancel to abort."); return jsonOk(); }
      if (data === "mother_my_bots") { await showMyBots(MOTHER_TOKEN, supabase, chatId, userId); return jsonOk(); }
      if (data.startsWith("mybot_manage_")) { await showBotManagement(MOTHER_TOKEN, supabase, chatId, userId, data.replace("mybot_manage_", "")); return jsonOk(); }

      if (data.startsWith("mybot_stats_")) {
        const botId = data.replace("mybot_stats_", "");
        const { data: bot } = await supabase.from("child_bots").select("*").eq("id", botId).eq("owner_telegram_id", userId).single();
        if (!bot) { await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot not found."); return jsonOk(); }
        const { count: userCount } = await supabase.from("child_bot_users").select("id", { count: "exact", head: true }).eq("child_bot_id", botId);
        const { data: recentOrders } = await supabase.from("child_bot_orders").select("product_name, total_price, owner_commission, status, created_at").eq("child_bot_id", botId).order("created_at", { ascending: false }).limit(5);
        let text = `📊 <b>Stats: @${bot.bot_username}</b>\n\n📦 Total Orders: ${bot.total_orders}\n💵 Total Earned: ₹${bot.total_earnings}\n👥 Bot Users: ${userCount || 0}\n💰 Revenue: ${bot.revenue_percent}%\n${bot.is_active ? "🟢 Active" : "🔴 Inactive"}\n`;
        if (recentOrders?.length) { text += `\n<b>Recent Orders:</b>\n`; for (const o of recentOrders) { text += `${o.status === "confirmed" ? "✅" : o.status === "pending" ? "⏳" : "❌"} ${o.product_name} — ₹${o.total_price} (Your: ₹${o.owner_commission})\n`; } }
        await sendMsg(MOTHER_TOKEN, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: `mybot_manage_${botId}` }]] } });
        return jsonOk();
      }

      if (data.startsWith("mybot_toggle_")) { const botId = data.replace("mybot_toggle_", ""); const { data: bot } = await supabase.from("child_bots").select("is_active, owner_telegram_id").eq("id", botId).eq("owner_telegram_id", userId).single(); if (bot) { await supabase.from("child_bots").update({ is_active: !bot.is_active }).eq("id", botId); await sendMsg(MOTHER_TOKEN, chatId, bot.is_active ? "⏸ Bot deactivated." : "▶️ Bot activated."); await showBotManagement(MOTHER_TOKEN, supabase, chatId, userId, botId); } else { await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot not found."); } return jsonOk(); }
      if (data.startsWith("mybot_editrev_")) { const botId = data.replace("mybot_editrev_", ""); const { data: bot } = await supabase.from("child_bots").select("id, owner_telegram_id, bot_username, revenue_percent").eq("id", botId).eq("owner_telegram_id", userId).single(); if (!bot) { await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot not found."); return jsonOk(); } await setConvState(supabase, userId, "mybot_setrev", { bot_id: botId, bot_username: bot.bot_username }); await sendMsg(MOTHER_TOKEN, chatId, `📊 <b>Edit Revenue — @${bot.bot_username}</b>\n\nCurrent: ${bot.revenue_percent}%\n\nEnter new percentage (1-60):\n\nSend /cancel to abort.`); return jsonOk(); }

      if (data.startsWith("mybot_confirmdelete_")) {
        const botId = data.replace("mybot_confirmdelete_", "");
        const { data: bot } = await supabase.from("child_bots").select("id, bot_token, bot_username, owner_telegram_id").eq("id", botId).eq("owner_telegram_id", userId).single();
        if (!bot) { await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot not found."); return jsonOk(); }
        try { await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`); } catch {}
        await supabase.from("child_bot_users").delete().eq("child_bot_id", botId);
        await supabase.from("child_bot_earnings").delete().eq("child_bot_id", botId);
        await supabase.from("child_bot_orders").delete().eq("child_bot_id", botId);
        await supabase.from("child_bots").delete().eq("id", botId);
        await sendMsg(MOTHER_TOKEN, chatId, `🗑 Bot @${bot.bot_username} has been deleted.`);
        await showMyBots(MOTHER_TOKEN, supabase, chatId, userId);
        return jsonOk();
      }

      if (data.startsWith("mybot_delete_")) { const botId = data.replace("mybot_delete_", ""); const { data: bot } = await supabase.from("child_bots").select("bot_username, owner_telegram_id").eq("id", botId).eq("owner_telegram_id", userId).single(); if (!bot) { await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot not found."); return jsonOk(); } await sendMsg(MOTHER_TOKEN, chatId, `⚠️ <b>Delete @${bot.bot_username}?</b>\n\nThis will permanently remove the bot, all its users, orders, and earnings data.\n\n<b>This action cannot be undone!</b>`, { reply_markup: { inline_keyboard: [[{ text: "🗑 Yes, Delete", callback_data: `mybot_confirmdelete_${botId}`, style: "danger" }], [{ text: "❌ Cancel", callback_data: `mybot_manage_${botId}` }]] } }); return jsonOk(); }
      if (data === "mother_earnings") { await showEarnings(MOTHER_TOKEN, supabase, chatId, userId); return jsonOk(); }
      if (data === "mother_help") { await sendMsg(MOTHER_TOKEN, chatId, "❓ <b>Help</b>\n\n• <b>Create a Bot</b> — Create your own selling bot using our product catalog\n• <b>My Bots</b> — View and manage your bots\n• <b>Earnings</b> — Track your commissions\n\nYour bot will sell products from our main store. When a customer orders through your bot, the order goes to our admin. After delivery, you earn your set commission percentage.\n\nMax 3 bots per user. Commission: 1%-60% per sale.\n✅ Bot creation is <b>FREE!</b>\n\nYour bot's referral & resale links will use your bot's @username.", { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }); return jsonOk(); }
      if (data === "mother_main") { await showMotherMenu(MOTHER_TOKEN, chatId); return jsonOk(); }

      if (data === "mother_confirm_create") { const state = await getConvState(supabase, userId); if (state?.step === "mother_confirm" && state.data.bot_token) { await createChildBot(MOTHER_TOKEN, supabase, chatId, userId, state.data); await deleteConvState(supabase, userId); await notifyAdminsViaMainBot(MAIN_TOKEN, supabase, `🤖 <b>New Bot Created (Free)</b>\n\n👤 User: <code>${userId}</code>\n🤖 Bot: @${state.data.bot_username}\n📊 Revenue: ${state.data.revenue_percent}%`); } return jsonOk(); }
      if (data === "mother_cancel_create") { await deleteConvState(supabase, userId); await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot creation cancelled."); await showMotherMenu(MOTHER_TOKEN, chatId); return jsonOk(); }

      // Owner-only admin callbacks
      if (data.startsWith("mother_toggle_")) { if (!isMotherOwner(userId)) { await sendMsg(MOTHER_TOKEN, chatId, "🔒 Only the owner can toggle bots."); return jsonOk(); } const botId = data.replace("mother_toggle_", ""); const { data: bot } = await supabase.from("child_bots").select("is_active").eq("id", botId).single(); if (bot) { await supabase.from("child_bots").update({ is_active: !bot.is_active }).eq("id", botId); await sendMsg(MOTHER_TOKEN, chatId, bot.is_active ? "⏸ Bot deactivated." : "▶️ Bot activated."); } await showAdminBots(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      if (data.startsWith("mother_delete_")) { if (!isMotherOwner(userId)) return jsonOk(); const botId = data.replace("mother_delete_", ""); await supabase.from("child_bot_users").delete().eq("child_bot_id", botId); await supabase.from("child_bot_earnings").delete().eq("child_bot_id", botId); await supabase.from("child_bot_orders").delete().eq("child_bot_id", botId); await supabase.from("child_bots").delete().eq("id", botId); await sendMsg(MOTHER_TOKEN, chatId, "🗑 Bot deleted successfully."); await showAdminBots(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      if (data.startsWith("mother_setrev_")) { if (!isMotherOwner(userId)) return jsonOk(); await setConvState(supabase, userId, "mother_admin_setrev", { bot_id: data.replace("mother_setrev_", "") }); await sendMsg(MOTHER_TOKEN, chatId, "📊 Enter new revenue percentage (1-60):"); return jsonOk(); }
      if (data === "mother_admin") { if (!isMotherOwner(userId)) { await sendMsg(MOTHER_TOKEN, chatId, "🔒 Owner only."); return jsonOk(); } await showAdminPanel(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      if (data === "mother_admin_channels") { if (!isMotherOwner(userId)) return jsonOk(); await showChannelManager(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      if (data === "mother_add_channel") { if (!isMotherOwner(userId)) return jsonOk(); await setConvState(supabase, userId, "mother_add_channel", {}); await sendMsg(MOTHER_TOKEN, chatId, "📢 <b>Add Channel</b>\n\nSend the channel username (e.g. <code>@mychannel</code>)\n\n⚠️ Make sure the <b>main selling bot</b> is an admin in this channel.\n\nSend /cancel to abort.", { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "mother_admin_channels", style: "danger" }]] } }); return jsonOk(); }
      if (data.startsWith("mother_rmch_")) { if (!isMotherOwner(userId)) return jsonOk(); const idx = parseInt(data.replace("mother_rmch_", "")); const channels = await getRequiredChannels(supabase); if (idx >= 0 && idx < channels.length) { const removed = channels.splice(idx, 1)[0]; const { saveRequiredChannels } = await import("./helpers.ts"); await saveRequiredChannels(supabase, channels); await sendMsg(MOTHER_TOKEN, chatId, `✅ Channel <b>${removed}</b> removed!`); } await showChannelManager(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      if (data === "mother_admin_bots") { if (!isMotherOwner(userId)) return jsonOk(); await showAdminBots(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      if (data === "mother_admin_users") { if (!isMotherOwner(userId)) return jsonOk(); const { count } = await supabase.from("mother_bot_users").select("id", { count: "exact", head: true }); const { data: recent } = await supabase.from("mother_bot_users").select("*").order("last_active", { ascending: false }).limit(10); let text = `👥 <b>Mother Bot Users</b>\n\n📊 Total: ${count || 0}\n\n<b>Recent Active:</b>\n`; if (recent?.length) { for (const u of recent) { text += `• ${u.first_name || "Unknown"} ${u.username ? `(@${u.username})` : ""} — <code>${u.telegram_id}</code>\n`; } } await sendMsg(MOTHER_TOKEN, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: "mother_admin" }]] } }); return jsonOk(); }
      if (data === "mother_admin_stats") { if (!isMotherOwner(userId)) return jsonOk(); const { data: bots } = await supabase.from("child_bots").select("*"); const { count: usersCount } = await supabase.from("mother_bot_users").select("id", { count: "exact", head: true }); const botsList = bots || []; await sendMsg(MOTHER_TOKEN, chatId, `📊 <b>Mother Bot Statistics</b>\n\n🤖 Total Bots: ${botsList.length}\n🟢 Active: ${botsList.filter((b: any) => b.is_active).length}\n🔴 Inactive: ${botsList.filter((b: any) => !b.is_active).length}\n👥 Total Users: ${usersCount || 0}\n📦 Total Orders: ${botsList.reduce((s: number, b: any) => s + b.total_orders, 0)}\n💰 Total Commissions: ₹${botsList.reduce((s: number, b: any) => s + b.total_earnings, 0)}`, { reply_markup: { inline_keyboard: [[{ text: "◀️ Back", callback_data: "mother_admin" }]] } }); return jsonOk(); }
      if (data === "mother_verify_join") { const channels = await getRequiredChannels(supabase); const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || MOTHER_TOKEN; const results = await Promise.all(channels.map(ch => getChatMemberStatus(mainToken, ch, userId))); if (results.every(s => ["member", "administrator", "creator"].includes(s))) { await showMotherMenu(MOTHER_TOKEN, chatId); } else { await sendMsg(MOTHER_TOKEN, chatId, "❌ You haven't joined all channels yet. Please join and try again."); } return jsonOk(); }

      return jsonOk();
    }

    // ===== TEXT MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text || "";
      await upsertMotherUser(supabase, msg.from);

      if (text.startsWith("/")) { await deleteConvState(supabase, userId); } else {
        const state = await getConvState(supabase, userId);
        if (state) { await handleMotherConversation(MOTHER_TOKEN, MAIN_TOKEN, supabase, chatId, userId, text, msg, state); return jsonOk(); }
      }

      const command = text.split(" ")[0].toLowerCase().split("@")[0];
      if (command === "/start") {
        const channels = await getRequiredChannels(supabase);
        if (channels.length > 0) {
          const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || MOTHER_TOKEN;
          const results = await Promise.all(channels.map(ch => getChatMemberStatus(mainToken, ch, userId)));
          if (!results.every(s => ["member", "administrator", "creator"].includes(s))) {
            const buttons: any[][] = channels.map(ch => { const name = ch.startsWith("@") ? ch : `@${ch}`; return [{ text: `Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }]; });
            buttons.push([{ text: "✅ I've Joined - Verify", callback_data: "mother_verify_join" }]);
            await sendMsg(MOTHER_TOKEN, chatId, "🔒 <b>Please join our channels first!</b>", { reply_markup: { inline_keyboard: buttons } });
            return jsonOk();
          }
        }
        await showMotherMenu(MOTHER_TOKEN, chatId); return jsonOk();
      }
      if (command === "/menu") { await showMotherMenu(MOTHER_TOKEN, chatId); return jsonOk(); }
      if (command === "/cancel") { await sendMsg(MOTHER_TOKEN, chatId, "❌ Cancelled."); return jsonOk(); }
      if (command === "/admin") { if (!isMotherOwner(userId)) { await sendMsg(MOTHER_TOKEN, chatId, "🔒 This command is only for the owner."); return jsonOk(); } await showAdminPanel(MOTHER_TOKEN, supabase, chatId); return jsonOk(); }
      await showMotherMenu(MOTHER_TOKEN, chatId);
      return jsonOk();
    }

    return jsonOk();
  } catch (e) {
    console.error("Mother bot error:", e);
    return jsonOk();
  }
});
