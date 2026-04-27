// ===== MAIN ENTRY POINT (slim) =====
// All logic split into focused modules: bot-mode, callback-router, command-router, upi-redirect.
// Supports giveaway mode via ?bot=giveaway and child bot mode via ?child=<id>.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./constants.ts";
import {
  upsertTelegramUser, isBanned, getConversationState, deleteConversationState, getUserData,
} from "./db-helpers.ts";
import { handleConversationStep } from "./conversation-handlers.ts";
import { handleAIQuery } from "./ai-handler.ts";
import { clearChildBotContext } from "./child-context.ts";
import { detectAndInitBotMode } from "./bot-mode.ts";
import { handleUpiRedirect } from "./upi-redirect.ts";
import { handleCallbackQuery } from "./callback-router.ts";
import { handleCommand } from "./command-router.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonOk = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  clearChildBotContext();

  const url = new URL(req.url);
  const mode = await detectAndInitBotMode(req, supabase);

  // GET handler — UPI redirect page (only main mode, non-giveaway)
  if (req.method === "GET" && !mode.isGiveaway && !mode.isChildMode) {
    if (url.searchParams.get("action") === "upi_redirect") {
      return handleUpiRedirect(url);
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  if (!mode.botToken) {
    return new Response("Bot token not configured", { status: 500 });
  }

  const BOT_TOKEN = mode.botToken;

  try {
    const update = await req.json();

    // ===== CALLBACK QUERIES =====
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, {
        BOT_TOKEN, supabase,
        isGiveaway: mode.isGiveaway,
        isChildMode: mode.isChildMode,
        childBotId: mode.childBotId,
      });
      return jsonOk();
    }

    // ===== TEXT/PHOTO MESSAGES =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUser = msg.from;
      const userId = telegramUser.id;
      const text = msg.text || "";

      const upsertPromises: Promise<any>[] = [
        getUserData(supabase, userId),
        upsertTelegramUser(supabase, telegramUser),
      ];

      if (mode.isChildMode && mode.childBotId) {
        upsertPromises.push(
          Promise.resolve(supabase.from("child_bot_users").upsert({
            child_bot_id: mode.childBotId,
            telegram_id: userId,
            username: telegramUser.username || null,
            first_name: telegramUser.first_name || null,
            last_active: new Date().toISOString(),
          }, { onConflict: "child_bot_id,telegram_id" }))
        );
      }

      const [userData] = await Promise.all(upsertPromises);

      if (userData.is_banned) { clearChildBotContext(); return jsonOk(); }
      const lang = userData.language || "en";

      // Reset conversation state on commands
      if (text.startsWith("/")) {
        await deleteConversationState(supabase, userId);
      } else {
        const convState = await getConversationState(supabase, userId);
        if (convState) {
          await handleConversationStep(BOT_TOKEN, supabase, chatId, userId, msg, convState);
          clearChildBotContext();
          return jsonOk();
        }
      }

      // Commands
      if (text.startsWith("/")) {
        const parts = text.split(" ");
        const command = parts[0].toLowerCase().split("@")[0];

        await handleCommand({
          BOT_TOKEN, supabase, chatId, userId, telegramUser,
          text, parts, command, lang, userData,
          isGiveaway: mode.isGiveaway,
          isChildMode: mode.isChildMode,
        });

        clearChildBotContext();
        return jsonOk();
      }

      // Non-command text → route to AI assistant
      await handleAIQuery(BOT_TOKEN, supabase, chatId, userId, text, lang);
      clearChildBotContext();
      return jsonOk();
    }

    // ===== CHAT MEMBER UPDATES (channel leave/join) =====
    if (update.chat_member && mode.isGiveaway) {
      const { handleGiveawayChannelLeave } = await import("./giveaway-handlers.ts");
      await handleGiveawayChannelLeave(BOT_TOKEN, supabase, update.chat_member);
      clearChildBotContext();
      return jsonOk();
    }

    clearChildBotContext();
    return jsonOk();
  } catch (error) {
    console.error("Telegram bot error:", error);
    clearChildBotContext();
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
