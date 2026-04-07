import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function calculateCharge(baseAmount: number): number {
  // 2% of base + random ₹0.10 - ₹0.50
  const twoPct = baseAmount * 0.02;
  const randomExtra = Math.floor(Math.random() * 41 + 10) / 100; // 0.10 to 0.50
  return parseFloat((twoPct + randomExtra).toFixed(2));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, baseAmount } = await req.json();
    if (!userId || !baseAmount || baseAmount < 1) {
      return new Response(JSON.stringify({ error: "Missing userId or baseAmount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const intBase = Math.floor(baseAmount);

    // Try up to 10 times to find a unique amount not already reserved
    let uniqueAmount = 0;
    let attempts = 0;
    while (attempts < 10) {
      const paise = generatePaise(intBase);
      uniqueAmount = parseFloat((intBase + paise / 100).toFixed(2));

      // Check if this exact amount is already reserved (active, not expired)
      const { data: existing } = await supabase
        .from("razorpay_amount_reservations")
        .select("id")
        .eq("amount", uniqueAmount)
        .eq("status", "reserved")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!existing) break; // No conflict
      attempts++;
    }

    if (attempts >= 10) {
      return new Response(JSON.stringify({ error: "Could not generate unique amount. Try again." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create manual_deposit_requests record
    const { data: depReq, error: depError } = await supabase
      .from("manual_deposit_requests")
      .insert({
        user_id: userId,
        amount: uniqueAmount,
        transaction_id: `RAZORPAY-${Date.now()}`,
        sender_name: "Razorpay Auto",
        payment_method: "razorpay_auto",
        status: "pending",
      })
      .select("id")
      .single();

    if (depError) {
      console.error("Failed to create deposit request:", depError);
      return new Response(JSON.stringify({ error: "Failed to create deposit request" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert reservation
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: reservation, error: resError } = await supabase
      .from("razorpay_amount_reservations")
      .insert({
        user_id: userId,
        amount: uniqueAmount,
        base_amount: intBase,
        status: "reserved",
        deposit_request_id: depReq.id,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (resError) {
      console.error("Failed to create reservation:", resError);
      return new Response(JSON.stringify({ error: "Failed to reserve amount" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      uniqueAmount,
      reservationId: reservation.id,
      depositRequestId: depReq.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("reserve-razorpay-amount error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
