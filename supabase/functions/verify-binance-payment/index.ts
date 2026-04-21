import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hmacSha512(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  ).then(k => crypto.subtle.sign("HMAC", k, encoder.encode(message)))
    .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join(""));
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function getCandidateIds(bill: Record<string, any>): string[] {
  const rawIds = [
    bill.billId,
    bill.orderId,
    bill.transactionId,
    bill.trxId,
    bill.payerInfo?.orderId,
    bill.receiverInfo?.orderId,
  ];
  return [...new Set(rawIds.map(normalizeText).filter(Boolean))];
}

function getCandidateAmounts(bill: Record<string, any>): number[] {
  const rawAmounts = [
    bill.totalPayAmount,
    bill.transAmount,
    bill.amount,
    ...(Array.isArray(bill.fundsDetail) ? bill.fundsDetail.map((item: any) => item?.amount) : []),
  ];

  return [...new Set(rawAmounts
    .map((value) => Number.parseFloat(String(value)))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(value)))];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { orderId, amount, paymentId, skipAmountCheck } = await req.json();
    if (!orderId || !paymentId) {
      return new Response(JSON.stringify({ error: "Missing orderId or paymentId" }), {
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

    // Check if this Order ID was already claimed
    const { data: alreadyUsed } = await supabase
      .from("used_binance_order_ids")
      .select("id, telegram_id, purpose")
      .eq("binance_order_id", normalizeText(orderId))
      .maybeSingle();

    if (alreadyUsed) {
      return new Response(JSON.stringify({
        success: false,
        alreadyClaimed: true,
        message: `This Order ID has already been claimed.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    
    const createdAtMs = payment.created_at ? new Date(payment.created_at).getTime() : Number.NaN;
    const startTime = Number.isFinite(createdAtMs)
      ? Math.max(0, createdAtMs - 15 * 60 * 1000)
      : Date.now() - 3600000;
    const endTime = Date.now();

    const body = JSON.stringify({
      startTimestamp: startTime,
      endTimestamp: endTime,
      limit: 100,
    });

    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = await hmacSha512(BINANCE_API_SECRET, payload);

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

    const binanceText = await binanceRes.text();
    let binanceData: any = {};

    try {
      binanceData = binanceText ? JSON.parse(binanceText) : {};
    } catch {
      console.error("Failed to parse Binance response:", binanceText);
      throw new Error("Invalid Binance response");
    }

    const expectedOrderId = normalizeText(orderId);
    const expectedAmount = amount ? Math.abs(Number.parseFloat(String(amount))) : null;

    const debugInfo: any = {
      httpStatus: binanceRes.status,
      status: binanceData?.status,
      code: binanceData?.code,
      errorMessage: binanceData?.errorMessage,
      billCount: Array.isArray(binanceData?.data?.billList) ? binanceData.data.billList.length : 0,
      expectedOrderId,
      expectedAmount,
      skipAmountCheck: !!skipAmountCheck,
      searchWindow: { startTime, endTime },
    };

    console.log("Binance verify request:", JSON.stringify(debugInfo));

    let verified = false;
    let matchDetails: any = null;
    let actualPaidAmount: number | null = null;

    if (binanceData.status === "SUCCESS" && binanceData.data?.billList) {
      const billSummaries: any[] = [];

      for (const bill of binanceData.data.billList) {
        const candidateIds = getCandidateIds(bill);
        const candidateAmounts = getCandidateAmounts(bill);
        
        const idMatch = candidateIds.some((candidate) => (
          candidate === expectedOrderId || candidate.includes(expectedOrderId) || expectedOrderId.includes(candidate)
        ));

        // If skipAmountCheck, we only need ID match
        const amountMatch = skipAmountCheck
          ? true
          : (expectedAmount !== null && candidateAmounts.some((candidate) => Math.abs(candidate - expectedAmount) < 0.02));

        billSummaries.push({
          billType: bill.billType,
          bizType: bill.bizType,
          candidateIds,
          candidateAmounts,
          idMatch,
          amountMatch,
        });

        if (idMatch && amountMatch) {
          verified = true;
          actualPaidAmount = candidateAmounts.length > 0 ? candidateAmounts[0] : null;
          matchDetails = { candidateIds, candidateAmounts };
          break;
        }
      }

      console.log("Bill matching details:", JSON.stringify(billSummaries));
    }

    if (verified) {
      console.log("✅ Payment VERIFIED:", JSON.stringify({ paymentId, matchDetails, actualPaidAmount }));
      await supabase.from("payments").update({ status: "success", updated_at: new Date().toISOString() }).eq("id", paymentId);
      return new Response(JSON.stringify({
        success: true,
        message: "Payment verified",
        actualPaidAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billCount = Array.isArray(binanceData?.data?.billList) ? binanceData.data.billList.length : 0;

    // Check if ID matched but amount didn't (for purchase flow wallet credit)
    let idFoundButAmountMismatch = false;
    let foundAmount: number | null = null;
    if (binanceData.status === "SUCCESS" && binanceData.data?.billList && !skipAmountCheck) {
      for (const bill of binanceData.data.billList) {
        const candidateIds = getCandidateIds(bill);
        const candidateAmounts = getCandidateAmounts(bill);
        const idMatch = candidateIds.some((candidate) => (
          candidate === expectedOrderId || candidate.includes(expectedOrderId) || expectedOrderId.includes(candidate)
        ));
        if (idMatch) {
          idFoundButAmountMismatch = true;
          foundAmount = candidateAmounts.length > 0 ? candidateAmounts[0] : null;
          break;
        }
      }
    }

    const failReason = binanceData.status !== "SUCCESS"
      ? `Binance API error: ${binanceData.errorMessage || binanceData.code || "unknown"}`
      : billCount === 0
        ? "No transactions found in the time window."
        : `Checked ${billCount} transactions — no matching Order ID found.`;

    console.log("❌ Payment NOT verified:", failReason, { idFoundButAmountMismatch, foundAmount });

    return new Response(JSON.stringify({
      success: false,
      message: `Payment not yet found. ${failReason} Please wait 1-2 minutes after paying and try again.`,
      debug: { billCount, expectedOrderId, expectedAmount },
      idFoundButAmountMismatch,
      foundAmount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("verify-binance-payment error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
