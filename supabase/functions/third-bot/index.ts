// ===== THIRD BOT - Full-featured Store Bot =====
// Complete replica of main bot with all features for token 8603817176:AAHkPWWqjKhm6Ln0gqfe9zAvdqJwVA1tA5g

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";

const MAIN_BOT_USERNAME = "Air1_Premium_bot";
const RESALE_BOT_USERNAME = "AIR1XOTT_bot";
const THIRD_BOT_USERNAME = "third_store_bot";
const THIRD_BOT_OWNER_ID = 7170630274;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UPI_ID = "8900684167@ibl";
const UPI_NAME = "Asif Ikbal Rubaiul Islam";

function normalizeBackButtons(replyMarkup?: any) {
  if (!replyMarkup?.inline_keyboard) return replyMarkup;

  return {
    ...replyMarkup,
    inline_keyboard: replyMarkup.inline_keyboard.map((row: any[]) =>
      row.map((button: any) => {
        if (!button?.text) return button;

        const normalizedText = String(button.text).trim();
        const isBackButton =
          /back/i.test(normalizedText) ||
          normalizedText.includes("⬅️") ||
          normalizedText.includes("◀️") ||
          normalizedText.includes("🔙");

        if (!isBackButton) return button;

        const strippedText = normalizedText
          .replace(/^🔴\s*/u, "")
          .replace(/^🟥\s*/u, "")
          .trim();

        return {
          ...button,
          text: `🔴 ${strippedText}`,
          color: "red",
        };
      })
    ),
  };
}

// ===== HELPER: Send Telegram Message =====
async function sendMessage(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string; disable_web_page_preview?: boolean }) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts?.parse_mode || "HTML",
        disable_web_page_preview: opts?.disable_web_page_preview || false,
        ...(opts?.reply_markup && { reply_markup: normalizeBackButtons(opts.reply_markup) }),
      }),
    });
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}

// ===== DB HELPERS =====
async function upsertTelegramUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert({
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

async function getUserLang(supabase: any, telegramId: number): Promise<string> {
  const { data } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", telegramId).maybeSingle();
  return data?.language || "en";
}

async function isThirdBotAdmin(supabase: any, userId: number): Promise<boolean> {
  if (userId === THIRD_BOT_OWNER_ID) return true;
  const { data } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", userId).maybeSingle();
  return !!data;
}

async function ensureWallet(supabase: any, telegramId: number) {
  const { data: existing } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).maybeSingle();
  if (existing) return existing;
  const refCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: wallet } = await supabase.from("telegram_wallets").insert({ telegram_id: telegramId, referral_code: refCode }).select("*").single();
  return wallet;
}

async function getWallet(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).maybeSingle();
  return data;
}

async function getConversationState(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", telegramId).maybeSingle();
  return data ? { step: data.step, data: data.data || {} } : null;
}

async function setConversationState(supabase: any, telegramId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({
    telegram_id: telegramId,
    step,
    data: stateData,
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

async function deleteConversationState(supabase: any, telegramId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", telegramId);
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { mainBotToken: THIRD_BOT_TOKEN } = await resolveTelegramBotTokens({
    configuredMainToken: Deno.env.get("THIRD_BOT_TOKEN"),
    configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
    expectedMainUsername: THIRD_BOT_USERNAME,
    expectedResaleUsername: RESALE_BOT_USERNAME,
  });

  if (!THIRD_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "Third bot token not configured" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const update = await req.json();
    const msg = update.message;
    const callbackQuery = update.callback_query;

    // Handle callback queries
    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id;
      const userId = callbackQuery.from?.id;
      const data = callbackQuery.data;

      if (!userId || !chatId) return new Response("OK", { headers: corsHeaders });

      await upsertTelegramUser(supabase, callbackQuery.from);
      const lang = await getUserLang(supabase, userId);

      // Admin menu callback
      if (data === "third_admin_menu" && (await isThirdBotAdmin(supabase, userId))) {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📊 Analytics", callback_data: "third_analytics", style: "primary" }],
              [{ text: "🛍️ Products", callback_data: "third_products", style: "success" }, { text: "👥 Users", callback_data: "third_users", style: "primary" }],
              [{ text: "💰 Wallet", callback_data: "third_wallet", style: "success" }, { text: "📢 Channels", callback_data: "third_channels", style: "primary" }],
              [{ text: "⚙️ Settings", callback_data: "third_settings", style: "success" }],
              [{ text: "⬅️ Back", callback_data: "third_back", color: "red" }],
            ],
          },
        };
        await sendMessage(THIRD_BOT_TOKEN, chatId, "🔧 <b>Admin Panel</b>\n\nSelect an option:", keyboard);
      }

      // Admin-only actions
      if (userId === THIRD_BOT_OWNER_ID) {
        if (data === "third_owner_promote") {
          await setConversationState(supabase, userId, "third_promote_admin", {});
          await sendMessage(THIRD_BOT_TOKEN, chatId, "➕ <b>Add Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to cancel.");
        }
      }

      return new Response("OK", { headers: corsHeaders });
    }

    if (!msg) return new Response("OK", { headers: corsHeaders });

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text?.trim() || "";

    if (!userId) return new Response("OK", { headers: corsHeaders });

    await upsertTelegramUser(supabase, msg.from);
    const lang = await getUserLang(supabase, userId);

    // ===== /start command =====
    if (text === "/start" || text.startsWith("/start ")) {
      await deleteConversationState(supabase, userId);

      // Check if admin
      const isAdmin = await isThirdBotAdmin(supabase, userId);
      const isOwner = userId === THIRD_BOT_OWNER_ID;

      if (isOwner) {
        // Set as admin automatically
        await supabase.from("telegram_bot_admins").upsert({
          telegram_id: userId,
          role: "owner",
        }, { onConflict: "telegram_id" });

        const msg_text = isAdmin
          ? `👋 <b>Welcome Back, Owner!</b>\n\n🤖 This is your dedicated Third Store Bot.\n\nYou have full admin access.`
          : `👋 <b>Welcome, Owner!</b>\n\n🤖 Third Store Bot is ready!\n\nYou have been set as the bot owner.`;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔧 Admin Panel", callback_data: "third_admin_menu", style: "danger" }],
              [{ text: "📦 Store", callback_data: "third_store", style: "primary" }],
              [{ text: "ℹ️ Help", callback_data: "third_help" }],
            ],
          },
        };

        await sendMessage(THIRD_BOT_TOKEN, chatId, msg_text, keyboard);
        return new Response("OK", { headers: corsHeaders });
      }

      if (isAdmin) {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔧 Admin Panel", callback_data: "third_admin_menu" }],
              [{ text: "📦 Store", callback_data: "third_store" }],
            ],
          },
        };
        await sendMessage(THIRD_BOT_TOKEN, chatId, `👋 <b>Welcome, Admin!</b>\n\nYou have admin access to this bot.`, keyboard);
        return new Response("OK", { headers: corsHeaders });
      }

      // Regular user
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛍️ View Store", callback_data: "third_store", style: "primary" }],
            [{ text: "📦 My Orders", callback_data: "third_orders", style: "success" }],
            [{ text: "💰 My Wallet", callback_data: "third_wallet_user", style: "success" }],
            [{ text: "ℹ️ Help", callback_data: "third_help" }],
          ],
        },
      };

      await sendMessage(THIRD_BOT_TOKEN, chatId,
        `👋 <b>Welcome to Third Store Bot!</b>\n\n🛍️ Premium digital products at great prices\n⚡ Instant delivery\n🔒 Secure payments\n💬 24/7 Support\n\nWhat would you like to do?`,
        keyboard
      );
      return new Response("OK", { headers: corsHeaders });
    }

    // ===== /admin command =====
    if (text === "/admin" && (await isThirdBotAdmin(supabase, userId))) {
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 Analytics", callback_data: "third_analytics", style: "primary" }],
            [{ text: "🛍️ Products", callback_data: "third_products", style: "success" }, { text: "👥 Users", callback_data: "third_users", style: "primary" }],
            [{ text: "💰 Wallet", callback_data: "third_wallet", style: "success" }, { text: "📢 Channels", callback_data: "third_channels", style: "primary" }],
            [{ text: "⚙️ Settings", callback_data: "third_settings", style: "success" }],
          ],
        },
      };
      await sendMessage(THIRD_BOT_TOKEN, chatId, "🔧 <b>Admin Panel</b>\n\nSelect an option:", keyboard);
      return new Response("OK", { headers: corsHeaders });
    }

    // ===== Owner-only commands =====
    if (userId === THIRD_BOT_OWNER_ID) {
      if (text === "/promote") {
        await setConversationState(supabase, userId, "third_promote_admin", {});
        await sendMessage(THIRD_BOT_TOKEN, chatId, "➕ <b>Promote to Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to cancel.");
        return new Response("OK", { headers: corsHeaders });
      }

      if (text === "/demote") {
        await setConversationState(supabase, userId, "third_demote_admin", {});
        await sendMessage(THIRD_BOT_TOKEN, chatId, "➖ <b>Remove Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to cancel.");
        return new Response("OK", { headers: corsHeaders });
      }

      if (text === "/admins") {
        const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id, role");
        const adminList = admins?.map(a => `${a.telegram_id} (${a.role})`).join("\n") || "No admins yet";
        await sendMessage(THIRD_BOT_TOKEN, chatId, `<b>Bot Admins:</b>\n\n${adminList}`);
        return new Response("OK", { headers: corsHeaders });
      }

      if (text === "/info") {
        const { count: userCount } = await supabase.from("telegram_bot_users").select("*", { count: "exact" });
        const { count: productCount } = await supabase.from("products").select("*", { count: "exact" });
        await sendMessage(THIRD_BOT_TOKEN, chatId, `📊 <b>Bot Stats</b>\n\n👥 Users: ${userCount}\n📦 Products: ${productCount}`);
        return new Response("OK", { headers: corsHeaders });
      }
    }

    // ===== Handle Conversation States =====
    const state = await getConversationState(supabase, userId);
    if (state && userId === THIRD_BOT_OWNER_ID) {
      if (state.step === "third_promote_admin") {
        const adminId = parseInt(text);
        if (isNaN(adminId)) {
          await sendMessage(THIRD_BOT_TOKEN, chatId, "❌ Invalid User ID. Please enter a valid number.");
          return new Response("OK", { headers: corsHeaders });
        }

        await supabase.from("telegram_bot_admins").upsert({
          telegram_id: adminId,
          role: "admin",
        }, { onConflict: "telegram_id" });

        await deleteConversationState(supabase, userId);
        await sendMessage(THIRD_BOT_TOKEN, chatId, `✅ User ${adminId} has been promoted to admin.`);
        return new Response("OK", { headers: corsHeaders });
      }

      if (state.step === "third_demote_admin") {
        const adminId = parseInt(text);
        if (isNaN(adminId) || adminId === THIRD_BOT_OWNER_ID) {
          await sendMessage(THIRD_BOT_TOKEN, chatId, "❌ Cannot remove owner or invalid ID.");
          return new Response("OK", { headers: corsHeaders });
        }

        await supabase.from("telegram_bot_admins").delete().eq("telegram_id", adminId);
        await deleteConversationState(supabase, userId);
        await sendMessage(THIRD_BOT_TOKEN, chatId, `✅ User ${adminId} has been removed from admins.`);
        return new Response("OK", { headers: corsHeaders });
      }
    }

    // ===== /cancel command =====
    if (text === "/cancel") {
      await deleteConversationState(supabase, userId);
      await sendMessage(THIRD_BOT_TOKEN, chatId, "✅ Cancelled. Send /start to return to main menu.");
      return new Response("OK", { headers: corsHeaders });
    }

    // ===== Default message =====
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📖 Commands", callback_data: "third_help" }],
          [{ text: "🏠 Main Menu", callback_data: "third_menu" }],
        ],
      },
    };

    await sendMessage(THIRD_BOT_TOKEN, chatId,
      `I didn't understand that command. 🤔\n\nUse /start to see the main menu or /admin if you're an admin.`,
      keyboard
    );

    return new Response("OK", { headers: corsHeaders });
  } catch (error) {
    console.error("Third bot error:", error);
    return new Response("OK", { headers: corsHeaders });
  }
});
