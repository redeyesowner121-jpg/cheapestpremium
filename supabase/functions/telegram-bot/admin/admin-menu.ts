// ===== ADMIN MENU & REPORT =====

import { SUPER_ADMIN_ID } from "../constants.ts";
import { sendMessage, sendPhoto } from "../telegram-api.ts";

export async function handleAdminMenu(token: string, supabase: any, chatId: number) {
  const { count: userCount } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: orderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { count: walletCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true });
  const { count: resellerCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true }).eq("is_reseller", true);

  await sendMessage(token, chatId,
    `🔐 <b>Admin Control Panel</b>\n\n` +
    `👥 Bot Users: <b>${userCount || 0}</b>\n` +
    `📦 Orders: <b>${orderCount || 0}</b>\n` +
    `💰 Wallets: <b>${walletCount || 0}</b>\n` +
    `🔄 Resellers: <b>${resellerCount || 0}</b>\n\n` +
    `<b>📋 All Commands:</b>\n\n` +
    `<b>📢 Broadcast & Analytics:</b>\n` +
    `/broadcast - Broadcast to all\n` +
    `/report or /stats - Analytics\n\n` +
    `<b>📦 Product Management:</b>\n` +
    `/add_product - Add product\n` +
    `/edit_price [name] [price]\n` +
    `/out_stock [name]\n\n` +
    `<b>👥 User Management:</b>\n` +
    `/users - Recent users\n` +
    `/allusers - All users list\n` +
    `/history [id] - Order history\n` +
    `/ban [id] / /unban [id]\n` +
    `/make_reseller [id]\n\n` +
    `<b>💰 Wallet Management:</b>\n` +
    `/add_balance [id] [amount]\n` +
    `/deduct_balance [id] [amount]\n\n` +
    `<b>📢 Channel Management:</b>\n` +
    `/channels - List required channels\n` +
    `/add_channel @channel - Add channel\n` +
    `/remove_channel @channel - Remove\n\n` +
    `<b>👑 Owner Only:</b>\n` +
    `/add_admin [id] - Add admin\n` +
    `/remove_admin [id] - Remove admin\n` +
    `/admins - List admins`
  );
}

export async function handleReport(token: string, supabase: any, chatId: number) {
  const { count: totalUsers } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { count: totalWallets } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true });
  const { count: resellerCount } = await supabase.from("telegram_wallets").select("*", { count: "exact", head: true }).eq("is_reseller", true);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const { count: todayOrderCount } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString());
  const { data: confirmedToday } = await supabase.from("telegram_orders").select("amount").eq("status", "confirmed").gte("created_at", today.toISOString());
  const todayRevenue = confirmedToday?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;

  const { count: allOrders } = await supabase.from("telegram_orders").select("*", { count: "exact", head: true });
  const { data: allConfirmed } = await supabase.from("telegram_orders").select("amount").eq("status", "confirmed");
  const allRevenue = allConfirmed?.reduce((s: number, o: any) => s + (o.amount || 0), 0) || 0;

  const { data: walletSum } = await supabase.from("telegram_wallets").select("balance");
  const totalWalletBalance = walletSum?.reduce((s: number, w: any) => s + (w.balance || 0), 0) || 0;

  await sendMessage(token, chatId,
    `📊 <b>Sales & Analytics Report</b>\n\n` +
    `👥 Users: <b>${totalUsers || 0}</b>\n` +
    `💰 Wallets: <b>${totalWallets || 0}</b>\n` +
    `🔄 Resellers: <b>${resellerCount || 0}</b>\n` +
    `💵 Total Wallet Balance: <b>₹${totalWalletBalance}</b>\n\n` +
    `📅 <b>Today:</b>\n• Orders: ${todayOrderCount || 0}\n• Revenue: ₹${todayRevenue}\n\n` +
    `📈 <b>All Time:</b>\n• Orders: ${allOrders || 0}\n• Revenue: ₹${allRevenue}`
  );
}

export async function executeBroadcast(token: string, supabase: any, adminChatId: number, msg: any) {
  const { data: users } = await supabase.from("telegram_bot_users").select("telegram_id").eq("is_banned", false);
  if (!users?.length) { await sendMessage(token, adminChatId, "No users to broadcast to."); return; }

  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      if (user.telegram_id === SUPER_ADMIN_ID) { sent++; continue; }
      if (msg.photo) {
        await sendPhoto(token, user.telegram_id, msg.photo[msg.photo.length - 1].file_id, msg.caption || "");
      } else if (msg.text) {
        await sendMessage(token, user.telegram_id, msg.text);
      }
      sent++;
    } catch { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }
  await sendMessage(token, adminChatId, `📢 <b>Broadcast Complete!</b>\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
}
