// ===== Deposit Razorpay verify + wallet credit helper =====

import { sendMessage } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet, deleteConversationState, notifyAllAdmins } from "../db-helpers.ts";
import { logProof, formatDepositSuccess } from "../proof-logger.ts";

export async function verifyDepositRazorpay(token: string, supabase: any, chatId: number, userId: number, stateData: any, lang: string) {
  const { verifyAmount, reservationId, depositRequestId, payClickedAt } = stateData || {};

  await sendMessage(token, chatId, lang === "bn" ? "🔍 পেমেন্ট যাচাই করা হচ্ছে..." : "🔍 Verifying payment...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-razorpay-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ amount: verifyAmount, reservationId, depositRequestId, payClickedAt }),
    });

    const result = await verifyRes.json();

    if (result.success) {
      const baseAmount = Math.floor(verifyAmount);
      await creditWallet(supabase, userId, baseAmount, "razorpay_upi", `auto-verified`);
      await deleteConversationState(supabase, userId);
      const wallet = await getWallet(supabase, userId);
      await sendMessage(token, chatId,
        `✅ <b>${lang === "bn" ? "পেমেন্ট সফল!" : "Payment Verified!"}</b>\n\n💰 ₹${baseAmount} ${lang === "bn" ? "জমা হয়েছে" : "deposited"}\n💵 ${lang === "bn" ? "নতুন ব্যালেন্স" : "New Balance"}: <b>₹${wallet?.balance || 0}</b>`
      );
      await notifyAllAdmins(token, supabase,
        `💰 <b>Wallet Deposit (Razorpay Auto)</b>\n\n👤 User: <code>${userId}</code>\n💵 Amount: ₹${baseAmount} (paid ₹${verifyAmount})\n✅ Auto-verified`
      );
      let rName = "User";
      try {
        const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", userId).single();
        if (bu?.first_name) rName = bu.first_name;
      } catch {}
      try { await logProof(token, formatDepositSuccess(userId, baseAmount, "Razorpay Auto", rName)); } catch {}
    } else {
      const settingsForLink = await getSettings(supabase);
      const razorpayMeUrl = settingsForLink.payment_link || "https://razorpay.me/@asifikbalrubaiulislam";
      await sendMessage(token, chatId, `${result.message || (lang === "bn" ? "পেমেন্ট পাওয়া যায়নি।" : "Payment not found yet.")}\n\n${lang === "bn" ? "নিশ্চিত করুন যে ঠিক" : "Make sure you paid exactly"} <b>₹${verifyAmount}</b>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Pay Now", url: razorpayMeUrl }],
            [{ text: "✅ Verify Payment", callback_data: "deposit_razorpay_verify" }],
            [{ text: "❌ Cancel", callback_data: "deposit_cancel" }],
          ],
        },
      });
    }
  } catch (err) {
    console.error("Deposit razorpay verify error:", err);
    await sendMessage(token, chatId, "Verification error. Try again.", {
      reply_markup: { inline_keyboard: [[{ text: "✅ Verify", callback_data: "deposit_razorpay_verify" }]] },
    });
  }
}

// ===== HELPER: Credit wallet =====
export async function creditWallet(supabase: any, userId: number, amount: number, method: string, note: string) {
  const wallet = await ensureWallet(supabase, userId);
  const newBalance = (wallet?.balance || 0) + amount;
  const newEarned = (wallet?.total_earned || 0) + amount;

  await supabase.from("telegram_wallets").update({
    balance: newBalance,
    total_earned: newEarned,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId,
    type: "deposit",
    amount,
    description: `Deposit via ${method} (Note: ${note})`,
  });

  const { syncDepositToProfile } = await import("./sync-helpers.ts");
  await syncDepositToProfile(supabase, userId, amount, method);
}
