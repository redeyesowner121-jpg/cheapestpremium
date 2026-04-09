import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROOF_CHANNEL = "@RKRxProofs";
const PROMO_FOOTER = `\n\n━━━━━━━━━━━━━━━━━\n🤖 <b>@Air1_Premium_bot</b>\n💎 Cheapest Premium Subscriptions\n🔒 100% Trusted · Instant Delivery\n🛒 Start Shopping → @Air1_Premium_bot`;

async function sendProof(token: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: PROOF_CHANNEL, text: text + PROMO_FOOTER, parse_mode: "HTML" }),
  });
  // Rate limit: Telegram allows ~30 msgs/sec to channels
  await new Promise(r => setTimeout(r, 1500));
}

function formatIST(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

Deno.serve(async (req) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return new Response("No bot token", { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let sent = 0;

  // 1. All confirmed/shipped telegram orders
  const { data: orders } = await supabase
    .from("telegram_orders")
    .select("*")
    .in("status", ["confirmed", "shipped"])
    .order("created_at", { ascending: true })
    .limit(500);

  for (const o of orders || []) {
    const time = formatIST(o.created_at);
    if (o.product_name?.startsWith("Wallet Deposit")) {
      await sendProof(token, `💰 <b>Deposit Successful</b>\n\n👤 User: <code>${o.telegram_user_id}</code>\n💵 Amount: <b>₹${o.amount}</b>\n💳 Method: <b>Manual UPI</b>\n🕐 Time: ${time}`);
    } else {
      const emoji = o.status === "shipped" ? "📬" : "✅";
      const label = o.status === "shipped" ? "Order Delivered" : "Order Confirmed";
      await sendProof(token, `${emoji} <b>${label}</b>\n\n👤 User: <code>${o.telegram_user_id}</code>\n🛒 Product: <b>${o.product_name || "N/A"}</b>\n💰 Amount: <b>₹${o.amount}</b>\n🕐 Time: ${time}`);
    }
    sent++;
  }

  // 2. Website orders (confirmed/shipped/delivered)
  const { data: webOrders } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["confirmed", "shipped", "delivered"])
    .order("created_at", { ascending: true })
    .limit(500);

  for (const o of webOrders || []) {
    const time = formatIST(o.created_at);
    await sendProof(token, `✅ <b>Website Order</b>\n\n🛒 Product: <b>${o.product_name}</b>\n💰 Amount: <b>₹${o.total_price}</b>\n📋 Status: <b>${o.status?.toUpperCase()}</b>\n🕐 Time: ${time}`);
    sent++;
  }

  // 3. Approved deposit requests
  const { data: deposits } = await supabase
    .from("manual_deposit_requests")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(500);

  for (const d of deposits || []) {
    const time = formatIST(d.created_at);
    await sendProof(token, `💰 <b>Deposit Approved</b>\n\n💵 Amount: <b>₹${d.amount}</b>\n💳 Method: <b>${d.payment_method || "QR"}</b>\n🧾 Txn: <code>${d.transaction_id}</code>\n🕐 Time: ${time}`);
    sent++;
  }

  // 4. Completed withdrawal requests
  const { data: withdrawals } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .in("status", ["accepted", "delivered"])
    .order("created_at", { ascending: true })
    .limit(500);

  for (const w of withdrawals || []) {
    const time = formatIST(w.created_at);
    const emoji = w.status === "delivered" ? "📦" : "💸";
    const label = w.status === "delivered" ? "Delivered" : "Accepted";
    await sendProof(token, `${emoji} <b>Withdrawal ${label}</b>\n\n👤 User: <code>${w.telegram_id || w.user_id}</code>\n💵 Amount: <b>₹${w.amount}</b>\n💳 ${w.method?.toUpperCase()}: <code>${w.account_details}</code>\n🕐 Time: ${time}`);
    sent++;
  }

  // 5. Giveaway redemptions
  const { data: giveaways } = await supabase
    .from("giveaway_redemptions")
    .select("*, giveaway_products(product_id, points_required, products:product_id(name))")
    .in("status", ["approved", "delivered"])
    .order("created_at", { ascending: true })
    .limit(500);

  for (const g of giveaways || []) {
    const time = formatIST(g.created_at);
    const productName = (g as any).giveaway_products?.products?.name || "N/A";
    await sendProof(token, `🎁 <b>Giveaway Redeemed</b>\n\n👤 User: <code>${g.telegram_id}</code>\n🛒 Product: <b>${productName}</b>\n🎯 Points: <b>${g.points_spent}</b>\n🕐 Time: ${time}`);
    sent++;
  }

  // 6. Wallet transactions (referral bonuses, redeem codes)
  const { data: txns } = await supabase
    .from("telegram_wallet_transactions")
    .select("*")
    .in("type", ["referral_bonus", "redeem_code"])
    .order("created_at", { ascending: true })
    .limit(500);

  for (const t of txns || []) {
    const time = formatIST(t.created_at);
    if (t.type === "redeem_code") {
      await sendProof(token, `🎟️ <b>Redeem Code Used</b>\n\n👤 User: <code>${t.telegram_id}</code>\n💰 Amount: <b>₹${t.amount}</b>\n📝 ${t.description || ""}\n🕐 Time: ${time}`);
    } else {
      await sendProof(token, `🎉 <b>Referral Bonus</b>\n\n👤 User: <code>${t.telegram_id}</code>\n💰 Amount: <b>₹${t.amount}</b>\n📝 ${t.description || ""}\n🕐 Time: ${time}`);
    }
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
