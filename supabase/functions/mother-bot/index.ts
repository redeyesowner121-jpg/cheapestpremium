// ===== MOTHER BOT - Multi-Bot Creation Platform =====
// Handles Mother Bot only. Child bots route through telegram-bot?child=<id>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATION_FEE = 49; // INR

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

async function forwardMessage(token: string, chatId: number, fromChatId: number, messageId: number) {
  try {
    await fetch(`${TELEGRAM_API(token)}/forwardMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, from_chat_id: fromChatId, message_id: messageId }),
    });
  } catch (e) { console.error("forwardMessage error:", e); }
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

// ===== Get admin telegram IDs =====
async function getAdminTelegramIds(supabase: any): Promise<number[]> {
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  return (data || []).map((a: any) => a.telegram_id);
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const MOTHER_TOKEN = Deno.env.get("MOTHER_BOT_TOKEN");
  if (!MOTHER_TOKEN) return new Response("MOTHER_BOT_TOKEN not set", { status: 500 });

  try {
    const update = await req.json();

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
          `⚠️ <b>Creation Fee: ₹${CREATION_FEE}</b>\n\n` +
          "Step 1/5: Send your <b>Bot API Token</b>\n\n" +
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
          `Max 3 bots per user. Commission: 1%-60% per sale.\nCreation Fee: ₹${CREATION_FEE} per bot.\n\n` +
          "Your bot's referral & resale links will use your bot's @username.",
          { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
        );
        return jsonOk();
      }

      if (data === "mother_main") {
        await showMotherMenu(MOTHER_TOKEN, chatId);
        return jsonOk();
      }

      // Confirm create bot → now ask for payment
      if (data === "mother_confirm_create") {
        const state = await getConvState(supabase, userId);
        if (state?.step === "mother_confirm" && state.data.bot_token) {
          // Get UPI ID from app_settings
          const upiId = await getUpiId(supabase);
          await setConvState(supabase, userId, "mother_awaiting_payment", state.data);
          await sendMsg(MOTHER_TOKEN, chatId,
            `💳 <b>Payment Required: ₹${CREATION_FEE}</b>\n\n` +
            `Please pay <b>₹${CREATION_FEE}</b> to proceed with bot creation.\n\n` +
            (upiId ? `📱 <b>UPI ID:</b> <code>${upiId}</code>\n\n` : "") +
            `After payment, <b>send the payment screenshot</b> here.\n\n` +
            `⏳ Your bot will be activated after admin verifies the payment.\n\n` +
            `Send /cancel to abort.`
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

      // Admin approves payment → create bot
      if (data.startsWith("mother_approve_pay_")) {
        const creatorTgId = parseInt(data.replace("mother_approve_pay_", ""));
        const state = await getConvState(supabase, creatorTgId);
        if (state?.step === "mother_awaiting_payment" && state.data.bot_token) {
          await createChildBot(MOTHER_TOKEN, supabase, creatorTgId, creatorTgId, state.data);
          await deleteConvState(supabase, creatorTgId);
          // Notify admin
          await sendMsg(MOTHER_TOKEN, chatId, `✅ Payment approved. Bot @${state.data.bot_username} created for user ${creatorTgId}.`);
        } else {
          await sendMsg(MOTHER_TOKEN, chatId, "⚠️ No pending bot creation found for this user.");
        }
        return jsonOk();
      }

      // Admin rejects payment
      if (data.startsWith("mother_reject_pay_")) {
        const creatorTgId = parseInt(data.replace("mother_reject_pay_", ""));
        await deleteConvState(supabase, creatorTgId);
        await sendMsg(MOTHER_TOKEN, chatId, `❌ Payment rejected for user ${creatorTgId}.`);
        // Notify user
        await sendMsg(MOTHER_TOKEN, creatorTgId,
          "❌ <b>Payment Rejected</b>\n\nYour bot creation payment was not approved. Please try again with a valid payment.",
          { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
        );
        return jsonOk();
      }

      // Toggle child bot active/inactive
      if (data.startsWith("mother_toggle_")) {
        const botId = data.replace("mother_toggle_", "");
        const { data: bot } = await supabase.from("child_bots").select("is_active, owner_telegram_id").eq("id", botId).single();
        if (bot && bot.owner_telegram_id === userId) {
          await supabase.from("child_bots").update({ is_active: !bot.is_active }).eq("id", botId);
          await sendMsg(MOTHER_TOKEN, chatId, bot.is_active ? "⏸ Bot deactivated." : "▶️ Bot activated.");
        }
        await showMyBots(MOTHER_TOKEN, supabase, chatId, userId);
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

      // Handle photo messages (payment screenshot)
      if (msg.photo) {
        const state = await getConvState(supabase, userId);
        if (state?.step === "mother_awaiting_payment") {
          // Forward screenshot to all admins
          const adminIds = await getAdminTelegramIds(supabase);
          const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || String(userId);
          
          for (const adminId of adminIds) {
            await forwardMessage(MOTHER_TOKEN, adminId, chatId, msg.message_id);
            await sendMsg(MOTHER_TOKEN, adminId,
              `💳 <b>Bot Creation Payment</b>\n\n` +
              `👤 User: ${username} (<code>${userId}</code>)\n` +
              `💰 Amount: ₹${CREATION_FEE}\n` +
              `🤖 Bot: @${state.data.bot_username}\n` +
              `📊 Revenue: ${state.data.revenue_percent}%`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "✅ Approve", callback_data: `mother_approve_pay_${userId}` }],
                    [{ text: "❌ Reject", callback_data: `mother_reject_pay_${userId}` }],
                  ],
                },
              }
            );
          }

          await sendMsg(MOTHER_TOKEN, chatId,
            "✅ <b>Payment screenshot received!</b>\n\n" +
            "⏳ Please wait while our admin verifies your payment.\n" +
            "You'll be notified once your bot is activated.",
            { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
          );
          return jsonOk();
        }
      }

      // Handle commands — reset conversation
      if (text.startsWith("/")) {
        await deleteConvState(supabase, userId);
      } else {
        const state = await getConvState(supabase, userId);
        if (state) {
          await handleMotherConversation(MOTHER_TOKEN, supabase, chatId, userId, text, state);
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

      if (command === "/menu") {
        await showMotherMenu(MOTHER_TOKEN, chatId);
        return jsonOk();
      }

      if (command === "/cancel") {
        await sendMsg(MOTHER_TOKEN, chatId, "❌ Cancelled.");
        return jsonOk();
      }

      // If awaiting payment and user sends text instead of photo
      const state = await getConvState(supabase, userId);
      if (state?.step === "mother_awaiting_payment") {
        await sendMsg(MOTHER_TOKEN, chatId, "📸 Please send a <b>payment screenshot</b> (photo), not text.\n\nSend /cancel to abort.");
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

async function getUpiId(supabase: any): Promise<string | null> {
  const { data } = await supabase.from("payment_settings").select("setting_value").eq("setting_key", "upi_id").maybeSingle();
  return data?.setting_value || null;
}

async function getRequiredChannels(supabase: any): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "required_channels").maybeSingle();
  if (data?.value) {
    try { const ch = JSON.parse(data.value); if (Array.isArray(ch)) return ch; } catch {}
  }
  return [];
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

async function showMotherMenu(token: string, chatId: number) {
  await sendMsg(token, chatId,
    "🏭 <b>Mother Bot — Create Your Own Selling Bot!</b>\n\n" +
    "Create a bot that sells products from our catalog.\n" +
    `Earn commission on every sale! 💰\n\nCreation Fee: ₹${CREATION_FEE}\n\n` +
    "Choose an option:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Create a Bot", callback_data: "mother_create_bot" }],
          [{ text: "🤖 My Bots", callback_data: "mother_my_bots" }],
          [{ text: "💰 Earnings", callback_data: "mother_earnings" }],
          [{ text: "❓ Help", callback_data: "mother_help" }],
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
    text += `• @${bot.bot_username || "unknown"} — ${status}\n`;
    text += `  Revenue: ${bot.revenue_percent}% | Orders: ${bot.total_orders} | Earned: ₹${bot.total_earnings}\n\n`;
    buttons.push([{
      text: `${bot.is_active ? "⏸ Deactivate" : "▶️ Activate"} @${bot.bot_username || "bot"}`,
      callback_data: `mother_toggle_${bot.id}`
    }]);
  }

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

async function handleMotherConversation(token: string, supabase: any, chatId: number, userId: number, text: string, state: { step: string; data: Record<string, any> }) {
  if (text === "/cancel") {
    await deleteConvState(supabase, userId);
    await sendMsg(token, chatId, "❌ Cancelled.");
    return;
  }

  // Step 1: Enter bot token
  if (state.step === "mother_enter_token") {
    const tokenVal = text.trim();
    const validation = await validateBotToken(tokenVal);
    if (!validation.ok) {
      await sendMsg(token, chatId, "❌ Invalid bot token. Please send a valid Bot API token from @BotFather.\n\nSend /cancel to abort.");
      return;
    }

    const { data: existing } = await supabase.from("child_bots").select("id").eq("bot_token", tokenVal).maybeSingle();
    if (existing) {
      await sendMsg(token, chatId, "❌ This bot token is already registered. Use a different bot.");
      return;
    }

    const { count } = await supabase.from("child_bots").select("id", { count: "exact", head: true }).eq("owner_telegram_id", userId);
    if ((count || 0) >= 3) {
      await sendMsg(token, chatId, "❌ You can only create up to 3 bots. Deactivate or contact support.");
      await deleteConvState(supabase, userId);
      return;
    }

    await setConvState(supabase, userId, "mother_enter_username", { bot_token: tokenVal, bot_username: validation.username, bot_id: validation.id });
    await sendMsg(token, chatId,
      `✅ Bot verified: @${validation.username}\n\n` +
      `Step 2/5: Enter the <b>Bot Username</b> (without @)\n\n` +
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
      await sendMsg(token, chatId, "❌ Invalid username. Please enter a valid bot username (min 3 characters).");
      return;
    }
    await setConvState(supabase, userId, "mother_enter_owner", { ...state.data, bot_username: username });
    await sendMsg(token, chatId,
      `✅ Username: @${username}\n\n` +
      `Step 3/5: Enter the <b>Owner Telegram ID</b>\n\n` +
      `This is the person who will manage this bot.\nSend your own ID (<code>${userId}</code>) to be the owner yourself.`
    );
    return;
  }

  // Step 3: Enter owner ID
  if (state.step === "mother_enter_owner") {
    const ownerId = parseInt(text.trim());
    if (isNaN(ownerId) || ownerId <= 0) {
      await sendMsg(token, chatId, "❌ Invalid Telegram ID. Please send a numeric ID.");
      return;
    }
    await setConvState(supabase, userId, "mother_enter_percent", { ...state.data, owner_telegram_id: ownerId });
    await sendMsg(token, chatId,
      `Step 4/5: Enter your <b>Revenue Percentage</b> (1% – 60%)\n\n` +
      `This is the commission you'll earn per sale through your bot.\n` +
      `Price shown to users = Reseller Price + Your %`
    );
    return;
  }

  // Step 4: Enter revenue percentage → Show confirmation
  if (state.step === "mother_enter_percent") {
    const percent = parseFloat(text.trim());
    if (isNaN(percent) || percent < 1 || percent > 60) {
      await sendMsg(token, chatId, "❌ Invalid percentage. Enter a number between 1 and 60.");
      return;
    }

    await setConvState(supabase, userId, "mother_confirm", { ...state.data, revenue_percent: percent });
    await sendMsg(token, chatId,
      `📋 <b>Confirm Bot Creation</b>\n\n` +
      `🤖 Bot: @${state.data.bot_username}\n` +
      `👤 Owner ID: <code>${state.data.owner_telegram_id}</code>\n` +
      `💰 Revenue: ${percent}% per sale\n` +
      `📎 Referral/Resale links will use: @${state.data.bot_username}\n\n` +
      `💳 <b>Creation Fee: ₹${CREATION_FEE}</b>\n\n` +
      `After confirmation, you'll need to pay ₹${CREATION_FEE} to activate the bot.\n\n` +
      `Confirm?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm & Pay", callback_data: "mother_confirm_create" }],
            [{ text: "❌ Cancel", callback_data: "mother_cancel_create" }],
          ],
        },
      }
    );
    return;
  }

  // If in awaiting_payment state and user sends text
  if (state.step === "mother_awaiting_payment") {
    await sendMsg(token, chatId, "📸 Please send a <b>payment screenshot</b> (photo), not text.\n\nSend /cancel to abort.");
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
