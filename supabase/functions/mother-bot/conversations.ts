// ===== MOTHER BOT CONVERSATION HANDLERS =====

import { sendMsg, setConvState, deleteConvState, validateBotToken, isMotherOwner, getRequiredChannels, saveRequiredChannels } from "./helpers.ts";
import { showBotManagement, showAdminBots, showChannelManager } from "./menus.ts";

export async function handleMotherConversation(
  motherToken: string, _mainToken: string, supabase: any,
  chatId: number, userId: number, text: string, _msg: any,
  state: { step: string; data: Record<string, any> }
) {
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
      `✅ Bot verified: @${validation.username}\n\nStep 2/4: Enter the <b>Bot Username</b> (without @)\n\nThis will be used for referral & resale links.\nDetected: <code>${validation.username}</code>\n\nSend the username or just send <code>${validation.username}</code> to confirm.`
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
      `✅ Username: @${username}\n\nStep 3/4: Enter the <b>Owner Telegram ID</b>\n\nThis is the person who will manage this bot.\nSend your own ID (<code>${userId}</code>) to be the owner yourself.`
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
      `Step 4/4: Enter your <b>Revenue Percentage</b> (1% – 60%)\n\nThis is the commission you'll earn per sale through your bot.\nPrice shown to users = Reseller Price + Your %`
    );
    return;
  }

  // Step 4: Enter revenue percentage → Ask for note
  if (state.step === "mother_enter_percent") {
    const percent = parseFloat(text.trim());
    if (isNaN(percent) || percent < 1 || percent > 60) {
      await sendMsg(motherToken, chatId, "❌ Invalid percentage. Enter a number between 1 and 60.");
      return;
    }

    await setConvState(supabase, userId, "mother_enter_note", { ...state.data, revenue_percent: percent });
    await sendMsg(motherToken, chatId,
      `✅ Revenue: ${percent}%\n\nStep 5/5: ✍️ <b>Write a short note for the admin</b>\n\nTell the admin why you want to create this bot, what you'll sell, or anything else they should know.\n\nSend the note as a single message (or send <code>skip</code> to leave it blank).\n\nSend /cancel to abort.`
    );
    return;
  }

  // Step 5: Enter note → Show confirmation
  if (state.step === "mother_enter_note") {
    const raw = text.trim();
    const note = raw.toLowerCase() === "skip" ? "" : raw.slice(0, 1000);

    await setConvState(supabase, userId, "mother_confirm", { ...state.data, admin_note: note });
    await sendMsg(motherToken, chatId,
      `📋 <b>Confirm Bot Creation Request</b>\n\n🤖 Bot: @${state.data.bot_username}\n👤 Owner ID: <code>${state.data.owner_telegram_id}</code>\n💰 Revenue: ${state.data.revenue_percent}% per sale\n📎 Referral/Resale links will use: @${state.data.bot_username}\n📝 Note: ${note ? note : "<i>(none)</i>"}\n\n✅ <b>FREE — No payment required!</b>\n\nYour request (with this note) will be sent to the admin.\n\nConfirm?`,
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

  // Owner: Edit own bot revenue
  if (state.step === "mybot_setrev") {
    const percent = parseFloat(text.trim());
    if (isNaN(percent) || percent < 1 || percent > 60) {
      await sendMsg(motherToken, chatId, "❌ Enter a number between 1 and 60.");
      return;
    }
    const botId = state.data.bot_id;
    const { data: bot } = await supabase.from("child_bots").select("id").eq("id", botId).eq("owner_telegram_id", userId).single();
    if (!bot) {
      await deleteConvState(supabase, userId);
      await sendMsg(motherToken, chatId, "❌ Bot not found.");
      return;
    }
    await supabase.from("child_bots").update({ revenue_percent: percent }).eq("id", botId);
    await deleteConvState(supabase, userId);
    await sendMsg(motherToken, chatId, `✅ Revenue for @${state.data.bot_username || "bot"} updated to ${percent}%`);
    await showBotManagement(motherToken, supabase, chatId, userId, botId);
    return;
  }

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
