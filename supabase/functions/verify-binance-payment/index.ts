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

function getCandidateNotes(bill: Record<string, any>): string[] {
  const rawNotes = [
    bill.remark,
    bill.note,
    bill.memo,
    bill.payNote,
    bill.bizMemo,
    bill.receiverNote,
    bill.payerInfo?.remark,
    bill.payerInfo?.note,
    bill.receiverInfo?.remark,
    bill.receiverInfo?.note,
  ];

  return [...new Set(rawNotes.map(normalizeText).filter(Boolean))];
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

    const debugInfo: any = {
      httpStatus: binanceRes.status,
      status: binanceData?.status,
      code: binanceData?.code,
      errorMessage: binanceData?.errorMessage,
      billCount: Array.isArray(binanceData?.data?.billList) ? binanceData.data.billList.length : 0,
      expectedNote: normalizeText(note),
      expectedAmount: Math.abs(Number.parseFloat(String(payment.amount_usd ?? payment.amount ?? amount))),
      searchWindow: { startTime, endTime },
    };

    console.log("Binance verify request:", JSON.stringify(debugInfo));

    let verified = false;
    let matchDetails: any = null;

    if (binanceData.status === "SUCCESS" && binanceData.data?.billList) {
      const expectedAmount = debugInfo.expectedAmount;
      const expectedNote = debugInfo.expectedNote;
      
      const billSummaries: any[] = [];

      for (const bill of binanceData.data.billList) {
        const candidateNotes = getCandidateNotes(bill);
        const candidateAmounts = getCandidateAmounts(bill);
        const noteMatch = candidateNotes.some((candidate) => (
          candidate === expectedNote || candidate.includes(expectedNote) || expectedNote.includes(candidate)
        ));
        const amountMatch = candidateAmounts.some((candidate) => Math.abs(candidate - expectedAmount) < 0.02);

        billSummaries.push({
          billType: bill.billType,
          bizType: bill.bizType,
          candidateNotes,
          candidateAmounts,
          noteMatch,
          amountMatch,
        });

        if (noteMatch && amountMatch) {
          verified = true;
          matchDetails = { candidateNotes, candidateAmounts };
          break;
        }
      }

      console.log("Bill matching details:", JSON.stringify(billSummaries));
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
