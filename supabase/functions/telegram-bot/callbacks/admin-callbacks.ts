// ===== ADMIN CALLBACK ROUTING =====
import { sendMessage } from "../telegram-api.ts";
import { isSuperAdmin, isAdminBot, setConversationState } from "../db-helpers.ts";
import { logProof, formatWithdrawalUpdate } from "../proof-logger.ts";
import { isChildBotMode } from "../child-context.ts";
import {
  handleAdminMenu, handleReport,
  handleAdminProductsMenu, handleAdminUsersMenu, handleAdminWalletMenu,
  handleAdminChannelsMenu, handleAdminOwnerMenu,
  handleAdminSettingsMenu, handleSettingsCategory, promptSettingEdit, saveSetting,
  handleAITrainingMenu, startTrainingCategory, handleViewKnowledge,
  startDeleteKnowledge, executeDeleteKnowledge,
  handleUsersCommand, handleAllUsers, handleListChannels, handleListAdmins,
  // Child bot admin
  isChildBotOwner, handleChildBotAdminMenu, handleChildBotSettingsMenu,
  promptChildBotSettingEdit, handleChildBotAnalytics, handleChildBotUsers, handleChildBotOrders,
} from "../admin-handlers.ts";

export async function handleAdminCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string
): Promise<boolean> {

  // ===== WITHDRAWAL ACTION BUTTONS =====
  if (data.startsWith("wd_accept_") || data.startsWith("wd_reject_") || data.startsWith("wd_delivered_")) {
    if (!await isAdminBot(supabase, userId)) return true;
    const action = data.startsWith("wd_accept_") ? "accepted" : data.startsWith("wd_reject_") ? "rejected" : "delivered";
    const wdId = data.replace(/^wd_(accept|reject|delivered)_/, "");

    const { data: wd } = await supabase.from("withdrawal_requests").select("*").eq("id", wdId).single();
    if (!wd) { await sendMessage(BOT_TOKEN, chatId, "❌ Withdrawal request not found."); return true; }

    if (wd.status !== "pending" && action !== "delivered") {
      await sendMessage(BOT_TOKEN, chatId, `⚠️ Already ${wd.status}.`);
      return true;
    }
    if (action === "delivered" && wd.status !== "accepted") {
      if (wd.status === "pending") {
        await sendMessage(BOT_TOKEN, chatId, "⚠️ Please Accept first before marking Delivered.");
        return true;
      }
      await sendMessage(BOT_TOKEN, chatId, `⚠️ Already ${wd.status}.`);
      return true;
    }

    if (action === "accepted") {
      // Deduct wallet balance from telegram wallet
      const { data: wallet } = await supabase.from("telegram_wallets").select("balance").eq("telegram_id", wd.telegram_id).single();
      if (!wallet || wallet.balance < wd.amount) {
        await sendMessage(BOT_TOKEN, chatId, `⚠️ User has insufficient wallet balance (₹${wallet?.balance || 0}).`);
        return true;
      }
      await supabase.from("telegram_wallets").update({
        balance: Math.max(0, wallet.balance - wd.amount),
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", wd.telegram_id);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: wd.telegram_id,
        type: "withdrawal",
        amount: -wd.amount,
        description: `Withdrawal via ${wd.method.toUpperCase()} to ${wd.account_details}`,
      });

      await supabase.from("withdrawal_requests").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", wdId);

      // Notify user
      await sendMessage(BOT_TOKEN, wd.telegram_id,
        `✅ <b>Withdrawal Accepted!</b>\n\n💰 Amount: <b>₹${wd.amount}</b>\n💳 ${wd.method.toUpperCase()}: <code>${wd.account_details}</code>\n\n⏳ Payment will be sent shortly.`
      );

      await sendMessage(BOT_TOKEN, chatId,
        `✅ <b>Withdrawal Accepted</b>\n\n👤 <code>${wd.telegram_id}</code>\n💰 ₹${wd.amount} deducted\n💳 ${wd.method.toUpperCase()}: <code>${wd.account_details}</code>`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📦 Mark Delivered", callback_data: `wd_delivered_${wdId}`, style: "success" }],
            ],
          },
        }
      );

      let wName = "User"; try { const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", wd.telegram_id).single(); if (bu?.first_name) wName = bu.first_name; } catch {}
      try { await logProof(BOT_TOKEN, formatWithdrawalUpdate(wd.telegram_id, wd.amount, wd.method, "accepted", wd.account_details, wName)); } catch {}

      // Notify other admins
      const { notifyAllAdmins } = await import("../db-helpers.ts");
      try {
        await notifyAllAdmins(BOT_TOKEN, supabase,
          `💸 Withdrawal <b>Accepted</b> by admin <code>${userId}</code>\n👤 User: <code>${wd.telegram_id}</code> | ₹${wd.amount}`,
          undefined, userId
        );
      } catch {}
    } else if (action === "rejected") {
      await supabase.from("withdrawal_requests").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", wdId);

      await sendMessage(BOT_TOKEN, wd.telegram_id,
        `❌ <b>Withdrawal Rejected</b>\n\n💰 Amount: <b>₹${wd.amount}</b>\n💳 ${wd.method.toUpperCase()}: <code>${wd.account_details}</code>\n\nPlease contact support if you have questions.`
      );

      await sendMessage(BOT_TOKEN, chatId, `❌ Withdrawal ₹${wd.amount} for user <code>${wd.telegram_id}</code> rejected.`);
    } else if (action === "delivered") {
      await supabase.from("withdrawal_requests").update({ status: "delivered", updated_at: new Date().toISOString() }).eq("id", wdId);

      await sendMessage(BOT_TOKEN, wd.telegram_id,
        `📦 <b>Withdrawal Delivered!</b>\n\n💰 Amount: <b>₹${wd.amount}</b>\n💳 Sent to: <code>${wd.account_details}</code> (${wd.method.toUpperCase()})\n\n✅ Payment has been completed!`
      );

      await sendMessage(BOT_TOKEN, chatId, `📦 Withdrawal ₹${wd.amount} for user <code>${wd.telegram_id}</code> marked as delivered.`);

      let wdName = "User"; try { const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", wd.telegram_id).single(); if (bu?.first_name) wdName = bu.first_name; } catch {}
      try { await logProof(BOT_TOKEN, formatWithdrawalUpdate(wd.telegram_id, wd.amount, wd.method, "delivered", wd.account_details, wdName)); } catch {}
    }
    return true;
  }

  if (!data.startsWith("adm_")) return false;
  if (!await isAdminBot(supabase, userId)) return true;

  if (data === "adm_back") { await handleAdminMenu(BOT_TOKEN, supabase, chatId, userId); return true; }
  if (data === "adm_products") { await handleAdminProductsMenu(BOT_TOKEN, chatId); return true; }
  if (data === "adm_users") { await handleAdminUsersMenu(BOT_TOKEN, chatId); return true; }
  if (data === "adm_wallet") { await handleAdminWalletMenu(BOT_TOKEN, chatId); return true; }
  if (data === "adm_analytics") { await handleReport(BOT_TOKEN, supabase, chatId); return true; }
  if (data === "adm_channels") { await handleAdminChannelsMenu(BOT_TOKEN, chatId); return true; }
  if (data === "adm_settings") { await handleAdminSettingsMenu(BOT_TOKEN, chatId); return true; }
  if (data === "adm_owner") {
    if (!isSuperAdmin(userId)) return true;
    await handleAdminOwnerMenu(BOT_TOKEN, chatId);
    return true;
  }

  if (data === "adm_broadcast") {
    await setConversationState(supabase, userId, "broadcast_message", {});
    await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel.");
    return true;
  }

  // Product sub-actions
  if (data === "adm_add_product") {
    await setConversationState(supabase, userId, "add_photo", {});
    await sendMessage(BOT_TOKEN, chatId, "📸 <b>Add Product (Step 1/4)</b>\n\nSend the product photo.\n/cancel to cancel.");
    return true;
  }
  if (data === "adm_edit_price") {
    await setConversationState(supabase, userId, "admin_edit_price", {});
    await sendMessage(BOT_TOKEN, chatId, "✏️ <b>Edit Price</b>\n\nEnter product name and new price:\n<code>Netflix 199</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_out_stock") {
    await setConversationState(supabase, userId, "admin_out_stock", {});
    await sendMessage(BOT_TOKEN, chatId, "❌ <b>Out of Stock</b>\n\nEnter product name:\n<code>Netflix</code>\n\n/cancel to abort.");
    return true;
  }

  // User sub-actions
  if (data === "adm_recent_users") { await handleUsersCommand(BOT_TOKEN, supabase, chatId); return true; }
  if (data === "adm_all_users") { await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); return true; }
  if (data === "adm_history") {
    await setConversationState(supabase, userId, "admin_history", {});
    await sendMessage(BOT_TOKEN, chatId, "📜 <b>Order History</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_make_reseller") {
    await setConversationState(supabase, userId, "admin_make_reseller", {});
    await sendMessage(BOT_TOKEN, chatId, "🔄 <b>Make Reseller</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_ban") {
    await setConversationState(supabase, userId, "admin_ban_user", {});
    await sendMessage(BOT_TOKEN, chatId, "🚫 <b>Ban User</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_unban") {
    await setConversationState(supabase, userId, "admin_unban_user", {});
    await sendMessage(BOT_TOKEN, chatId, "✅ <b>Unban User</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to abort.");
    return true;
  }

  // Wallet sub-actions
  if (data === "adm_add_balance") {
    await setConversationState(supabase, userId, "admin_add_balance", {});
    await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Balance</b>\n\nEnter User ID and Amount:\n<code>123456789 500</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_deduct_balance") {
    await setConversationState(supabase, userId, "admin_deduct_balance", {});
    await sendMessage(BOT_TOKEN, chatId, "➖ <b>Deduct Balance</b>\n\nEnter User ID and Amount:\n<code>123456789 500</code>\n\n/cancel to abort.");
    return true;
  }

  // Channel sub-actions
  if (data === "adm_list_channels") { await handleListChannels(BOT_TOKEN, supabase, chatId); return true; }
  if (data === "adm_add_channel") {
    await setConversationState(supabase, userId, "admin_add_channel", {});
    await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Channel</b>\n\nEnter channel username:\n<code>@channel_name</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_remove_channel") {
    await setConversationState(supabase, userId, "admin_remove_channel", {});
    await sendMessage(BOT_TOKEN, chatId, "➖ <b>Remove Channel</b>\n\nEnter channel username:\n<code>@channel_name</code>\n\n/cancel to abort.");
    return true;
  }

  // Owner sub-actions
  if (data === "adm_add_admin") {
    await setConversationState(supabase, userId, "admin_add_admin", {});
    await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_remove_admin") {
    await setConversationState(supabase, userId, "admin_remove_admin", {});
    await sendMessage(BOT_TOKEN, chatId, "➖ <b>Remove Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to abort.");
    return true;
  }
  if (data === "adm_list_admins") { await handleListAdmins(BOT_TOKEN, supabase, chatId); return true; }

  // Settings categories
  if (data === "adm_set_payment") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "payment"); return true; }
  if (data === "adm_set_bonus") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "bonus"); return true; }
  if (data === "adm_set_store") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "store"); return true; }
  if (data === "adm_set_bot") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "bot"); return true; }
  if (data === "adm_set_security") { await handleSettingsCategory(BOT_TOKEN, supabase, chatId, "security"); return true; }

  // Individual setting edit
  if (data.startsWith("adm_edit_set_")) {
    const settingKey = data.replace("adm_edit_set_", "");
    await setConversationState(supabase, userId, "admin_edit_setting", { settingKey });
    await promptSettingEdit(BOT_TOKEN, supabase, chatId, settingKey);
    return true;
  }

  // AI Training
  if (data === "adm_ai_training") { await handleAITrainingMenu(BOT_TOKEN, supabase, chatId); return true; }

  return true;
}
