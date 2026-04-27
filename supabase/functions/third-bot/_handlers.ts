import { sendMessage, THIRD_BOT_OWNER_ID } from "./_helpers.ts";
import { isThirdBotAdmin, setConversationState, deleteConversationState } from "./_db.ts";

export async function handleStart(token: string, supabase: any, chatId: number, userId: number) {
  await deleteConversationState(supabase, userId);
  const isAdmin = await isThirdBotAdmin(supabase, userId);
  const isOwner = userId === THIRD_BOT_OWNER_ID;

  if (isOwner) {
    await supabase.from("telegram_bot_admins").upsert({ telegram_id: userId, role: "owner" }, { onConflict: "telegram_id" });
    const text = isAdmin
      ? `👋 <b>Welcome Back, Owner!</b>\n\n🤖 This is your dedicated Third Store Bot.\n\nYou have full admin access.`
      : `👋 <b>Welcome, Owner!</b>\n\n🤖 Third Store Bot is ready!\n\nYou have been set as the bot owner.`;
    await sendMessage(token, chatId, text, {
      reply_markup: { inline_keyboard: [
        [{ text: "🔧 Admin Panel", callback_data: "third_admin_menu", style: "danger" }],
        [{ text: "📦 Store", callback_data: "third_store", style: "primary" }],
        [{ text: "ℹ️ Help", callback_data: "third_help" }],
      ]},
    });
    return;
  }

  if (isAdmin) {
    await sendMessage(token, chatId, `👋 <b>Welcome, Admin!</b>\n\nYou have admin access to this bot.`, {
      reply_markup: { inline_keyboard: [
        [{ text: "🔧 Admin Panel", callback_data: "third_admin_menu" }],
        [{ text: "📦 Store", callback_data: "third_store" }],
      ]},
    });
    return;
  }

  await sendMessage(token, chatId,
    `👋 <b>Welcome to Third Store Bot!</b>\n\n🛍️ Premium digital products at great prices\n⚡ Instant delivery\n🔒 Secure payments\n💬 24/7 Support\n\nWhat would you like to do?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "🛍️ View Store", callback_data: "third_store", style: "primary" }],
      [{ text: "📦 My Orders", callback_data: "third_orders", style: "success" }],
      [{ text: "💰 My Wallet", callback_data: "third_wallet_user", style: "success" }],
      [{ text: "ℹ️ Help", callback_data: "third_help" }],
    ]}}
  );
}

const ADMIN_MENU = {
  reply_markup: { inline_keyboard: [
    [{ text: "📊 Analytics", callback_data: "third_analytics", style: "primary" }],
    [{ text: "🛍️ Products", callback_data: "third_products", style: "success" }, { text: "👥 Users", callback_data: "third_users", style: "primary" }],
    [{ text: "💰 Wallet", callback_data: "third_wallet", style: "success" }, { text: "📢 Channels", callback_data: "third_channels", style: "primary" }],
    [{ text: "⚙️ Settings", callback_data: "third_settings", style: "success" }],
  ]},
};

export async function handleAdminMenu(token: string, chatId: number, withBack = false) {
  const kb = withBack
    ? { reply_markup: { inline_keyboard: [...ADMIN_MENU.reply_markup.inline_keyboard, [{ text: "⬅️ Back", callback_data: "third_back", color: "red" }]] } }
    : ADMIN_MENU;
  await sendMessage(token, chatId, "🔧 <b>Admin Panel</b>\n\nSelect an option:", kb);
}

export async function handleOwnerCommand(token: string, supabase: any, chatId: number, userId: number, text: string): Promise<boolean> {
  if (text === "/promote") {
    await setConversationState(supabase, userId, "third_promote_admin", {});
    await sendMessage(token, chatId, "➕ <b>Promote to Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to cancel.");
    return true;
  }
  if (text === "/demote") {
    await setConversationState(supabase, userId, "third_demote_admin", {});
    await sendMessage(token, chatId, "➖ <b>Remove Admin</b>\n\nEnter User ID:\n<code>123456789</code>\n\n/cancel to cancel.");
    return true;
  }
  if (text === "/admins") {
    const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id, role");
    const adminList = admins?.map((a: any) => `${a.telegram_id} (${a.role})`).join("\n") || "No admins yet";
    await sendMessage(token, chatId, `<b>Bot Admins:</b>\n\n${adminList}`);
    return true;
  }
  if (text === "/info") {
    const { count: userCount } = await supabase.from("telegram_bot_users").select("*", { count: "exact" });
    const { count: productCount } = await supabase.from("products").select("*", { count: "exact" });
    await sendMessage(token, chatId, `📊 <b>Bot Stats</b>\n\n👥 Users: ${userCount}\n📦 Products: ${productCount}`);
    return true;
  }
  return false;
}

export async function handleStateMessage(token: string, supabase: any, chatId: number, userId: number, text: string, state: { step: string; data: any }): Promise<boolean> {
  if (state.step === "third_promote_admin") {
    const adminId = parseInt(text);
    if (isNaN(adminId)) {
      await sendMessage(token, chatId, "❌ Invalid User ID. Please enter a valid number.");
      return true;
    }
    await supabase.from("telegram_bot_admins").upsert({ telegram_id: adminId, role: "admin" }, { onConflict: "telegram_id" });
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, `✅ User ${adminId} has been promoted to admin.`);
    return true;
  }
  if (state.step === "third_demote_admin") {
    const adminId = parseInt(text);
    if (isNaN(adminId) || adminId === THIRD_BOT_OWNER_ID) {
      await sendMessage(token, chatId, "❌ Cannot remove owner or invalid ID.");
      return true;
    }
    await supabase.from("telegram_bot_admins").delete().eq("telegram_id", adminId);
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, `✅ User ${adminId} has been removed from admins.`);
    return true;
  }
  return false;
}
