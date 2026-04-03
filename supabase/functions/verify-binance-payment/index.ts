import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  ).then(k => crypto.subtle.sign("HMAC", k, encoder.encode(message)))
    .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join(""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { note, amount, paymentId } = await req.json();
    if (!note || !amount || !paymentId) {
      return new Response(JSON.stringify({ error: "Missing note, amount, or paymentId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY");
    const BINANCE_API_SECRET = Deno.env.get("BINANCE_API_SECRET");
    if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
      return new Response(JSON.stringify({ error: "Binance API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check payment record exists
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (!payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "success") {
      return new Response(JSON.stringify({ success: true, message: "Already verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query Binance Pay transactions
    const timestamp = Date.now();
    const nonce = crypto.randomUUID().replace(/-/g, "").substring(0, 32);
    
    // Binance Pay API - query order list
    const startTime = payment.created_at ? new Date(payment.created_at).getTime() : Date.now() - 3600000;
    const endTime = Date.now();

    const body = JSON.stringify({
      startTimestamp: startTime,
      endTimestamp: endTime,
      limit: 100,
    });

    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = await hmacSha256(BINANCE_API_SECRET, payload);

    const binanceRes = await fetch("https://bpay.binanceapi.com/binancepay/openapi/v3/bill/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp.toString(),
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": BINANCE_API_KEY,
        "BinancePay-Signature": signature.toUpperCase(),
      },
      body,
    });

    const binanceData = await binanceRes.json();
    console.log("Binance response status:", binanceData.status);

    let verified = false;

    if (binanceData.status === "SUCCESS" && binanceData.data?.billList) {
      const expectedAmount = parseFloat(payment.amount_usd || payment.amount);
      
      for (const bill of binanceData.data.billList) {
        // Match by note/remark and amount
        const billAmount = parseFloat(bill.totalPayAmount || bill.transAmount || "0");
        const billNote = bill.remark || bill.payerInfo?.remark || "";
        
        if (billNote.includes(note) && Math.abs(billAmount - expectedAmount) < 0.02) {
          verified = true;
          break;
        }
      }
    }

    if (verified) {
      await supabase.from("payments").update({ status: "success", updated_at: new Date().toISOString() }).eq("id", paymentId);
      return new Response(JSON.stringify({ success: true, message: "Payment verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, message: "Payment not found in Binance records. Please wait and try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("verify-binance-payment error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
