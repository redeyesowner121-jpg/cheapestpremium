import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { note, amount, paymentId, userId, depositRequestId } = await req.json();
    if (!note || !amount) {
      return new Response(JSON.stringify({ error: "Missing note or amount" }), {
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
        return new Response(JSON.stringify({ success: true, message: "Already verified" }), {
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

    // Fetch recent payments from Razorpay (last 2 hours)
    const fromTime = Math.floor(Date.now() / 1000) - 7200;
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
    const matchingPayment = payments.find((p: any) => {
      const noteMatch =
        (p.notes && Object.values(p.notes).some((v: any) => String(v) === note)) ||
        (p.description && p.description.includes(note));
      const amountMatch = p.amount === amountPaise;
      const statusMatch = p.status === "captured" || p.status === "authorized";
      return noteMatch && amountMatch && statusMatch;
    });

    if (matchingPayment) {
      // Update payment record if exists (bot flow)
      if (paymentId) {
        await supabase.from("payments").update({
          status: "success",
          updated_at: new Date().toISOString(),
        }).eq("id", paymentId);
      }

      // Website flow: credit wallet and update deposit request
      if (userId && depositRequestId) {
        // Get current profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance, rank_balance, total_deposit, name")
          .eq("id", userId)
          .single();

        if (profile) {
          const newBalance = (profile.wallet_balance || 0) + amount;
          const newRankBalance = (profile.rank_balance || 0) + amount;
          const newTotalDeposit = (profile.total_deposit || 0) + amount;

          // Check for bonus (Rs1000+ deposit)
          let bonusAmount = 0;
          if (amount >= 1000) bonusAmount = 100;

          const finalBalance = newBalance + bonusAmount;

          await supabase.from("profiles").update({
            wallet_balance: finalBalance,
            rank_balance: newRankBalance,
            total_deposit: newTotalDeposit,
            has_blue_check: amount >= 1000 ? true : undefined,
          }).eq("id", userId);

          // Record transaction
          await supabase.from("transactions").insert({
            user_id: userId,
            type: "deposit",
            amount: amount,
            status: "completed",
            description: `Razorpay Auto Deposit (Code: ${note})`,
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

          // Update deposit request
          await supabase.from("manual_deposit_requests").update({
            status: "approved",
            admin_note: "Auto-verified via Razorpay",
          }).eq("id", depositRequestId);

          // Notification
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "Deposit Successful! 💰",
            message: `₹${amount} has been added to your wallet${bonusAmount > 0 ? ` + ₹${bonusAmount} bonus!` : '.'}`,
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
      message: "Payment not found. Make sure you paid the exact amount and added the note.",
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