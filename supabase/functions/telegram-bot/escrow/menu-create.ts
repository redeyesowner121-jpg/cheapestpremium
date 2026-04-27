// ===== ESCROW MAIN MENU & CREATION FLOW =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState, deleteConversationState } from "../db-helpers.ts";
import { resolveProfileUserId } from "../_shared/profile-id-resolver.ts";
import { resolveEscrowCounterparty } from "./shared.ts";

export async function handleEscrowCommand(token: string, supabase: any, chatId: number, userId: number) {
  const profileId = await resolveProfileUserId(supabase, userId);
  if (!profileId) {
    await sendMessage(token, chatId, "❌ Could not access your wallet profile. Try /start first.");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles").select("wallet_balance, name").eq("id", profileId).single();

  const balance = Number(profile?.wallet_balance || 0).toFixed(2);

  const { data: deals } = await supabase
    .from("escrow_deals")
    .select("id,status,seller_id,buyer_id")
    .or(`buyer_id.eq.${profileId},seller_id.eq.${profileId}`);

  const active = (deals || []).filter((d: any) =>
    ['pending_acceptance', 'funded', 'delivered', 'disputed'].includes(d.status));
  const needsResponse = (deals || []).filter((d: any) =>
    d.status === 'pending_acceptance' && d.seller_id === profileId);

  let msg = `🛡️ <b>Escrow — Safe P2P Deals</b>\n\n`;
  msg += `Hi ${profile?.name || 'there'}! Trade safely with anyone — funds are held by the bot until both sides are happy.\n\n`;
  msg += `💰 Your Wallet: <b>₹${balance}</b>\n`;
  msg += `📊 Active deals: <b>${active.length}</b>\n`;
  if (needsResponse.length > 0) {
    msg += `🔔 <b>${needsResponse.length}</b> request${needsResponse.length > 1 ? 's' : ''} waiting for your response\n`;
  }
  msg += `\n💡 <b>How it works:</b>\n`;
  msg += `1️⃣ Start a deal with seller's @username, Telegram ID, or email\n`;
  msg += `2️⃣ Seller accepts → funds held from your wallet\n`;
  msg += `3️⃣ Seller delivers → you confirm → funds released\n`;
  msg += `4️⃣ Any issue? Open a dispute, admin decides\n\n`;
  msg += `⏱️ Auto-cancel: 30 min if seller doesn't accept\n`;
  msg += `⚙️ Platform fee: <b>2%</b>\n`;
  msg += `🔒 No website account needed — works fully inside Telegram`;

  const kb: any[] = [
    [{ text: "➕ Create Escrow", callback_data: "escrow_new" }],
    [{ text: `📋 My Deals (${active.length})`, callback_data: "escrow_list_active" }],
    [{ text: "📜 History", callback_data: "escrow_list_closed" }],
  ];
  if (Number(balance) < 10) {
    kb.push([{ text: "💰 Deposit to Wallet", callback_data: "deposit_menu" }]);
  }
  kb.push([{ text: "❌ Close", callback_data: "back_main" }]);

  await sendMessage(token, chatId, msg, { reply_markup: { inline_keyboard: kb } });
}

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

export async function escrowHandleIdentifierInput(token: string, supabase: any, chatId: number, userId: number, text: string) {
  const identifier = text.trim();
  if (identifier.length < 3) {
    await sendMessage(token, chatId, "❌ Please send a valid email, @username, or numeric Telegram ID.");
    return;
  }

  const seller = await resolveEscrowCounterparty(supabase, identifier);
  if (!seller?.profile_id) {
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
    sellerIdentifier: seller.email || identifier,
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
      `❌ Insufficient wallet balance.\n\nYou have <b>₹${Number(profile?.wallet_balance || 0).toFixed(2)}</b> but escrow needs <b>₹${amt.toFixed(2)}</b>.\n\nTop up your wallet to continue — works fully inside Telegram, no website signup needed.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "💰 Deposit Now", callback_data: "deposit_menu" }],
        [{ text: "🔙 Escrow Menu", callback_data: "escrow_menu" }],
      ] } });
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

  // Notify seller via Telegram
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
