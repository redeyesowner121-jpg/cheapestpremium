import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { amount, paymentId, userId, depositRequestId, payClickedAt } = await req.json();
    if (!amount) {
      return new Response(JSON.stringify({ error: "Missing amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If paymentId provided (bot flow), check payment record
    if (paymentId) {
      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (payment?.status === "success") {
        return new Response(JSON.stringify({ success: false, message: "This payment was already processed. Start a new deposit." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If depositRequestId provided (website flow), check if already approved
    if (depositRequestId) {
      const { data: depReq } = await supabase
        .from("manual_deposit_requests")
        .select("status")
        .eq("id", depositRequestId)
        .single();

      if (depReq?.status === "approved") {
        return new Response(JSON.stringify({ success: true, message: "Already verified" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const authHeader = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Search last 10 minutes of payments
    const nowSec = Math.floor(Date.now() / 1000);
    const fromTime = payClickedAt 
      ? Math.floor(new Date(payClickedAt).getTime() / 1000) - 60
      : nowSec - 600;

    const paymentsRes = await fetch(
      `https://api.razorpay.com/v1/payments?count=100&from=${fromTime}`,
      { headers: { "Authorization": `Basic ${authHeader}` } }
    );

    if (!paymentsRes.ok) {
      console.error("Razorpay fetch error:", await paymentsRes.text());
      return new Response(JSON.stringify({ success: false, message: "Failed to check payments. Try again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentsData = await paymentsRes.json();
    const payments = paymentsData.items || [];

    const amountPaise = Math.round(amount * 100);
    
    // Match by exact amount + captured/authorized status, filtering out already-claimed payments
    const candidatePayments = payments.filter((p: any) => {
      const amountMatch = p.amount === amountPaise;
      const statusMatch = p.status === "captured" || p.status === "authorized";
      return amountMatch && statusMatch;
    });

    // Find the first UNCLAIMED payment
    let matchingPayment = null;
    for (const candidate of candidatePayments) {
      const rzpId = candidate.id;

      // Check if already claimed in manual_deposit_requests
      const { data: existingUsage } = await supabase
        .from("manual_deposit_requests")
        .select("id")
        .eq("transaction_id", `RZP:${rzpId}`)
        .eq("status", "approved")
        .maybeSingle();

      if (existingUsage) {
        console.log("Skipping already-claimed payment:", rzpId);
        continue;
      }

      // Check if already claimed in payments table (bot flow)
      const { data: existingBotPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("note", `RZP:${rzpId}`)
        .eq("status", "success")
        .maybeSingle();

      if (existingBotPayment) {
        console.log("Skipping already-claimed payment (bot):", rzpId);
        continue;
      }

      // This payment is unclaimed — use it
      matchingPayment = candidate;
      break;
    }

    if (matchingPayment) {
      const rzpPayId = matchingPayment.id;

      // Update payment record if exists (bot flow)
      if (paymentId) {
        await supabase.from("payments").update({
          status: "success",
          note: `RZP:${rzpPayId}`,
          updated_at: new Date().toISOString(),
        }).eq("id", paymentId);
      }

      // Website flow: credit wallet and update deposit request
      if (userId && depositRequestId) {
        const baseAmount = Math.floor(amount);

        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance, rank_balance, total_deposit, name")
          .eq("id", userId)
          .single();

        if (profile) {
          const newBalance = (profile.wallet_balance || 0) + baseAmount;
          const newRankBalance = (profile.rank_balance || 0) + baseAmount;
          const newTotalDeposit = (profile.total_deposit || 0) + baseAmount;

          let bonusAmount = 0;
          if (baseAmount >= 1000) bonusAmount = 100;

          const finalBalance = newBalance + bonusAmount;

          await supabase.from("profiles").update({
            wallet_balance: finalBalance,
            rank_balance: newRankBalance,
            total_deposit: newTotalDeposit,
            has_blue_check: baseAmount >= 1000 ? true : undefined,
          }).eq("id", userId);

          await supabase.from("transactions").insert({
            user_id: userId,
            type: "deposit",
            amount: baseAmount,
            status: "completed",
            description: `Razorpay Auto Deposit`,
          });

          if (bonusAmount > 0) {
            await supabase.from("transactions").insert({
              user_id: userId,
              type: "bonus",
              amount: bonusAmount,
              status: "completed",
              description: "Deposit bonus (₹1000+ deposit)",
            });
          }

          await supabase.from("manual_deposit_requests").update({
            status: "approved",
            admin_note: `Auto-verified via Razorpay (${rzpPayId})`,
            transaction_id: `RZP:${rzpPayId}`,
          }).eq("id", depositRequestId);

          await supabase.from("notifications").insert({
            user_id: userId,
            title: "Deposit Successful! 💰",
            message: `₹${baseAmount} has been added to your wallet${bonusAmount > 0 ? ` + ₹${bonusAmount} bonus!` : '.'}`,
            type: "wallet",
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Payment verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      message: "Payment not found yet. Please complete payment and try verifying again.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("verify-razorpay-note error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
