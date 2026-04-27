// ===== CALLBACK QUERY ROUTER =====
// Handles all callback_query updates and dispatches to the right handler.

import { sendMessage, answerCallbackQuery } from "./telegram-api.ts";
import { t } from "./constants.ts";
import {
  upsertTelegramUser, ensureWallet, isAdminBot, setUserLang, getUserData,
} from "./db-helpers.ts";
import { handleAdminCallbacks } from "./callbacks/admin-callbacks.ts";
import { handlePaymentCallbacks } from "./callbacks/payment-callbacks.ts";
import { handleMenuCallbacks } from "./callbacks/menu-callbacks.ts";
import {
  handleGiveawayCallbacks, handleGiveawayAdminCallbacks,
  showGiveawayMainMenu,
} from "./giveaway-handlers.ts";
import { clearChildBotContext } from "./child-context.ts";

type RouteCtx = {
  BOT_TOKEN: string;
  supabase: any;
  isGiveaway: boolean;
  isChildMode: boolean;
  childBotId: string | null;
};

export async function handleCallbackQuery(cq: any, ctx: RouteCtx): Promise<void> {
  const { BOT_TOKEN, supabase, isGiveaway, isChildMode, childBotId } = ctx;
  const chatId = cq.message.chat.id;
  const data = cq.data;
  const telegramUser = cq.from;
  const userId = telegramUser.id;

  const upsertPromises: Promise<any>[] = [
    getUserData(supabase, userId),
    upsertTelegramUser(supabase, telegramUser),
    answerCallbackQuery(BOT_TOKEN, cq.id),
  ];

  if (isChildMode && childBotId) {
    upsertPromises.push(
      Promise.resolve(supabase.from("child_bot_users").upsert({
        child_bot_id: childBotId,
        telegram_id: userId,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_active: new Date().toISOString(),
      }, { onConflict: "child_bot_id,telegram_id" }))
    );
  }

  const [userData] = await Promise.all(upsertPromises);

  if (userData.is_banned) { clearChildBotContext(); return; }
  const lang = userData.language || "en";

  // Giveaway-specific callbacks (before menu callbacks to override back_main)
  if (isGiveaway && await handleGiveawayAdminCallbacks(BOT_TOKEN, supabase, chatId, userId, data)) { clearChildBotContext(); return; }
  if (isGiveaway && await handleGiveawayCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) { clearChildBotContext(); return; }

  // For giveaway mode, override back_main to show giveaway menu
  if (isGiveaway && data === "back_main") {
    await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId);
    clearChildBotContext();
    return;
  }

  // Giveaway language selection override
  if (isGiveaway && (data === "lang_en" || data === "lang_bn")) {
    const selectedLang = data === "lang_en" ? "en" : "bn";
    await setUserLang(supabase, userId, selectedLang);
    await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
    const MAIN_TOKEN_FOR_CHECK = Deno.env.get("TELEGRAM_BOT_TOKEN") || BOT_TOKEN;
    const { checkGiveawayChannels } = await import("./giveaway-handlers.ts");
    const joined = await checkGiveawayChannels(MAIN_TOKEN_FOR_CHECK, userId);
    if (!joined) {
      const { showGiveawayJoinChannels } = await import("./giveaway-handlers.ts");
      await showGiveawayJoinChannels(BOT_TOKEN, supabase, chatId, selectedLang, userId);
    } else {
      await ensureWallet(supabase, userId);
      await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, selectedLang, userId);
    }
    clearChildBotContext();
    return;
  }

  // Standard callbacks
  if (await handleAdminCallbacks(BOT_TOKEN, supabase, chatId, userId, data)) { clearChildBotContext(); return; }
  if (await handlePaymentCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) { clearChildBotContext(); return; }

  // Escrow callbacks
  if (data === "escrow_menu" || data === "escrow_new" || data === "escrow_list_active" || data === "escrow_list_closed") {
    await sendMessage(BOT_TOKEN, chatId,
      `🔒 <b>Escrow not available in bot</b>\n\nEscrow deals are available only on our website. Tap below to log in — your wallet balance, orders, and other data will sync automatically.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 Website Login", callback_data: "website_login", style: "primary" }],
          ],
        },
      }
    );
    clearChildBotContext(); return;
  }
  if (data.startsWith("escrow_view_")) {
    const { escrowViewDeal } = await import("./escrow-handler.ts");
    await escrowViewDeal(BOT_TOKEN, supabase, chatId, userId, data.slice(12), cq.message.message_id);
    clearChildBotContext(); return;
  }
  if (data.startsWith("escrow_deliver_skip_")) {
    const { escrowDeliverSkip } = await import("./escrow-handler.ts");
    await escrowDeliverSkip(BOT_TOKEN, supabase, chatId, userId, data.slice(20), cq.id);
    clearChildBotContext(); return;
  }
  const escrowActionMatch = data.match(/^escrow_(accept|decline|cancel|buyer_cancel|deliver|release|dispute|chat)_(.+)$/);
  if (escrowActionMatch) {
    const { escrowAction } = await import("./escrow-handler.ts");
    await escrowAction(BOT_TOKEN, supabase, chatId, userId, escrowActionMatch[1], escrowActionMatch[2], cq.id, cq.message.message_id);
    clearChildBotContext(); return;
  }

  // Apply (reseller/wholesaler) callbacks
  if (data === "apply_type_reseller" || data === "apply_type_wholesaler") {
    const { handleApplyTypeChoice } = await import("./apply-handler.ts");
    const appType = data === "apply_type_wholesaler" ? "wholesaler" : "reseller";
    await handleApplyTypeChoice(BOT_TOKEN, supabase, chatId, userId, appType, lang);
    clearChildBotContext(); return;
  }
  if (data.startsWith("apply_approve_") || data.startsWith("apply_reject_")) {
    if (!await isAdminBot(supabase, userId)) {
      clearChildBotContext(); return;
    }
    const isApprove = data.startsWith("apply_approve_");
    const appId = data.slice(isApprove ? 14 : 13);
    const { handleApplyApprove, handleApplyReject } = await import("./apply-handler.ts");
    if (isApprove) await handleApplyApprove(BOT_TOKEN, supabase, chatId, userId, appId);
    else await handleApplyReject(BOT_TOKEN, supabase, chatId, userId, appId);
    clearChildBotContext(); return;
  }

  if (await handleMenuCallbacks(BOT_TOKEN, supabase, chatId, userId, data, telegramUser, lang)) { clearChildBotContext(); return; }

  clearChildBotContext();
}
