// ===== ESCROW CALLBACK ACTIONS & CONVERSATION TEXT HANDLERS =====

import { sendMessage, answerCallbackQuery } from "../telegram-api.ts";
import { setConversationState, deleteConversationState } from "../db-helpers.ts";
import { resolveProfileUserId } from "../../_shared/profile-id-resolver.ts";
import { notifyOther } from "./shared.ts";
import { escrowViewDeal } from "./list-view.ts";

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
      const { data: deal } = await supabase
        .from("escrow_deals").select("status").eq("id", dealId).single();
      if (!deal) { await ack("Deal not found", true); return; }
      if (deal.status === 'funded') {
        await ack("⏳ Seller hasn't marked delivered yet.", true);
        await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
        return;
      }
      if (deal.status !== 'delivered') {
        await ack(`Cannot release in status: ${deal.status}`, true);
        await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
        return;
      }
      const { data: relData, error } = await supabase.rpc('buyer_confirm_escrow', { _buyer_id: profileId, _deal_id: dealId });
      if (error) throw error;
      await ack(`💰 Released ₹${relData?.released ?? ''} to seller!`);
      await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
      await notifyOther(token, supabase, dealId, profileId, `🎉 Buyer released funds! ₹${relData?.released ?? ''} added to your wallet. Check /wallet.`, dealId);
    } else if (action === 'buyer_cancel') {
      const { error } = await supabase.rpc('buyer_cancel_funded_escrow', { _buyer_id: profileId, _deal_id: dealId });
      if (error) throw error;
      await ack("❌ Cancelled & refunded");
      await escrowViewDeal(token, supabase, chatId, userId, dealId, messageId);
      await notifyOther(token, supabase, dealId, profileId, "❌ Buyer cancelled the funded escrow before delivery. Funds were refunded.", dealId);
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

  try {
    const { notifyAllAdmins } = await import("../db-helpers.ts");
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
