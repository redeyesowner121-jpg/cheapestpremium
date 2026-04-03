// ===== ADMIN CALLBACK ROUTING =====
import { sendMessage } from "../telegram-api.ts";
import { isSuperAdmin, isAdminBot, setConversationState } from "../db-helpers.ts";
import {
  handleAdminMenu, handleReport,
  handleAdminProductsMenu, handleAdminUsersMenu, handleAdminWalletMenu,
  handleAdminChannelsMenu, handleAdminOwnerMenu,
  handleAdminSettingsMenu, handleSettingsCategory, promptSettingEdit, saveSetting,
  handleAITrainingMenu, startTrainingCategory, handleViewKnowledge,
  startDeleteKnowledge, executeDeleteKnowledge,
  handleUsersCommand, handleAllUsers, handleListChannels, handleListAdmins,
} from "../admin-handlers.ts";

export async function handleAdminCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string
): Promise<boolean> {
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
    await sendMessage(BOT_TOKEN, chatId, "✏️ <b>Edit Price</b>\n\nProduct নাম এবং নতুন দাম লিখুন:\n<code>Netflix 199</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_out_stock") {
    await setConversationState(supabase, userId, "admin_out_stock", {});
    await sendMessage(BOT_TOKEN, chatId, "❌ <b>Out of Stock</b>\n\nProduct নাম লিখুন:\n<code>Netflix</code>\n\n/cancel করলে বাতিল।");
    return true;
  }

  // User sub-actions
  if (data === "adm_recent_users") { await handleUsersCommand(BOT_TOKEN, supabase, chatId); return true; }
  if (data === "adm_all_users") { await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); return true; }
  if (data === "adm_history") {
    await setConversationState(supabase, userId, "admin_history", {});
    await sendMessage(BOT_TOKEN, chatId, "📜 <b>Order History</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_make_reseller") {
    await setConversationState(supabase, userId, "admin_make_reseller", {});
    await sendMessage(BOT_TOKEN, chatId, "🔄 <b>Make Reseller</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_ban") {
    await setConversationState(supabase, userId, "admin_ban_user", {});
    await sendMessage(BOT_TOKEN, chatId, "🚫 <b>Ban User</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_unban") {
    await setConversationState(supabase, userId, "admin_unban_user", {});
    await sendMessage(BOT_TOKEN, chatId, "✅ <b>Unban User</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
    return true;
  }

  // Wallet sub-actions
  if (data === "adm_add_balance") {
    await setConversationState(supabase, userId, "admin_add_balance", {});
    await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Balance</b>\n\nUser ID এবং Amount লিখুন:\n<code>123456789 500</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_deduct_balance") {
    await setConversationState(supabase, userId, "admin_deduct_balance", {});
    await sendMessage(BOT_TOKEN, chatId, "➖ <b>Deduct Balance</b>\n\nUser ID এবং Amount লিখুন:\n<code>123456789 500</code>\n\n/cancel করলে বাতিল।");
    return true;
  }

  // Channel sub-actions
  if (data === "adm_list_channels") { await handleListChannels(BOT_TOKEN, supabase, chatId); return true; }
  if (data === "adm_add_channel") {
    await setConversationState(supabase, userId, "admin_add_channel", {});
    await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Channel</b>\n\nChannel username লিখুন:\n<code>@channel_name</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_remove_channel") {
    await setConversationState(supabase, userId, "admin_remove_channel", {});
    await sendMessage(BOT_TOKEN, chatId, "➖ <b>Remove Channel</b>\n\nChannel username লিখুন:\n<code>@channel_name</code>\n\n/cancel করলে বাতিল।");
    return true;
  }

  // Owner sub-actions
  if (data === "adm_add_admin") {
    await setConversationState(supabase, userId, "admin_add_admin", {});
    await sendMessage(BOT_TOKEN, chatId, "➕ <b>Add Admin</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
    return true;
  }
  if (data === "adm_remove_admin") {
    await setConversationState(supabase, userId, "admin_remove_admin", {});
    await sendMessage(BOT_TOKEN, chatId, "➖ <b>Remove Admin</b>\n\nUser ID লিখুন:\n<code>123456789</code>\n\n/cancel করলে বাতিল।");
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
