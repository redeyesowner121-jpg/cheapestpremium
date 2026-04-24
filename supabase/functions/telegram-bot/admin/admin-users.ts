// ===== ADMIN USER MANAGEMENT =====

import { SUPER_ADMIN_ID } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getWallet, ensureWallet } from "../db-helpers.ts";

export async function handleUsersCommand(token: string, supabase: any, chatId: number) {
  const { count } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { data: recent } = await supabase.from("telegram_bot_users").select("telegram_id, username, first_name, created_at").order("created_at", { ascending: false }).limit(10);

  let text = `👥 <b>Users: ${count || 0}</b>\n\n`;
  recent?.forEach((u: any) => {
    text += `• ${u.username ? "@" + u.username : u.first_name || "?"} (${u.telegram_id})\n`;
  });
  await sendMessage(token, chatId, text);
}

export async function handleHistoryCommand(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/history 123456</code>"); return; }
  const { data: orders } = await supabase.from("telegram_orders").select("*").eq("telegram_user_id", tgId).order("created_at", { ascending: false }).limit(20);
  if (!orders?.length) { await sendMessage(token, chatId, `No orders for ${tgId}.`); return; }

  let text = `📜 <b>History for ${tgId}</b>\n\n`;
  orders.forEach((o: any, i: number) => {
    const statusMap: Record<string, string> = { pending: "⏳", confirmed: "✅", rejected: "❌", shipped: "📦" };
    const e = statusMap[o.status as string] || "📋";
    text += `${i + 1}. ${e} ${o.product_name || "N/A"} - ₹${o.amount}\n`;
  });
  await sendMessage(token, chatId, text);
}

export async function handleBanCommand(token: string, supabase: any, chatId: number, tgId: number, ban: boolean) {
  if (!tgId) { await sendMessage(token, chatId, `⚠️ Usage: <code>/${ban ? "ban" : "unban"} 123456</code>`); return; }
  await supabase.from("telegram_bot_users").update({ is_banned: ban }).eq("telegram_id", tgId);
  await sendMessage(token, chatId, ban ? `🚫 ${tgId} BANNED` : `✅ ${tgId} UNBANNED`);
}

export async function handleMakeReseller(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/make_reseller 123456</code>"); return; }

  const wallet = await getWallet(supabase, tgId);
  if (!wallet) await ensureWallet(supabase, tgId);

  const currentWallet = await getWallet(supabase, tgId);
  const newStatus = !currentWallet?.is_reseller;

  await supabase.from("telegram_wallets").update({ is_reseller: newStatus }).eq("telegram_id", tgId);

  await sendMessage(token, chatId,
    newStatus
      ? `✅ User <code>${tgId}</code> is now a <b>RESELLER</b>!`
      : `❌ User <code>${tgId}</code> reseller status <b>REMOVED</b>.`
  );

  try {
    await sendMessage(token, tgId,
      newStatus
        ? "🎉 You've been granted <b>Reseller</b> status! You can now create resale links on products."
        : "ℹ️ Your reseller status has been removed."
    );
  } catch { /* user may have blocked bot */ }
}

export async function handleAddAdmin(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/add_admin 123456</code>"); return; }

  const { data: existing } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", tgId).maybeSingle();
  if (existing) { await sendMessage(token, chatId, `⚠️ User <code>${tgId}</code> is already an admin.`); return; }

  const { data: user } = await supabase.from("telegram_bot_users").select("username, first_name").eq("telegram_id", tgId).maybeSingle();
  if (!user) { await sendMessage(token, chatId, `❌ User <code>${tgId}</code> not found in bot users.`); return; }

  await supabase.from("telegram_bot_admins").insert({ telegram_id: tgId, added_by: SUPER_ADMIN_ID });

  const name = user.username ? `@${user.username}` : user.first_name || String(tgId);
  await sendMessage(token, chatId, `✅ <b>${name}</b> (<code>${tgId}</code>) is now an <b>Admin</b>!`);

  try {
    await sendMessage(token, tgId, "🎉 You've been granted <b>Admin</b> access on the bot! Use /admin to see commands.");
  } catch { /* user may have blocked bot */ }
}

export async function handleRemoveAdmin(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/remove_admin 123456</code>"); return; }

  if (tgId === SUPER_ADMIN_ID) { await sendMessage(token, chatId, "❌ Cannot remove the Super Admin."); return; }

  const { data: existing } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", tgId).maybeSingle();
  if (!existing) { await sendMessage(token, chatId, `⚠️ User <code>${tgId}</code> is not an admin.`); return; }

  await supabase.from("telegram_bot_admins").delete().eq("telegram_id", tgId);
  await sendMessage(token, chatId, `✅ Admin <code>${tgId}</code> has been <b>removed</b>.`);

  try {
    await sendMessage(token, tgId, "ℹ️ Your admin access has been revoked.");
  } catch { /* user may have blocked bot */ }
}

export async function handleListAdmins(token: string, supabase: any, chatId: number) {
  const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id, created_at").order("created_at", { ascending: true });

  let text = `👑 <b>Admin List</b>\n\n`;
  text += `🔹 <code>${SUPER_ADMIN_ID}</code> — <b>Super Admin (Owner)</b>\n`;

  if (admins?.length) {
    for (const a of admins) {
      const { data: user } = await supabase.from("telegram_bot_users").select("username, first_name").eq("telegram_id", a.telegram_id).maybeSingle();
      const name = user?.username ? `@${user.username}` : user?.first_name || "Unknown";
      text += `🔹 <code>${a.telegram_id}</code> — ${name}\n`;
    }
  }

  text += `\nTotal: <b>${(admins?.length || 0) + 1}</b> admins`;
  await sendMessage(token, chatId, text);
}

export async function handleAllUsers(token: string, supabase: any, chatId: number, page: number) {
  const PAGE_SIZE = 20;
  const offset = page * PAGE_SIZE;

  const { count } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const totalUsers = count || 0;
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

  const { data: users } = await supabase
    .from("telegram_bot_users")
    .select("telegram_id, username, first_name, last_name, is_banned, last_active")
    .order("last_active", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!users?.length) {
    await sendMessage(token, chatId, "📭 No users found.");
    return;
  }

  let text = `👥 <b>All Users</b> (Page ${page + 1}/${totalPages})\n`;
  text += `Total: <b>${totalUsers}</b>\n\n`;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const name = u.username ? `@${u.username}` : `${u.first_name || ""}${u.last_name ? " " + u.last_name : ""}`.trim() || "Unknown";
    const banned = u.is_banned ? " 🚫" : "";
    text += `${offset + i + 1}. ${name}${banned}\n   ID: <code>${u.telegram_id}</code>\n`;
  }

  const buttons: any[][] = [];
  const navRow: any[] = [];
  if (page > 0) navRow.push({ text: "⬅️ Previous", callback_data: `allusers_page_${page - 1}` });
  if (page < totalPages - 1) navRow.push({ text: "Next ➡️", callback_data: `allusers_page_${page + 1}` });
  if (navRow.length) buttons.push(navRow);

  await sendMessage(token, chatId, text, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : undefined);
}
