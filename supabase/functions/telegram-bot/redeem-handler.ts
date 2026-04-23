// ===== /redeem command handler — Gift code redemption (same codes as website) =====

import { sendMessage } from "./telegram-api.ts";
import { setConversationState, deleteConversationState, ensureWallet } from "./db-helpers.ts";
import { resolveProfileUserId } from "../_shared/profile-id-resolver.ts";

/**
 * Prompt the user to enter a redeem code.
 */
export async function handleRedeemCommand(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string,
  inlineCode?: string,
) {
  if (inlineCode && inlineCode.trim()) {
    await processRedeemCode(token, supabase, chatId, userId, lang, inlineCode.trim());
    return;
  }

  await setConversationState(supabase, userId, "awaiting_redeem_code", {});
  await sendMessage(token, chatId,
    lang === "bn"
      ? `🎁 <b>গিফট কোড রিডেম করুন</b>\n\nআপনার রিডিম কোডটি পাঠান।\n\nবাতিল করতে /cancel লিখুন।`
      : `🎁 <b>Redeem Gift Code</b>\n\nSend your redeem code below.\n\nType /cancel to cancel.`,
  );
}

/**
 * Process a submitted redeem code. Uses the website's redeem_gift_code RPC,
 * then mirrors the credit to the telegram wallet.
 */
export async function processRedeemCode(
  token: string,
  supabase: any,
  chatId: number,
  userId: number,
  lang: string,
  code: string,
) {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned || cleaned.length < 3) {
    await sendMessage(token, chatId,
      lang === "bn" ? "❌ অবৈধ কোড। আবার চেষ্টা করুন।" : "❌ Invalid code. Please try again.",
    );
    return;
  }

  // Resolve / auto-create the website profile linked to this telegram user
  const profileId = await resolveProfileUserId(supabase, userId);
  if (!profileId) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? "❌ আপনার প্রোফাইল তৈরি করা যায়নি। সাপোর্টের সাথে যোগাযোগ করুন।"
        : "❌ Could not link your profile. Please contact support.",
    );
    await deleteConversationState(supabase, userId);
    return;
  }

  // Call the website's RPC — handles validation, usage limits, expiry, dedupe
  const { data, error } = await supabase.rpc("redeem_gift_code", {
    _user_id: profileId,
    _code: cleaned,
  });

  if (error || !data?.success) {
    const rawMsg = (error?.message || "").toLowerCase();
    let msg: string;
    if (rawMsg.includes("already used")) {
      msg = lang === "bn" ? "❌ আপনি ইতিমধ্যে এই কোড ব্যবহার করেছেন।" : "❌ You have already used this code.";
    } else if (rawMsg.includes("expired")) {
      msg = lang === "bn" ? "❌ কোডের মেয়াদ শেষ হয়ে গেছে।" : "❌ This code has expired.";
    } else if (rawMsg.includes("limit")) {
      msg = lang === "bn" ? "❌ কোড ব্যবহারের সীমা শেষ।" : "❌ Code usage limit reached.";
    } else if (rawMsg.includes("invalid") || rawMsg.includes("not found") || rawMsg.includes("inactive")) {
      msg = lang === "bn" ? "❌ অবৈধ অথবা নিষ্ক্রিয় কোড।" : "❌ Invalid or inactive code.";
    } else {
      msg = lang === "bn" ? `❌ রিডেম ব্যর্থ: ${error?.message || "Unknown error"}` : `❌ Redeem failed: ${error?.message || "Unknown error"}`;
    }
    await sendMessage(token, chatId, msg);
    await deleteConversationState(supabase, userId);
    return;
  }

  const amount = Number(data.amount) || 0;
  const newWebBalance = Number(data.new_balance) || 0;
  const description = data.description || `Gift code: ${cleaned}`;

  // Mirror credit to telegram wallet so bot balance stays in sync
  await ensureWallet(supabase, userId);
  const { data: tgWallet } = await supabase
    .from("telegram_wallets")
    .select("balance, total_earned")
    .eq("telegram_id", userId)
    .single();

  const newTgBalance = (tgWallet?.balance || 0) + amount;
  const newTgEarned = (tgWallet?.total_earned || 0) + amount;

  await supabase.from("telegram_wallets").update({
    balance: newTgBalance,
    total_earned: newTgEarned,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: userId,
    type: "gift",
    amount,
    description: `Redeemed code: ${cleaned}`,
  });

  await deleteConversationState(supabase, userId);

  // Log proof to channel
  try {
    const { logProof, formatRedeemCode } = await import("./proof-logger.ts");
    const { data: botUser } = await supabase
      .from("telegram_bot_users")
      .select("first_name")
      .eq("telegram_id", userId)
      .maybeSingle();
    const proofText = formatRedeemCode(userId, cleaned, amount, botUser?.first_name);
    await logProof(token, proofText);
  } catch (e) {
    console.error("Redeem proof log error:", e);
  }

  const successMsg = lang === "bn"
    ? `✅ <b>গিফট কোড সফলভাবে রিডিম হয়েছে!</b>\n\n🎁 ${description}\n💰 যোগ হয়েছে: <b>₹${amount}</b>\n💼 নতুন ব্যালেন্স: <b>₹${newTgBalance}</b>`
    : `✅ <b>Gift Code Redeemed Successfully!</b>\n\n🎁 ${description}\n💰 Added: <b>₹${amount}</b>\n💼 New Balance: <b>₹${newTgBalance}</b>`;

  await sendMessage(token, chatId, successMsg, {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === "bn" ? "💰 ওয়ালেট দেখুন" : "💰 View Wallet", callback_data: "my_wallet", style: "success" }],
        [{ text: lang === "bn" ? "🏠 মেইন মেনু" : "🏠 Main Menu", callback_data: "back_main", style: "primary" }],
      ],
    },
  });
}
