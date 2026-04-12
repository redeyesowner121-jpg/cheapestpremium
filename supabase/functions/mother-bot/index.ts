// ===== MOTHER BOT - Multi-Bot Creation Platform =====
// Handles both:
// 1. Mother Bot itself (create bots, manage, earnings)
// 2. Child Bots dynamically via ?bot=<child_bot_id>

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

// ===== CONVERSATION STATE (reuses telegram_conversation_state table) =====
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

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = new URL(req.url);
  const childBotId = url.searchParams.get("bot");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ===== CHILD BOT MODE =====
  if (childBotId) {
    return await handleChildBot(supabase, req, childBotId, jsonOk);
  }

  // ===== MOTHER BOT MODE =====
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

      // Upsert mother bot user
      await upsertMotherUser(supabase, cq.from);

      if (data === "mother_create_bot") {
        await setConvState(supabase, userId, "mother_enter_token", {});
        await sendMsg(MOTHER_TOKEN, chatId,
          "🤖 <b>Create a New Bot</b>\n\n" +
          "Step 1/3: Send your <b>Bot API Token</b>\n\n" +
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
          "Max 3 bots per user. Commission: 1%-60% per sale.",
          { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
        );
        return jsonOk();
      }

      if (data === "mother_main") {
        await showMotherMenu(MOTHER_TOKEN, chatId);
        return jsonOk();
      }

      // Confirm create bot
      if (data === "mother_confirm_create") {
        const state = await getConvState(supabase, userId);
        if (state?.step === "mother_confirm" && state.data.bot_token) {
          await createChildBot(MOTHER_TOKEN, supabase, chatId, userId, state.data);
          await deleteConvState(supabase, userId);
        }
        return jsonOk();
      }

      if (data === "mother_cancel_create") {
        await deleteConvState(supabase, userId);
        await sendMsg(MOTHER_TOKEN, chatId, "❌ Bot creation cancelled.");
        await showMotherMenu(MOTHER_TOKEN, chatId);
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

      return jsonOk();
    }

    // ===== TEXT MESSAGES =====
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
          await handleMotherConversation(MOTHER_TOKEN, supabase, chatId, userId, text, state);
          return jsonOk();
        }
      }

      const command = text.split(" ")[0].toLowerCase().split("@")[0];

      if (command === "/start") {
        // Check channel membership
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

      // Unknown — show menu
      await showMotherMenu(MOTHER_TOKEN, chatId);
      return jsonOk();
    }

    return jsonOk();
  } catch (e) {
    console.error("Mother bot error:", e);
    return jsonOk();
  }
});

// ===== MOTHER BOT HELPERS =====

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
    "Earn commission on every sale! 💰\n\n" +
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

    // Check if token already used
    const { data: existing } = await supabase.from("child_bots").select("id").eq("bot_token", tokenVal).maybeSingle();
    if (existing) {
      await sendMsg(token, chatId, "❌ This bot token is already registered. Use a different bot.");
      return;
    }

    // Check max 3 bots
    const { count } = await supabase.from("child_bots").select("id", { count: "exact", head: true }).eq("owner_telegram_id", userId);
    if ((count || 0) >= 3) {
      await sendMsg(token, chatId, "❌ You can only create up to 3 bots. Deactivate or contact support.");
      await deleteConvState(supabase, userId);
      return;
    }

    await setConvState(supabase, userId, "mother_enter_owner", { bot_token: tokenVal, bot_username: validation.username, bot_id: validation.id });
    await sendMsg(token, chatId,
      `✅ Bot verified: @${validation.username}\n\n` +
      `Step 2/3: Enter the <b>Owner Telegram ID</b>\n\n` +
      `This is the person who will manage this bot.\nSend your own ID (<code>${userId}</code>) to be the owner yourself.`
    );
    return;
  }

  // Step 2: Enter owner ID
  if (state.step === "mother_enter_owner") {
    const ownerId = parseInt(text.trim());
    if (isNaN(ownerId) || ownerId <= 0) {
      await sendMsg(token, chatId, "❌ Invalid Telegram ID. Please send a numeric ID.");
      return;
    }
    await setConvState(supabase, userId, "mother_enter_percent", { ...state.data, owner_telegram_id: ownerId });
    await sendMsg(token, chatId,
      `Step 3/3: Enter your <b>Revenue Percentage</b> (1% – 60%)\n\n` +
      `This is the commission you'll earn per sale through your bot.`
    );
    return;
  }

  // Step 3: Enter revenue percentage
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
      `💰 Revenue: ${percent}% per sale\n\n` +
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
}

async function createChildBot(token: string, supabase: any, chatId: number, creatorId: number, data: Record<string, any>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  // Insert into child_bots
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

  // Set webhook for child bot
  const webhookUrl = `${SUPABASE_URL}/functions/v1/mother-bot?bot=${newBot.id}`;
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
    `Orders will be processed by our main admin team.`,
    { reply_markup: { inline_keyboard: [[{ text: "🤖 My Bots", callback_data: "mother_my_bots" }], [{ text: "🏠 Main Menu", callback_data: "mother_main" }]] } }
  );
}

// ======================================================================
// ===== CHILD BOT HANDLER =====
// ======================================================================

async function handleChildBot(supabase: any, req: Request, childBotId: string, jsonOk: () => Response) {
  // Look up child bot
  const { data: childBot } = await supabase.from("child_bots").select("*").eq("id", childBotId).single();
  if (!childBot) return new Response("Unknown bot", { status: 404 });
  if (!childBot.is_active) {
    // Bot deactivated — silently ignore
    return jsonOk();
  }

  const TOKEN = childBot.bot_token;

  try {
    const update = await req.json();

    // ===== CALLBACKS =====
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      const userId = cq.from.id;
      await answerCb(TOKEN, cq.id);
      await upsertChildUser(supabase, childBotId, cq.from);

      if (data === "child_main") {
        await showChildMenu(TOKEN, supabase, chatId, childBot);
        return jsonOk();
      }

      if (data === "child_products") {
        await showChildCategories(TOKEN, supabase, chatId);
        return jsonOk();
      }

      if (data.startsWith("child_cat_")) {
        const category = data.replace("child_cat_", "");
        await showChildCategoryProducts(TOKEN, supabase, chatId, category);
        return jsonOk();
      }

      if (data.startsWith("child_prod_")) {
        const productId = data.replace("child_prod_", "");
        await showChildProductDetail(TOKEN, supabase, chatId, productId, childBot);
        return jsonOk();
      }

      if (data.startsWith("child_buy_")) {
        const productId = data.replace("child_buy_", "");
        await handleChildBuyProduct(TOKEN, supabase, chatId, userId, productId, childBot, cq.from);
        return jsonOk();
      }

      if (data.startsWith("child_buyvar_")) {
        const variationId = data.replace("child_buyvar_", "");
        await handleChildBuyVariation(TOKEN, supabase, chatId, userId, variationId, childBot, cq.from);
        return jsonOk();
      }

      if (data === "child_orders") {
        await showChildOrders(TOKEN, supabase, chatId, userId, childBotId);
        return jsonOk();
      }

      if (data === "child_wallet") {
        await showChildWallet(TOKEN, supabase, chatId, userId);
        return jsonOk();
      }

      if (data === "child_support") {
        const settings = await getAppSettings(supabase);
        const supportText = settings.support_message || "Contact @admin for support.";
        await sendMsg(TOKEN, chatId, `💬 <b>Support</b>\n\n${supportText}`,
          { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "child_main" }]] } });
        return jsonOk();
      }

      // Wallet pay confirmation for child bot
      if (data === "child_walletpay_confirm") {
        const state = await getConvState(supabase, userId);
        if (state?.step === "child_wallet_pay" && state.data.productId) {
          await processChildWalletPay(TOKEN, supabase, chatId, userId, childBot, state.data);
          await deleteConvState(supabase, userId);
        }
        return jsonOk();
      }

      // Payment method choices
      if (data === "child_pay_wallet") {
        const state = await getConvState(supabase, userId);
        if (state?.step === "child_choose_payment") {
          await setConvState(supabase, userId, "child_wallet_pay", state.data);
          await sendMsg(TOKEN, chatId, `Confirm wallet payment for <b>${state.data.productName}</b>?`, {
            reply_markup: { inline_keyboard: [[{ text: "✅ Pay with Wallet", callback_data: "child_walletpay_confirm" }], [{ text: "❌ Cancel", callback_data: "child_main" }]] }
          });
        }
        return jsonOk();
      }

      if (data === "child_pay_screenshot") {
        const state = await getConvState(supabase, userId);
        if (state?.step === "child_choose_payment") {
          await setConvState(supabase, userId, "child_awaiting_screenshot", state.data);
          await sendMsg(TOKEN, chatId,
            `📸 <b>Send Payment Screenshot</b>\n\n` +
            `Product: <b>${state.data.productName}</b>\n` +
            `Amount: <b>₹${state.data.price}</b>\n\n` +
            `Pay via UPI/Binance and send the screenshot here.\nSend /cancel to abort.`
          );
        }
        return jsonOk();
      }

      // Verify join
      if (data === "child_verify_join") {
        const channels = await getRequiredChannels(supabase);
        const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || TOKEN;
        const results = await Promise.all(channels.map(ch => getChatMemberStatus(mainToken, ch, userId)));
        const allJoined = results.every(s => ["member", "administrator", "creator"].includes(s));
        if (allJoined) {
          await showChildMenu(TOKEN, supabase, chatId, childBot);
        } else {
          await sendMsg(TOKEN, chatId, "❌ You haven't joined all channels yet. Please join and try again.");
        }
        return jsonOk();
      }

      return jsonOk();
    }

    // ===== MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text || "";

      await upsertChildUser(supabase, childBotId, msg.from);

      if (text.startsWith("/")) {
        await deleteConvState(supabase, userId);
      } else {
        const state = await getConvState(supabase, userId);
        if (state) {
          await handleChildConversation(TOKEN, supabase, chatId, userId, msg, childBot, state);
          return jsonOk();
        }
      }

      const command = text.split(" ")[0].toLowerCase().split("@")[0];

      if (command === "/start") {
        // Channel check
        const channels = await getRequiredChannels(supabase);
        if (channels.length > 0) {
          const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || TOKEN;
          const results = await Promise.all(channels.map(ch => getChatMemberStatus(mainToken, ch, userId)));
          const allJoined = results.every(s => ["member", "administrator", "creator"].includes(s));
          if (!allJoined) {
            const buttons: any[][] = channels.map(ch => {
              const name = ch.startsWith("@") ? ch : `@${ch}`;
              return [{ text: `Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }];
            });
            buttons.push([{ text: "✅ I've Joined - Verify", callback_data: "child_verify_join" }]);
            await sendMsg(TOKEN, chatId, "🔒 <b>Please join our channels first!</b>", { reply_markup: { inline_keyboard: buttons } });
            return jsonOk();
          }
        }
        await showChildMenu(TOKEN, supabase, chatId, childBot);
        return jsonOk();
      }

      if (command === "/menu") { await showChildMenu(TOKEN, supabase, chatId, childBot); return jsonOk(); }
      if (command === "/products" || command === "/shop") { await showChildCategories(TOKEN, supabase, chatId); return jsonOk(); }
      if (command === "/orders") { await showChildOrders(TOKEN, supabase, chatId, userId, childBotId); return jsonOk(); }
      if (command === "/wallet") { await showChildWallet(TOKEN, supabase, chatId, userId); return jsonOk(); }

      // Default
      await showChildMenu(TOKEN, supabase, chatId, childBot);
      return jsonOk();
    }

    return jsonOk();
  } catch (e) {
    console.error("Child bot error:", e);
    return jsonOk();
  }
}

// ===== CHILD BOT HELPERS =====

async function getAppSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const s: Record<string, string> = {};
  data?.forEach((r: any) => (s[r.key] = r.value));
  return s;
}

async function upsertChildUser(supabase: any, childBotId: string, user: any) {
  await supabase.from("child_bot_users").upsert({
    child_bot_id: childBotId,
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "child_bot_id,telegram_id" });
}

async function showChildMenu(token: string, supabase: any, chatId: number, childBot: any) {
  const settings = await getAppSettings(supabase);
  const storeName = settings.app_name || "Premium Store";

  await sendMsg(token, chatId,
    `🛍️ <b>Welcome to ${storeName}!</b>\n\n` +
    `✨ Premium digital products at the cheapest prices\n` +
    `⚡ Instant delivery\n` +
    `🔒 Secure payments\n\n` +
    `Choose an option:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Products", callback_data: "child_products" }],
          [{ text: "📦 My Orders", callback_data: "child_orders" }, { text: "💰 Wallet", callback_data: "child_wallet" }],
          [{ text: "💬 Support", callback_data: "child_support" }],
        ],
      },
    }
  );
}

async function showChildCategories(token: string, supabase: any, chatId: number) {
  const { data: categories } = await supabase.from("categories").select("name").eq("is_active", true).order("sort_order");
  if (!categories?.length) {
    await sendMsg(token, chatId, "😔 No products available right now.", { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "child_main" }]] } });
    return;
  }

  const buttons = categories.map((c: any) => [{ text: c.name, callback_data: `child_cat_${c.name}` }]);
  buttons.push([{ text: "🏠 Menu", callback_data: "child_main" }]);
  await sendMsg(token, chatId, "📂 <b>Categories</b>\n\nChoose a category:", { reply_markup: { inline_keyboard: buttons } });
}

async function showChildCategoryProducts(token: string, supabase: any, chatId: number, category: string) {
  const { data: products } = await supabase.from("products").select("id, name, price, original_price").eq("category", category).eq("is_active", true).order("created_at", { ascending: false }).limit(20);

  if (!products?.length) {
    await sendMsg(token, chatId, "😔 No products in this category.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Categories", callback_data: "child_products" }]] } });
    return;
  }

  let text = `📂 <b>${category}</b>\n\n`;
  const buttons: any[][] = [];

  for (const p of products) {
    const original = p.original_price ? `<s>₹${p.original_price}</s> ` : "";
    text += `• ${p.name} — ${original}<b>₹${p.price}</b>\n`;
    buttons.push([{ text: p.name, callback_data: `child_prod_${p.id}` }]);
  }

  buttons.push([{ text: "🔙 Categories", callback_data: "child_products" }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function showChildProductDetail(token: string, supabase: any, chatId: number, productId: string, childBot: any) {
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product) { await sendMsg(token, chatId, "❌ Product not found."); return; }

  const { data: variations } = await supabase.from("product_variations").select("*").eq("product_id", productId).eq("is_active", true).order("price");

  let text = `🛍️ <b>${product.name}</b>\n\n`;
  if (product.description) text += `${product.description}\n\n`;
  if (product.original_price) text += `Original: <s>₹${product.original_price}</s>\n`;
  text += `Price: <b>₹${product.price}</b>\n`;
  if (product.stock !== null) text += `Stock: ${product.stock > 0 ? `${product.stock} left` : "Out of stock"}\n`;

  const buttons: any[][] = [];

  if (variations?.length) {
    text += "\n<b>Variations:</b>\n";
    for (const v of variations) {
      text += `• ${v.name} — ₹${v.price}\n`;
      buttons.push([{ text: `Buy ${v.name} — ₹${v.price}`, callback_data: `child_buyvar_${v.id}` }]);
    }
  } else {
    if (product.stock === null || product.stock > 0) {
      buttons.push([{ text: `🛒 Buy Now — ₹${product.price}`, callback_data: `child_buy_${product.id}` }]);
    }
  }

  buttons.push([{ text: "🔙 Back", callback_data: `child_cat_${product.category}` }]);
  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function handleChildBuyProduct(token: string, supabase: any, chatId: number, userId: number, productId: string, childBot: any, telegramUser: any) {
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product) { await sendMsg(token, chatId, "❌ Product not found."); return; }
  if (product.stock !== null && product.stock <= 0) { await sendMsg(token, chatId, "❌ Out of stock."); return; }

  await showChildPaymentChoice(token, supabase, chatId, userId, product.name, product.price, productId, null, childBot);
}

async function handleChildBuyVariation(token: string, supabase: any, chatId: number, userId: number, variationId: string, childBot: any, telegramUser: any) {
  const { data: variation } = await supabase.from("product_variations").select("*").eq("id", variationId).single();
  if (!variation) { await sendMsg(token, chatId, "❌ Product not found."); return; }

  const { data: product } = await supabase.from("products").select("name, stock").eq("id", variation.product_id).single();
  const productName = `${product?.name || "Product"} - ${variation.name}`;
  if (product?.stock !== null && product?.stock !== undefined && product?.stock <= 0) { await sendMsg(token, chatId, "❌ Out of stock."); return; }

  await showChildPaymentChoice(token, supabase, chatId, userId, productName, variation.price, variation.product_id, variation.id, childBot);
}

async function showChildPaymentChoice(token: string, supabase: any, chatId: number, userId: number, productName: string, price: number, productId: string, variationId: string | null, childBot: any) {
  // Check wallet
  const { data: wallet } = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", userId).single();
  const walletBalance = wallet?.balance || 0;

  const stateData = { productName, price, productId, variationId, childBotId: childBot.id };

  if (walletBalance >= price) {
    // Wallet can cover fully
    await setConvState(supabase, userId, "child_wallet_pay", stateData);
    await sendMsg(token, chatId,
      `<b>Order: ${productName}</b>\n\nPrice: <b>₹${price}</b>\nWallet: <b>₹${walletBalance}</b>\n\nPay with wallet?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Pay with Wallet", callback_data: "child_walletpay_confirm" }],
            [{ text: "❌ Cancel", callback_data: "child_main" }],
          ],
        },
      }
    );
    return;
  }

  // Show payment options
  await setConvState(supabase, userId, "child_choose_payment", stateData);

  let text = `<b>Order: ${productName}</b>\n\nPrice: <b>₹${price}</b>\nWallet: <b>₹${walletBalance}</b>\n\n`;
  if (walletBalance > 0) text += `Wallet will be used first.\n\n`;
  text += "Choose payment method:";

  const buttons: any[][] = [];
  if (walletBalance > 0) buttons.push([{ text: "💰 Wallet + Screenshot", callback_data: "child_pay_screenshot" }]);
  else buttons.push([{ text: "📸 Pay & Send Screenshot", callback_data: "child_pay_screenshot" }]);
  buttons.push([{ text: "❌ Cancel", callback_data: "child_main" }]);

  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function processChildWalletPay(token: string, supabase: any, chatId: number, userId: number, childBot: any, data: Record<string, any>) {
  const { productName, price, productId, variationId, childBotId } = data;

  // Deduct wallet
  const { data: wallet } = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", userId).single();
  if (!wallet || wallet.balance < price) {
    await sendMsg(token, chatId, "❌ Insufficient wallet balance.");
    return;
  }

  await supabase.from("telegram_wallets").update({ balance: wallet.balance - price }).eq("telegram_id", userId);
  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId, type: "purchase_deduction", amount: -price,
    description: `Purchase: ${productName} (via child bot)`,
  });

  // Create telegram order (goes to main admin)
  const { data: order } = await supabase.from("telegram_orders").insert({
    telegram_user_id: userId,
    product_name: productName,
    product_id: productId,
    amount: price,
    status: "confirmed",
    username: `child_bot:${childBotId}`,
  }).select("id").single();

  // Create child bot order
  const commission = Math.round(price * childBot.revenue_percent) / 100;
  const { data: childOrder } = await supabase.from("child_bot_orders").insert({
    child_bot_id: childBotId,
    telegram_order_id: order?.id,
    buyer_telegram_id: userId,
    product_name: productName,
    total_price: price,
    owner_commission: commission,
    status: "confirmed",
  }).select("id").single();

  // Notify main admins
  const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
  const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id");
  const SUPER_ADMIN_ID = 6898461453;
  const adminIds = [SUPER_ADMIN_ID, ...(admins?.map((a: any) => a.telegram_id) || [])].filter((v, i, a) => a.indexOf(v) === i);

  for (const adminId of adminIds) {
    try {
      await sendMsg(mainToken, adminId,
        `🆕 <b>New Child Bot Order!</b>\n\n` +
        `🤖 Bot: @${childBot.bot_username}\n` +
        `📦 Product: ${productName}\n` +
        `💰 Amount: ₹${price}\n` +
        `👤 Buyer: <code>${userId}</code>\n` +
        `📊 Owner Commission: ₹${commission} (${childBot.revenue_percent}%)`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Confirm", callback_data: `confirm_${order?.id}` }],
              [{ text: "❌ Reject", callback_data: `reject_${order?.id}` }],
            ],
          },
        }
      );
    } catch {}
  }

  await sendMsg(token, chatId,
    `✅ <b>Order Placed!</b>\n\n` +
    `Product: <b>${productName}</b>\n` +
    `Amount: ₹${price} (from wallet)\n\n` +
    `Your order is being processed. You'll be notified when it's ready! ⚡`,
    { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "child_main" }]] } }
  );
}

async function handleChildConversation(token: string, supabase: any, chatId: number, userId: number, msg: any, childBot: any, state: { step: string; data: Record<string, any> }) {
  const text = msg.text || "";

  if (text === "/cancel") {
    await deleteConvState(supabase, userId);
    await sendMsg(token, chatId, "❌ Cancelled.");
    return;
  }

  // Screenshot upload
  if (state.step === "child_awaiting_screenshot") {
    const photo = msg.photo;
    if (!photo?.length) {
      await sendMsg(token, chatId, "📸 Please send a payment <b>screenshot</b> (photo).");
      return;
    }

    const { productName, price, productId, variationId, childBotId } = state.data;

    // Create order
    const { data: order } = await supabase.from("telegram_orders").insert({
      telegram_user_id: userId,
      product_name: productName,
      product_id: productId,
      amount: price,
      status: "pending",
      screenshot_file_id: photo[photo.length - 1].file_id,
      username: `child_bot:${childBot.id}`,
    }).select("id").single();

    // Create child bot order
    const commission = Math.round(price * childBot.revenue_percent) / 100;
    await supabase.from("child_bot_orders").insert({
      child_bot_id: childBot.id,
      telegram_order_id: order?.id,
      buyer_telegram_id: userId,
      product_name: productName,
      total_price: price,
      owner_commission: commission,
      status: "pending",
    });

    // Notify main admins with screenshot
    const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id");
    const SUPER_ADMIN_ID = 6898461453;
    const adminIds = [SUPER_ADMIN_ID, ...(admins?.map((a: any) => a.telegram_id) || [])].filter((v, i, a) => a.indexOf(v) === i);

    for (const adminId of adminIds) {
      try {
        // Forward screenshot
        await fetch(`https://api.telegram.org/bot${mainToken}/forwardMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: adminId, from_chat_id: chatId, message_id: msg.message_id }),
        });

        await sendMsg(mainToken, adminId,
          `🆕 <b>Child Bot Order (Screenshot)</b>\n\n` +
          `🤖 Bot: @${childBot.bot_username}\n` +
          `📦 ${productName}\n💰 ₹${price}\n👤 <code>${userId}</code>`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ Confirm", callback_data: `confirm_${order?.id}` }, { text: "❌ Reject", callback_data: `reject_${order?.id}` }],
              ],
            },
          }
        );
      } catch {}
    }

    await deleteConvState(supabase, userId);
    await sendMsg(token, chatId,
      `✅ <b>Order Submitted!</b>\n\nProduct: ${productName}\nAmount: ₹${price}\n\nAdmin is reviewing your payment. You'll be notified soon! ⏳`,
      { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "child_main" }]] } }
    );
    return;
  }
}

async function showChildOrders(token: string, supabase: any, chatId: number, userId: number, childBotId: string) {
  const { data: orders } = await supabase.from("child_bot_orders").select("*").eq("child_bot_id", childBotId).eq("buyer_telegram_id", userId).order("created_at", { ascending: false }).limit(10);

  if (!orders?.length) {
    await sendMsg(token, chatId, "📦 No orders yet.",
      { reply_markup: { inline_keyboard: [[{ text: "🛒 Products", callback_data: "child_products" }], [{ text: "🏠 Menu", callback_data: "child_main" }]] } });
    return;
  }

  let text = "📦 <b>Your Orders</b>\n\n";
  const statusEmoji: Record<string, string> = { pending: "⏳", confirmed: "✅", rejected: "❌", delivered: "📦" };

  for (const o of orders) {
    text += `${statusEmoji[o.status] || "📋"} ${o.product_name} — ₹${o.total_price} — ${o.status}\n`;
  }

  await sendMsg(token, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "child_main" }]] } });
}

async function showChildWallet(token: string, supabase: any, chatId: number, userId: number) {
  const { data: wallet } = await supabase.from("telegram_wallets").select("balance, total_earned").eq("telegram_id", userId).single();
  const balance = wallet?.balance || 0;
  const earned = wallet?.total_earned || 0;

  await sendMsg(token, chatId,
    `💰 <b>Wallet</b>\n\nBalance: <b>₹${balance}</b>\nTotal Earned: <b>₹${earned}</b>`,
    { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "child_main" }]] } }
  );
}
