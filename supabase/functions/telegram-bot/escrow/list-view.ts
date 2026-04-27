// ===== ESCROW LIST & VIEW DEAL =====

import { sendMessage, editMessageText } from "../telegram-api.ts";
import { resolveProfileUserId } from "../_shared/profile-id-resolver.ts";
import { STATUS_EMOJI, STATUS_LABEL } from "./shared.ts";

export async function escrowListDeals(token: string, supabase: any, chatId: number, userId: number, scope: 'active' | 'closed', messageId?: number) {
  const profileId = await resolveProfileUserId(supabase, userId);
  if (!profileId) return;

  const activeStatuses = ['pending_acceptance', 'funded', 'delivered', 'disputed'];
  const { data: deals } = await supabase
    .from("escrow_deals").select("*")
    .or(`buyer_id.eq.${profileId},seller_id.eq.${profileId}`)
    .order("created_at", { ascending: false }).limit(20);

  const filtered = (deals || []).filter((d: any) =>
    scope === 'active' ? activeStatuses.includes(d.status) : !activeStatuses.includes(d.status));

  let msg = `📋 <b>${scope === 'active' ? 'Active' : 'Closed'} Escrow Deals</b>\n\n`;
  if (filtered.length === 0) {
    msg += `<i>No ${scope} deals.</i>`;
  } else {
    filtered.slice(0, 10).forEach((d: any, i: number) => {
      const isBuyer = d.buyer_id === profileId;
      msg += `${i + 1}. ${STATUS_EMOJI[d.status] || '•'} <b>${STATUS_LABEL[d.status] || d.status}</b>\n`;
      msg += `   ${isBuyer ? '↗️' : '↙️'} ₹${Number(d.amount).toFixed(2)} · ${d.description.slice(0, 40)}${d.description.length > 40 ? '…' : ''}\n\n`;
    });
  }

  const buttons = filtered.slice(0, 10).map((d: any) => ([
    { text: `${STATUS_EMOJI[d.status]} ${d.description.slice(0, 28)}`, callback_data: `escrow_view_${d.id}` }
  ]));
  buttons.push([{ text: "🔙 Back", callback_data: "escrow_menu" }]);

  if (messageId) {
    await editMessageText(token, chatId, messageId, msg, { reply_markup: { inline_keyboard: buttons } });
  } else {
    await sendMessage(token, chatId, msg, { reply_markup: { inline_keyboard: buttons } });
  }
}

export async function escrowViewDeal(token: string, supabase: any, chatId: number, userId: number, dealId: string, messageId?: number) {
  const profileId = await resolveProfileUserId(supabase, userId);
  if (!profileId) return;

  const { data: d } = await supabase.from("escrow_deals").select("*").eq("id", dealId).single();
  if (!d || (d.buyer_id !== profileId && d.seller_id !== profileId)) {
    await sendMessage(token, chatId, "❌ Deal not found or access denied.");
    return;
  }

  const isBuyer = d.buyer_id === profileId;
  const otherProfileId = isBuyer ? d.seller_id : d.buyer_id;
  const { data: other } = await supabase.from("profiles").select("name,email").eq("id", otherProfileId).single();
  const otherLabel = other?.name || other?.email || "Counterpart";

  let msg = `🛡️ <b>Escrow Deal</b> <code>#${dealId.slice(0, 8)}</code>\n\n`;
  msg += `${STATUS_EMOJI[d.status] || '•'} Status: <b>${STATUS_LABEL[d.status] || d.status}</b>\n`;
  msg += `${isBuyer ? '👤 Seller' : '👤 Buyer'}: <b>${otherLabel}</b>\n`;

  if (d.status === 'pending_acceptance' && d.expires_at) {
    const msLeft = new Date(d.expires_at).getTime() - Date.now();
    if (msLeft > 0) {
      const mins = Math.floor(msLeft / 60000);
      const secs = Math.floor((msLeft % 60000) / 1000);
      msg += `⏱️ Auto-cancel in: <b>${mins}m ${secs}s</b>\n`;
    } else {
      msg += `⏱️ <b>Expired</b> — will auto-cancel shortly\n`;
    }
  }
  msg += `\n📦 ${d.description}\n\n`;
  msg += `💰 Amount: <b>₹${Number(d.amount).toFixed(2)}</b>\n`;
  msg += `💸 Fee (2%): ₹${Number(d.fee_amount).toFixed(2)}\n`;
  msg += `💵 Seller receives: ₹${Number(d.seller_amount).toFixed(2)}\n\n`;
  if (d.delivered_note) msg += `📝 Delivery note: <i>${d.delivered_note}</i>\n`;
  if (d.dispute_reason) msg += `⚠️ Dispute: <i>${d.dispute_reason}</i>\n`;
  if (d.admin_resolution) msg += `🛠️ Admin: <i>${d.admin_resolution}</i>\n`;

  const { data: msgs } = await supabase
    .from("escrow_messages").select("sender_id,sender_role,message,created_at")
    .eq("deal_id", dealId).order("created_at", { ascending: false }).limit(3);
  if (msgs && msgs.length > 0) {
    msg += `\n💬 <b>Recent messages:</b>\n`;
    msgs.reverse().forEach((m: any) => {
      const who = m.sender_role === 'system' ? '⚙️ System'
        : m.sender_role === 'admin' ? '🛡️ Admin'
        : m.sender_id === d.buyer_id ? '👤 Buyer' : '🏪 Seller';
      msg += `<i>${who}:</i> ${String(m.message).slice(0, 80)}\n`;
    });
  }

  const rows: any[] = [];
  if (d.status === 'pending_acceptance') {
    if (isBuyer) {
      rows.push([{ text: "❌ Cancel Request", callback_data: `escrow_cancel_${dealId}` }]);
    } else {
      rows.push([
        { text: "✅ Accept", callback_data: `escrow_accept_${dealId}` },
        { text: "❌ Decline", callback_data: `escrow_decline_${dealId}` },
      ]);
    }
  } else if (d.status === 'funded') {
    if (isBuyer) {
      rows.push([{ text: "⏳ Waiting for seller to deliver", callback_data: `escrow_view_${dealId}` }]);
      rows.push([
        { text: "❌ Cancel Deal", callback_data: `escrow_buyer_cancel_${dealId}` },
        { text: "⚠️ Dispute", callback_data: `escrow_dispute_${dealId}` },
      ]);
    } else {
      rows.push([{ text: "📦 Mark Delivered", callback_data: `escrow_deliver_${dealId}` }]);
      rows.push([{ text: "⚠️ Open Dispute", callback_data: `escrow_dispute_${dealId}` }]);
    }
  } else if (d.status === 'delivered') {
    if (isBuyer) {
      rows.push([
        { text: "💰 Release Funds to Seller", callback_data: `escrow_release_${dealId}` },
      ]);
      rows.push([
        { text: "⚠️ Dispute", callback_data: `escrow_dispute_${dealId}` },
      ]);
    } else {
      rows.push([{ text: "⏳ Waiting for buyer to release", callback_data: `escrow_view_${dealId}` }]);
      rows.push([{ text: "⚠️ Open Dispute", callback_data: `escrow_dispute_${dealId}` }]);
    }
  }
  rows.push([
    { text: "💬 Send Message", callback_data: `escrow_chat_${dealId}` },
    { text: "🔄 Refresh", callback_data: `escrow_view_${dealId}` },
  ]);
  rows.push([{ text: "🔙 Back", callback_data: "escrow_list_active" }]);

  if (messageId) {
    await editMessageText(token, chatId, messageId, msg, { reply_markup: { inline_keyboard: rows } });
  } else {
    await sendMessage(token, chatId, msg, { reply_markup: { inline_keyboard: rows } });
  }
}
