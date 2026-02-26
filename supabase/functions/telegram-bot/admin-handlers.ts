// ===== ADMIN COMMAND HANDLERS =====

import { SUPER_ADMIN_ID } from "./constants.ts";
import { sendMessage, sendPhoto } from "./telegram-api.ts";
import { getWallet, ensureWallet, getSettings } from "./db-helpers.ts";


// ===== ADMIN MENU =====

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
    `<b>Commands:</b>\n` +
    `/broadcast - Broadcast to all\n` +
    `/report or /stats - Analytics\n` +
    `/add_product - Add product\n` +
    `/edit_price [name] [price]\n` +
    `/out_stock [name]\n` +
    `/users - Recent users\n` +
    `/allusers - All users list\n` +
    `/history [id] - Order history\n` +
    `/ban [id] / /unban [id]\n` +
    `/make_reseller [id]\n` +
    `/add_balance [id] [amount]\n` +
    `/deduct_balance [id] [amount]\n` +
    `/add_admin [id] - Add admin (Owner only)\n` +
    `/remove_admin [id] - Remove admin (Owner only)\n` +
    `/admins - List admins (Owner only)`
  );
}

// ===== REPORT =====

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

// ===== BROADCAST =====

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

// ===== EDIT PRICE =====

export async function handleEditPrice(token: string, supabase: any, chatId: number, args: string) {
  const lastSpace = args.lastIndexOf(" ");
  if (lastSpace === -1) { await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>"); return; }
  const name = args.substring(0, lastSpace).trim();
  const newPrice = parseFloat(args.substring(lastSpace + 1));
  if (!name || isNaN(newPrice)) { await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Name 199</code>"); return; }

  const { data, error } = await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).ilike("name", `%${name}%`).select("name, price");
  if (error || !data?.length) { await sendMessage(token, chatId, `❌ "${name}" not found.`); }
  else { await sendMessage(token, chatId, `✅ ${data[0].name} → ₹${newPrice}`); }
}

// ===== OUT STOCK =====

export async function handleOutStock(token: string, supabase: any, chatId: number, name: string) {
  if (!name) { await sendMessage(token, chatId, "⚠️ Usage: <code>/out_stock Name</code>"); return; }
  const { data, error } = await supabase.from("products").update({ stock: 0, is_active: false }).ilike("name", `%${name}%`).select("name");
  if (error || !data?.length) { await sendMessage(token, chatId, `❌ "${name}" not found.`); }
  else { await sendMessage(token, chatId, `✅ ${data[0].name} → Out of Stock`); }
}

// ===== USERS =====

export async function handleUsersCommand(token: string, supabase: any, chatId: number) {
  const { count } = await supabase.from("telegram_bot_users").select("*", { count: "exact", head: true });
  const { data: recent } = await supabase.from("telegram_bot_users").select("telegram_id, username, first_name, created_at").order("created_at", { ascending: false }).limit(10);

  let text = `👥 <b>Users: ${count || 0}</b>\n\n`;
  recent?.forEach((u: any) => {
    text += `• ${u.username ? "@" + u.username : u.first_name || "?"} (${u.telegram_id})\n`;
  });
  await sendMessage(token, chatId, text);
}

// ===== HISTORY =====

export async function handleHistoryCommand(token: string, supabase: any, chatId: number, tgId: number) {
  if (!tgId) { await sendMessage(token, chatId, "⚠️ Usage: <code>/history 123456</code>"); return; }
  const { data: orders } = await supabase.from("telegram_orders").select("*").eq("telegram_user_id", tgId).order("created_at", { ascending: false }).limit(20);
  if (!orders?.length) { await sendMessage(token, chatId, `No orders for ${tgId}.`); return; }

  let text = `📜 <b>History for ${tgId}</b>\n\n`;
  orders.forEach((o: any, i: number) => {
    const e = { pending: "⏳", confirmed: "✅", rejected: "❌", shipped: "📦" }[o.status] || "📋";
    text += `${i + 1}. ${e} ${o.product_name || "N/A"} - ₹${o.amount}\n`;
  });
  await sendMessage(token, chatId, text);
}

// ===== BAN =====

export async function handleBanCommand(token: string, supabase: any, chatId: number, tgId: number, ban: boolean) {
  if (!tgId) { await sendMessage(token, chatId, `⚠️ Usage: <code>/${ban ? "ban" : "unban"} 123456</code>`); return; }
  await supabase.from("telegram_bot_users").update({ is_banned: ban }).eq("telegram_id", tgId);
  await sendMessage(token, chatId, ban ? `🚫 ${tgId} BANNED` : `✅ ${tgId} UNBANNED`);
}

// ===== MAKE RESELLER =====

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

// ===== ADD ADMIN =====

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

// ===== REMOVE ADMIN =====

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

// ===== LIST ADMINS =====

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

// ===== DEDUCT BALANCE =====

export async function handleDeductBalance(token: string, supabase: any, chatId: number, tgId: number, amount: number) {
  if (!tgId || isNaN(amount) || amount <= 0) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/deduct_balance 123456 500</code>");
    return;
  }

  const wallet = await getWallet(supabase, tgId);
  if (!wallet) {
    await sendMessage(token, chatId, `❌ User <code>${tgId}</code> has no wallet.`);
    return;
  }

  if (wallet.balance < amount) {
    await sendMessage(token, chatId, `❌ Insufficient balance. User has ₹${wallet.balance}.`);
    return;
  }

  await supabase.from("telegram_wallets").update({
    balance: wallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", tgId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: tgId,
    amount: -amount,
    type: "admin_deduction",
    description: `Admin deducted ₹${amount}`,
  });

  const newBalance = wallet.balance - amount;
  await sendMessage(token, chatId, `✅ <b>Balance Deducted!</b>\n\n👤 User: <code>${tgId}</code>\n💸 Deducted: ₹${amount}\n💵 New Balance: ₹${newBalance}`);

  try {
    await sendMessage(token, tgId, `⚠️ ₹${amount} has been deducted from your wallet by admin.\n\n💰 New Balance: ₹${newBalance}`);
  } catch { /* user may have blocked bot */ }
}

// ===== ADD BALANCE =====

export async function handleAddBalance(token: string, supabase: any, chatId: number, tgId: number, amount: number) {
  if (!tgId || isNaN(amount) || amount <= 0) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/add_balance 123456 500</code>");
    return;
  }

  const { data: wallet } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", tgId).single();
  if (!wallet) {
    await ensureWallet(supabase, tgId);
  }

  const { error } = await supabase.from("telegram_wallets").update({
    balance: (wallet?.balance || 0) + amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", tgId);

  if (error) {
    await sendMessage(token, chatId, `❌ Failed: ${error.message}`);
    return;
  }

  // Record transaction
  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: tgId,
    amount,
    type: "admin_credit",
    description: `Admin added ₹${amount}`,
  });

  const newBalance = (wallet?.balance || 0) + amount;
  await sendMessage(token, chatId, `✅ <b>Balance Added!</b>\n\n👤 User: <code>${tgId}</code>\n💰 Added: ₹${amount}\n💵 New Balance: ₹${newBalance}`);

  // Notify user
  try {
    await sendMessage(token, tgId, `🎉 ₹${amount} has been added to your wallet by admin!\n\n💰 New Balance: ₹${newBalance}`);
  } catch { /* user may have blocked bot */ }
}

// ===== ALL USERS (PAGINATED) =====

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
