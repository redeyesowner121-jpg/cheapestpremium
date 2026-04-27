// ===== THIRD BOT - Full-featured Store Bot (slim entrypoint) =====
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";
import { corsHeaders, sendMessage, THIRD_BOT_USERNAME, RESALE_BOT_USERNAME, THIRD_BOT_OWNER_ID } from "./_helpers.ts";
import { upsertTelegramUser, isThirdBotAdmin, getConversationState, deleteConversationState, setConversationState } from "./_db.ts";
import { handleStart, handleAdminMenu, handleOwnerCommand, handleStateMessage } from "./_handlers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { mainBotToken: THIRD_BOT_TOKEN } = await resolveTelegramBotTokens({
    configuredMainToken: Deno.env.get("THIRD_BOT_TOKEN"),
    configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
    expectedMainUsername: THIRD_BOT_USERNAME,
    expectedResaleUsername: RESALE_BOT_USERNAME,
  });

  if (!THIRD_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "Third bot token not configured" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const update = await req.json();
    const msg = update.message;
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id;
      const userId = callbackQuery.from?.id;
      const data = callbackQuery.data;
      if (!userId || !chatId) return new Response("OK", { headers: corsHeaders });

      await upsertTelegramUser(supabase, callbackQuery.from);

      if (data === "third_admin_menu" && (await isThirdBotAdmin(supabase, userId))) {
        await handleAdminMenu(THIRD_BOT_TOKEN, chatId, true);
      }
      if (userId === THIRD_BOT_OWNER_ID && data === "third_owner_promote") {
        await setConversationState(supabase, userId, "third_promote_admin", {});
        await sendMessage(THIRD_BOT_TOKEN, chatId, "➕ <b>Add Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to cancel.");
      }
      return new Response("OK", { headers: corsHeaders });
    }

    if (!msg) return new Response("OK", { headers: corsHeaders });
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text?.trim() || "";
    if (!userId) return new Response("OK", { headers: corsHeaders });

    await upsertTelegramUser(supabase, msg.from);

    if (text === "/start" || text.startsWith("/start ")) {
      await handleStart(THIRD_BOT_TOKEN, supabase, chatId, userId);
      return new Response("OK", { headers: corsHeaders });
    }

    if (text === "/admin" && (await isThirdBotAdmin(supabase, userId))) {
      await handleAdminMenu(THIRD_BOT_TOKEN, chatId);
      return new Response("OK", { headers: corsHeaders });
    }

    if (userId === THIRD_BOT_OWNER_ID && (await handleOwnerCommand(THIRD_BOT_TOKEN, supabase, chatId, userId, text))) {
      return new Response("OK", { headers: corsHeaders });
    }

    const state = await getConversationState(supabase, userId);
    if (state && userId === THIRD_BOT_OWNER_ID) {
      if (await handleStateMessage(THIRD_BOT_TOKEN, supabase, chatId, userId, text, state)) {
        return new Response("OK", { headers: corsHeaders });
      }
    }

    if (text === "/cancel") {
      await deleteConversationState(supabase, userId);
      await sendMessage(THIRD_BOT_TOKEN, chatId, "✅ Cancelled. Send /start to return to main menu.");
      return new Response("OK", { headers: corsHeaders });
    }

    await sendMessage(THIRD_BOT_TOKEN, chatId,
      `I didn't understand that command. 🤔\n\nUse /start to see the main menu or /admin if you're an admin.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📖 Commands", callback_data: "third_help" }],
        [{ text: "🏠 Main Menu", callback_data: "third_menu" }],
      ]}}
    );
    return new Response("OK", { headers: corsHeaders });
  } catch (error) {
    console.error("Third bot error:", error);
    return new Response("OK", { headers: corsHeaders });
  }
});
