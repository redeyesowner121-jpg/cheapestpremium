// ===== /escrow COMMAND - Telegram bot escrow flow =====
// Uses website wallet (profiles.wallet_balance) via resolveProfileUserId.

import { sendMessage, editMessageText, answerCallbackQuery } from "./telegram-api.ts";
import { setConversationState, deleteConversationState } from "./db-helpers.ts";
import { resolveProfileUserId } from "../_shared/profile-id-resolver.ts";

const STATUS_EMOJI: Record<string, string> = {
  pending_acceptance: "⏳",
  funded: "🔒",
  delivered: "📦",
  completed: "✅",
  disputed: "⚠️",
  refunded: "↩️",
  cancelled: "❌",
};

const STATUS_LABEL: Record<string, string> = {
  pending_acceptance: "Awaiting Seller",
  funded: "Funded",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

// =================== MAIN MENU ===================
export async function handleEscrowCommand(token: string, supabase: any, chatId: number, userId: number) {
  const profileId = await resolveProfileUserId(supabase, userId);
  if (!profileId) {
    await sendMessage(token, chatId, "❌ Could not access your wallet profile. Try /start first.");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles").select("wallet_balance, name").eq("id", profileId).single();

  const balance = Number(profile?.wallet_balance || 0).toFixed(2);

  // Active deal counts
  const { data: deals } = await supabase
    .from("escrow_deals")
    .select("id,status,seller_id,buyer_id")
    .or(`buyer_id.eq.${profileId},seller_id.eq.${profileId}`);

  const active = (deals || []).filter((d: any) =>
    ['pending_acceptance', 'funded', 'delivered', 'disputed'].includes(d.status));
  const needsResponse = (deals || []).filter((d: any) =>
    d.status === 'pending_acceptance' && d.seller_id === profileId);

  let msg = `🛡️ <b>Escrow — Safe Deals</b>\n\n`;
  msg += `Hi ${profile?.name || 'there'}! Escrow holds funds safely until both parties are happy.\n\n`;
  msg += `💰 Wallet: <b>₹${balance}</b>\n`;
  msg += `📊 Active deals: <b>${active.length}</b>\n`;
  if (needsResponse.length > 0) {
    msg += `🔔 <b>${needsResponse.length}</b> request${needsResponse.length > 1 ? 's' : ''} waiting for your response\n`;
  }
  msg += `\n💡 <b>How it works:</b>\n`;
  msg += `1️⃣ You start a deal with seller's email\n`;
  msg += `2️⃣ Seller accepts → funds held from your wallet\n`;
  msg += `3️⃣ Seller delivers → you confirm → funds released\n`;
  msg += `4️⃣ Any issue? Open a dispute, admin decides\n\n`;
  msg += `⚙️ Platform fee: <b>2%</b>`;

  await sendMessage(token, chatId, msg, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Create Escrow", callback_data: "escrow_new" }],
        [{ text: `📋 My Deals (${active.length})`, callback_data: "escrow_list_active" }],
        [{ text: "📜 History", callback_data: "escrow_list_closed" }],
        [{ text: "❌ Close", callback_data: "back_main" }],
      ],
    },
  });
}

// =================== START CREATION ===================
export async function escrowStartCreate(token: string, supabase: any, chatId: number, userId: number) {
  await setConversationState(supabase, userId, "escrow_awaiting_identifier", {});
  await sendMessage(token, chatId,
    `➕ <b>New Escrow — Step 1 of 3</b>\n\n` +
    `Enter the seller's <b>email</b>, <b>@username</b>, or <b>numeric Telegram ID</b>.\n\n` +
    `Examples:\n` +
    `• <code>seller@gmail.com</code>\n` +
    `• <code>@cool_seller</code>\n` +
    `• <code>123456789</code>\n\n` +
    `<i>The seller must have used this bot or have an account on cheapest-premiums.in</i>\n\n` +
    `/cancel to abort`,
    { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "escrow_menu" }]] } }
  );
}

// =================== CONVERSATION STEPS ===================
export async function escrowHandleIdentifierInput(token: string, supabase: any, chatId: number, userId: number, text: string) {
  const identifier = text.trim();
  if (identifier.length < 3) {
    await sendMessage(token, chatId, "❌ Please send a valid email, @username, or numeric Telegram ID.");
    return;
  }

  // Resolve via DB
  const { data: rows, error } = await supabase.rpc("find_profile_by_identifier", { _identifier: identifier });
  const seller = Array.isArray(rows) ? rows[0] : null;
  if (error || !seller?.profile_id) {
    await sendMessage(token, chatId,
      "❌ No user found with that identifier.\n\nMake sure they have used this bot at least once, or have a website account.",
      { reply_markup: { inline_keyboard: [[{ text: "🔄 Try Again", callback_data: "escrow_new" }, { text: "❌ Cancel", callback_data: "escrow_menu" }]] } }
    );
    await deleteConversationState(supabase, userId);
    return;
  }

  const buyerProfileId = await resolveProfileUserId(supabase, userId);
  if (seller.profile_id === buyerProfileId) {
    await sendMessage(token, chatId, "❌ You cannot create an escrow with yourself.");
    await deleteConversationState(supabase, userId);
    return;
  }

  const kindLabel = seller.identifier_kind === 'email' ? '📧 email'
    : seller.identifier_kind === 'username' ? '🔗 @username' : '🆔 Telegram ID';

  await setConversationState(supabase, userId, "escrow_awaiting_amount", {
    sellerIdentifier: identifier,
    sellerName: seller.name || seller.email || identifier,
  });
  await sendMessage(token, chatId,
    `✅ Seller found via ${kindLabel}: <b>${seller.name || seller.email || identifier}</b>\n\n` +
    `<b>Step 2 of 3 — Amount</b>\n\nEnter the amount in ₹ (just the number, e.g. <code>500</code>):`,
    { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "escrow_menu" }]] } }
  );
}

export async function escrowHandleAmountInput(token: string, supabase: any, chatId: number, userId: number, text: string, stateData: any) {
  const amt = parseFloat(text.trim().replace(/[^\d.]/g, ""));
  if (isNaN(amt) || amt <= 0) {
    await sendMessage(token, chatId, "❌ Please send a valid number greater than 0.");
    return;
  }
  if (amt > 1000000) { await sendMessage(token, chatId, "❌ Maximum is ₹10,00,000."); return; }

  const profileId = await resolveProfileUserId(supabase, userId);
  const { data: profile } = await supabase.from("profiles").select("wallet_balance").eq("id", profileId).single();
  if ((profile?.wallet_balance || 0) < amt) {
    await sendMessage(token, chatId,
      `❌ Insufficient wallet balance. You have ₹${Number(profile?.wallet_balance || 0).toFixed(2)} but escrow needs ₹${amt.toFixed(2)}.\n\nUse /deposit to top up.`);
    await deleteConversationState(supabase, userId);
    return;
  }

  const fee = +(amt * 0.02).toFixed(2);
  const sellerGets = +(amt - fee).toFixed(2);

  await setConversationState(supabase, userId, "escrow_awaiting_description", { ...stateData, amount: amt });
  await sendMessage(token, chatId,
    `<b>Step 3 of 3 — Description</b>\n\n` +
    `💰 Amount: ₹${amt.toFixed(2)}\n` +
    `💸 Fee (2%): ₹${fee.toFixed(2)}\n` +
    `💵 Seller gets: ₹${sellerGets.toFixed(2)}\n\n` +
    `Now describe the deal (min 5 chars). E.g.:\n` +
    `<i>"Netflix Premium 1 month — 4K UHD, ID-Pass delivery"</i>`,
    { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "escrow_menu" }]] } }
  );
}

export async function escrowHandleDescriptionInput(token: string, supabase: any, chatId: number, userId: number, text: string, stateData: any) {
  const desc = text.trim();
  if (desc.length < 5) { await sendMessage(token, chatId, "❌ Description must be at least 5 characters."); return; }

  const profileId = await resolveProfileUserId(supabase, userId);
  const { data, error } = await supabase.rpc("create_escrow_deal_by_identifier", {
    _buyer_id: profileId,
    _identifier: stateData.sellerIdentifier ?? stateData.sellerEmail,
    _amount: stateData.amount,
    _description: desc,
  });
  await deleteConversationState(supabase, userId);

  if (error) { await sendMessage(token, chatId, `❌ ${error.message}`); return; }

  await sendMessage(token, chatId,
    `🎉 <b>Escrow Request Sent!</b>\n\n` +
    `📦 ${desc}\n💰 ₹${stateData.amount}\n👤 To: ${stateData.sellerName || data?.seller_name || stateData.sellerIdentifier}\n\n` +
    `⏳ Auto-cancels in <b>30 minutes</b> if seller doesn't accept. They'll be notified via Telegram & website.\n\n` +
    `💡 Funds are held only AFTER seller accepts. You can cancel anytime before that.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 View Deal", callback_data: `escrow_view_${data.deal_id}` }],
          [{ text: "🔙 Escrow Menu", callback_data: "escrow_menu" }],
        ],
      },
    }
  );

  // Notify seller via Telegram if they're linked (by profiles.telegram_id OR synthetic email)
  try {
    const { data: deal } = await supabase.from("escrow_deals").select("seller_id").eq("id", data.deal_id).single();
    if (deal?.seller_id) {
      const { data: sellerProfile } = await supabase
        .from("profiles").select("email,telegram_id").eq("id", deal.seller_id).single();
      let sellerTgId: number | null = null;
      if (sellerProfile?.telegram_id) {
        sellerTgId = Number(sellerProfile.telegram_id);
      } else {
        const m = sellerProfile?.email?.match(/^telegram_(\d+)@bot\.local$/);
        if (m) sellerTgId = parseInt(m[1]);
      }
      // Fallback: look up bot user table by profile email/identifier
      if (!sellerTgId) {
        const { data: bu } = await supabase
          .from("telegram_bot_users")
          .select("telegram_id")
          .eq("email", sellerProfile?.email || "")
          .maybeSingle();
        if (bu?.telegram_id) sellerTgId = Number(bu.telegram_id);
      }
      if (sellerTgId) {
        await sendMessage(token, sellerTgId,
          `🛡️ <b>New Escrow Request</b>\n\n` +
          `📦 ${desc}\n💰 ₹${stateData.amount}\n\n` +
          `⏳ Auto-cancels in 30 minutes if you don't respond.\n\n` +
          `Tap to view & respond:`,
          { reply_markup: { inline_keyboard: [[
            { text: "✅ Accept", callback_data: `escrow_accept_${data.deal_id}` },
            { text: "❌ Decline", callback_data: `escrow_decline_${data.deal_id}` },
          ], [
            { text: "👀 View Details", callback_data: `escrow_view_${data.deal_id}` },
          ]] } }
        );
      } else {
        console.log("Seller has no Telegram link; skipped TG notify for deal", data.deal_id);
      }
    }
  } catch (e) { console.error("Notify seller TG:", e); }
}

// =================== LIST DEALS ===================
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

// =================== VIEW SINGLE DEAL ===================
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

  let msg = `🛡️ <b>Escrow Deal</b>\n\n`;
  msg += `${STATUS_EMOJI[d.status] || '•'} Status: <b>${STATUS_LABEL[d.status] || d.status}</b>\n`;
  msg += `${isBuyer ? '👤 Seller' : '👤 Buyer'}: <b>${otherLabel}</b>\n\n`;
  msg += `📦 ${d.description}\n\n`;
  msg += `💰 Amount: <b>₹${Number(d.amount).toFixed(2)}</b>\n`;
  msg += `💸 Fee: ₹${Number(d.fee_amount).toFixed(2)}\n`;
  msg += `💵 Seller receives: ₹${Number(d.seller_amount).toFixed(2)}\n\n`;
  if (d.delivered_note) msg += `📝 Delivery note: <i>${d.delivered_note}</i>\n`;
  if (d.dispute_reason) msg += `⚠️ Dispute: <i>${d.dispute_reason}</i>\n`;
  if (d.admin_resolution) msg += `🛠️ Admin: <i>${d.admin_resolution}</i>\n`;

  // Build action buttons by role + status
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
      rows.push([
        { text: "💰 Release", callback_data: `escrow_release_${dealId}` },
        { text: "⚠️ Dispute", callback_data: `escrow_dispute_${dealId}` },
      ]);
    } else {
      rows.push([{ text: "📦 Mark Delivered", callback_data: `escrow_deliver_${dealId}` }]);
      rows.push([{ text: "⚠️ Open Dispute", callback_data: `escrow_dispute_${dealId}` }]);
    }
  } else if (d.status === 'delivered' && isBuyer) {
    rows.push([
      { text: "💰 Release Funds", callback_data: `escrow_release_${dealId}` },
      { text: "⚠️ Dispute", callback_data: `escrow_dispute_${dealId}` },
    ]);
  }
  rows.push([{ text: "💬 Send Message", callback_data: `escrow_chat_${dealId}` }]);
  rows.push([{ text: "🔙 Back", callback_data: "escrow_list_active" }]);

  if (messageId) {
    await editMessageText(token, chatId, messageId, msg, { reply_markup: { inline_keyboard: rows } });
  } else {
    await sendMessage(token, chatId, msg, { reply_markup: { inline_keyboard: rows } });
  }
}

// =================== CALLBACK ACTIONS ===================
export async function escrowAction(
  token: string, supabase: any, chatId: number, userId: number,
  action: string, dealId: string, callbackId: string, messageId?: number
) {
  const profileId = await resolveProfileUserId(supabase, userId);
  if (!profileId) { await answerCallbackQuery(token, callbackId, "Profile error", true); return; }

  const ack = async (msg: string, alert = false) => answerCallbackQuery(token, callbackId, msg, alert);

  try {
    if (action === 'accept') {
      const { data, error } = await supabase.rpc('seller_respond_escrow', { _seller_id: profileId, _deal_id: dealId, _accept: true });
      if (error) throw error;
      if (data?.success === false) { await ack(data.reason || 'Failed', true); return; }
      await ack("✅ Accepted! Funds held.");
      await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
      await notifyOther(token, supabase, dealId, profileId, "✅ Seller accepted your escrow! Funds are now held.", dealId);
    } else if (action === 'decline') {
      const { error } = await supabase.rpc('seller_respond_escrow', { _seller_id: profileId, _deal_id: dealId, _accept: false });
      if (error) throw error;
      await ack("❌ Declined");
      await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
      await notifyOther(token, supabase, dealId, profileId, "❌ Seller declined your escrow request.", dealId);
    } else if (action === 'cancel') {
      const { error } = await supabase.rpc('cancel_escrow_deal', { _buyer_id: profileId, _deal_id: dealId });
      if (error) throw error;
      await ack("Cancelled");
      await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
      await notifyOther(token, supabase, dealId, profileId, "ℹ️ Buyer cancelled the escrow request.", dealId);
    } else if (action === 'deliver') {
      await setConversationState(supabase, userId, "escrow_awaiting_delivery_note", { dealId });
      await ack("Send delivery note");
      await sendMessage(token, chatId,
        "📝 Send the delivery details/note for the buyer (or send <code>skip</code>):",
        { reply_markup: { inline_keyboard: [[{ text: "Skip note", callback_data: `escrow_deliver_skip_${dealId}` }]] } });
    } else if (action === 'release') {
      const { error } = await supabase.rpc('buyer_confirm_escrow', { _buyer_id: profileId, _deal_id: dealId });
      if (error) throw error;
      await ack("💰 Released!");
      await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
      await notifyOther(token, supabase, dealId, profileId, "🎉 Buyer released funds! Check your wallet.", dealId);
    } else if (action === 'dispute') {
      await setConversationState(supabase, userId, "escrow_awaiting_dispute_reason", { dealId });
      await ack("Send dispute reason");
      await sendMessage(token, chatId, "⚠️ Send the reason for the dispute (min 5 chars). Admin will review.");
    } else if (action === 'chat') {
      await setConversationState(supabase, userId, "escrow_awaiting_chat", { dealId });
      await ack("Send your message");
      await sendMessage(token, chatId, "💬 Type your message (it will appear in the deal chat):",
        { reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: `escrow_view_${dealId}` }]] } });
    }
  } catch (e: any) {
    await ack(`❌ ${e.message?.slice(0, 100) || 'Action failed'}`, true);
  }
}

export async function escrowDeliverSkip(token: string, supabase: any, chatId: number, userId: number, dealId: string, callbackId: string) {
  const profileId = await resolveProfileUserId(supabase, userId);
  const { error } = await supabase.rpc('seller_mark_escrow_delivered', { _seller_id: profileId, _deal_id: dealId, _note: null });
  if (error) { await answerCallbackQuery(token, callbackId, error.message, true); return; }
  await answerCallbackQuery(token, callbackId, "📦 Marked delivered!");
  await deleteConversationState(supabase, userId);
  await escrowViewDeal(token, supabase, chatId, userId, dealId);
  await notifyOther(token, supabase, dealId, profileId!, "📦 Seller marked your escrow as DELIVERED. Please verify and release funds.", dealId);
}

// =================== CONVERSATION TEXT HANDLERS ===================
export async function escrowHandleDeliveryNote(token: string, supabase: any, chatId: number, userId: number, text: string, stateData: any) {
  const profileId = await resolveProfileUserId(supabase, userId);
  const note = text.trim().toLowerCase() === 'skip' ? null : text.trim();
  const { error } = await supabase.rpc('seller_mark_escrow_delivered',
    { _seller_id: profileId, _deal_id: stateData.dealId, _note: note });
  await deleteConversationState(supabase, userId);
  if (error) { await sendMessage(token, chatId, `❌ ${error.message}`); return; }
  await sendMessage(token, chatId, "✅ Marked as delivered! Buyer has been notified.");
  await escrowViewDeal(token, supabase, chatId, userId, stateData.dealId);
  await notifyOther(token, supabase, stateData.dealId, profileId!,
    `📦 Seller marked your escrow as DELIVERED.${note ? `\n\n📝 Note: ${note}` : ''}\n\nPlease verify and release funds.`,
    stateData.dealId);
}

export async function escrowHandleDisputeReason(token: string, supabase: any, chatId: number, userId: number, text: string, stateData: any) {
  const reason = text.trim();
  if (reason.length < 5) { await sendMessage(token, chatId, "❌ Reason must be at least 5 characters."); return; }
  const profileId = await resolveProfileUserId(supabase, userId);
  const { error } = await supabase.rpc('dispute_escrow', { _user_id: profileId, _deal_id: stateData.dealId, _reason: reason });
  await deleteConversationState(supabase, userId);
  if (error) { await sendMessage(token, chatId, `❌ ${error.message}`); return; }
  await sendMessage(token, chatId, "⚠️ Dispute opened. Admin will review and decide.");
  await escrowViewDeal(token, supabase, chatId, userId, stateData.dealId);
  await notifyOther(token, supabase, stateData.dealId, profileId!,
    `⚠️ A dispute was opened on your escrow deal.\n\n📝 Reason: ${reason}\n\nAdmin will review.`,
    stateData.dealId);

  // Notify admins
  try {
    const { notifyAllAdmins } = await import("./db-helpers.ts");
    await notifyAllAdmins(token, supabase,
      `⚠️ <b>ESCROW DISPUTE</b>\n\nDeal: <code>${stateData.dealId.slice(0, 8)}</code>\nReason: ${reason}\n\nReview in admin panel.`);
  } catch {}
}

export async function escrowHandleChatMessage(token: string, supabase: any, chatId: number, userId: number, text: string, stateData: any) {
  const profileId = await resolveProfileUserId(supabase, userId);
  const trimmed = text.trim();

  // AI moderation — catches obfuscated contact-sharing the regex misses.
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      const modResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content:
              "You are a strict moderator for an escrow chat. Block ANY attempt to share contact info or move off-platform, even obfuscated (spaces, dots, words like 'at'/'dot', emojis, leet, foreign scripts). Includes: emails, phone/WA numbers, telegram/insta/fb/discord usernames or links, t.me/wa.me/discord.gg, http links, upi IDs (name@bank), crypto addresses, invitations to deal outside escrow. Allow normal trade chat. Reply ONLY JSON: {\"blocked\":bool,\"reason\":short string}." },
            { role: "user", content: trimmed },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (modResp.ok) {
        const j = await modResp.json();
        const raw = j?.choices?.[0]?.message?.content || "{}";
        let parsed: any = {}; try { parsed = JSON.parse(raw); } catch {}
        if (parsed?.blocked) {
          await sendMessage(token, chatId,
            `🚫 <b>Message blocked by AI moderation</b>\n\n${parsed.reason || "Sharing contact info or off-platform deals is not allowed."}\n\nPlease keep all communication on the escrow chat.`);
          return;
        }
      }
    }
  } catch (e) { console.warn("Bot escrow AI mod failed:", e); /* fail-open */ }

  const { error } = await supabase.rpc('send_escrow_message',
    { _sender_id: profileId, _deal_id: stateData.dealId, _message: trimmed });
  await deleteConversationState(supabase, userId);
  if (error) { await sendMessage(token, chatId, `❌ ${error.message}`); return; }
  await sendMessage(token, chatId, "✅ Message sent.");
  await notifyOther(token, supabase, stateData.dealId, profileId!,
    `💬 New message in escrow deal:\n\n<i>${trimmed.slice(0, 500)}</i>`,
    stateData.dealId);
}

// =================== HELPERS ===================
async function notifyOther(token: string, supabase: any, dealId: string, senderProfileId: string, msg: string, viewDealId: string) {
  try {
    const { data: d } = await supabase.from("escrow_deals").select("buyer_id,seller_id").eq("id", dealId).single();
    if (!d) return;
    const otherProfileId = d.buyer_id === senderProfileId ? d.seller_id : d.buyer_id;
    const { data: p } = await supabase.from("profiles").select("email").eq("id", otherProfileId).single();
    const m = p?.email?.match(/^telegram_(\d+)@bot\.local$/);
    if (!m) return;
    const tgId = parseInt(m[1]);
    await sendMessage(token, tgId, msg, {
      reply_markup: { inline_keyboard: [[{ text: "👀 View Deal", callback_data: `escrow_view_${viewDealId}` }]] }
    });
  } catch (e) { console.error("notifyOther:", e); }
}
