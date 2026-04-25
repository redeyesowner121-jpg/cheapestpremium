// Auto-cancel pending_acceptance escrow deals after 30 minutes.
// Notifies buyer, seller (via TG if linked) and all bot admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const SUPER_ADMIN_ID = 5495459593;

async function tgSend(chatId: number, text: string, opts: any = {}) {
  const lk = Deno.env.get("LOVABLE_API_KEY");
  const tk = Deno.env.get("TELEGRAM_API_KEY");
  if (!lk || !tk) return;
  try {
    await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lk}`,
        "X-Connection-Api-Key": tk,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...opts }),
    });
  } catch (e) { console.error("tg send", chatId, e); }
}

async function tgIdFor(supabase: any, profileId: string): Promise<number | null> {
  const { data: p } = await supabase
    .from("profiles").select("email,telegram_id").eq("id", profileId).maybeSingle();
  if (p?.telegram_id) return Number(p.telegram_id);
  const m = p?.email?.match(/^telegram_(\d+)@bot\.local$/);
  return m ? parseInt(m[1]) : null;
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key);

  // Fetch deals about to expire BEFORE running the RPC, so we can notify with details.
  const { data: expiring } = await supabase
    .from("escrow_deals")
    .select("id,buyer_id,seller_id,amount,description,expires_at")
    .eq("status", "pending_acceptance")
    .lt("expires_at", new Date().toISOString());

  const deals = expiring || [];

  // Run the RPC to flip statuses, refund holds (none here, status is pre-funded), and create system messages.
  const { data: rpcResult, error } = await supabase.rpc("expire_stale_escrows");
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  // Collect admin telegram ids
  const adminIds: number[] = [SUPER_ADMIN_ID];
  const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (admins) for (const a of admins) if (!adminIds.includes(a.telegram_id)) adminIds.push(a.telegram_id);

  let notified = 0;
  for (const d of deals) {
    const short = String(d.id).slice(0, 8);
    const amt = Number(d.amount).toFixed(2);
    const desc = String(d.description || "").slice(0, 80);

    // Buyer
    const buyerTg = await tgIdFor(supabase, d.buyer_id);
    if (buyerTg) {
      await tgSend(buyerTg,
        `⏱️ <b>Escrow Auto-Cancelled</b>\n\n` +
        `Your escrow request expired — seller didn't accept within 30 minutes.\n\n` +
        `📦 ${desc}\n💰 ₹${amt}\n🆔 <code>#${short}</code>\n\n` +
        `✅ No funds were charged. You can start a new deal anytime.`,
        { reply_markup: { inline_keyboard: [[{ text: "➕ New Escrow", callback_data: "escrow_new" }]] } });
      notified++;
    }

    // Seller
    const sellerTg = await tgIdFor(supabase, d.seller_id);
    if (sellerTg) {
      await tgSend(sellerTg,
        `⏱️ <b>Escrow Request Expired</b>\n\n` +
        `An escrow request expired before you accepted it.\n\n` +
        `📦 ${desc}\n💰 ₹${amt}\n🆔 <code>#${short}</code>\n\n` +
        `<i>Tip: respond within 30 minutes next time so deals don't auto-cancel.</i>`);
      notified++;
    }

    // Admins
    for (const adminId of adminIds) {
      await tgSend(adminId,
        `⏱️ <b>Escrow Auto-Cancelled</b> <code>#${short}</code>\n\n` +
        `Buyer: <code>${d.buyer_id.slice(0, 8)}</code>${buyerTg ? ` (TG ${buyerTg})` : ''}\n` +
        `Seller: <code>${d.seller_id.slice(0, 8)}</code>${sellerTg ? ` (TG ${sellerTg})` : ''}\n` +
        `💰 ₹${amt}\n📦 ${desc}\n\n` +
        `Reason: seller didn't accept within 30 min.`);
    }
  }

  return new Response(JSON.stringify({
    ok: true, expired: rpcResult?.expired ?? deals.length, notified,
  }), { headers: { "Content-Type": "application/json" } });
});
