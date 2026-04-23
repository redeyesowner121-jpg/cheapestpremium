// ===== /send COMMAND - P2P Balance Transfer =====

import { sendMessage } from "./telegram-api.ts";
import { getWallet, setConversationState, deleteConversationState, getUserLang } from "./db-helpers.ts";
import { logProof } from "./proof-logger.ts";

const DAILY_SEND_LIMIT = 2;
const MIN_SEND_AMOUNT = 10;

function getTimeIST(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function maskName(name: string): string {
  if (!name || name.length <= 2) return name || "User";
  return name[0] + "•".repeat(Math.min(name.length - 2, 4)) + name[name.length - 1];
}

async function getDailySendCount(supabase: any, telegramId: number): Promise<number> {
  // Count today's transfers (IST timezone)
  const todayStart = new Date();
  todayStart.setHours(todayStart.getHours() + 5, todayStart.getMinutes() + 30); // Convert to IST
  todayStart.setHours(0, 0, 0, 0);
  todayStart.setHours(todayStart.getHours() - 5, todayStart.getMinutes() - 30); // Back to UTC

  const { count } = await supabase
    .from("telegram_wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("telegram_id", telegramId)
    .eq("type", "transfer_out")
    .gte("created_at", todayStart.toISOString());

  return count || 0;
}

// Step 1: /send command entry
export async function handleSendCommand(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  // Check daily limit
  const dailyCount = await getDailySendCount(supabase, userId);
  if (dailyCount >= DAILY_SEND_LIMIT) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? `❌ আপনি আজ ইতিমধ্যে ${DAILY_SEND_LIMIT} বার সেন্ড করেছেন। আগামীকাল আবার চেষ্টা করুন।`
        : `❌ You've already sent ${DAILY_SEND_LIMIT} times today. Try again tomorrow.`
    );
    return;
  }

  await setConversationState(supabase, userId, "send_awaiting_recipient", {});
  await sendMessage(token, chatId,
    lang === "bn"
      ? `💸 <b>ব্যালেন্স সেন্ড</b>\n\nযাকে সেন্ড করতে চান তার:\n• টেলিগ্রাম ইউজারনেম (যেমন: @username)\n• অথবা টেলিগ্রাম আইডি (সংখ্যা)\n\nলিখে পাঠান 👇\n\n/cancel বাতিল করতে`
      : `💸 <b>Send Balance</b>\n\nEnter the recipient's:\n• Telegram username (e.g. @username)\n• Or Telegram numeric ID\n\nSend it below 👇\n\n/cancel to abort`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "back_main" }]],
      },
    }
  );
}

// Step 2: Recipient entered → ask amount
export async function handleSendRecipientStep(token: string, supabase: any, chatId: number, userId: number, text: string, lang: string) {
  const input = text.trim().replace(/^@/, "");

  if (!input) {
    await sendMessage(token, chatId, lang === "bn" ? "⚠️ সঠিক ইউজারনেম বা আইডি দিন।" : "⚠️ Please enter a valid username or ID.");
    return;
  }

  let recipientId: number | null = null;
  let recipientName = "User";

  // Try numeric ID first
  if (/^\d+$/.test(input)) {
    const numId = parseInt(input, 10);
    const { data: user } = await supabase
      .from("telegram_bot_users")
      .select("telegram_id, first_name, username")
      .eq("telegram_id", numId)
      .maybeSingle();

    if (user) {
      recipientId = user.telegram_id;
      recipientName = user.first_name || user.username || "User";
    }
  }

  // Try username
  if (!recipientId) {
    const { data: user } = await supabase
      .from("telegram_bot_users")
      .select("telegram_id, first_name, username")
      .ilike("username", input)
      .maybeSingle();

    if (user) {
      recipientId = user.telegram_id;
      recipientName = user.first_name || user.username || "User";
    }
  }

  if (!recipientId) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? "❌ এই ইউজার খুঁজে পাওয়া যায়নি। সঠিক ইউজারনেম বা আইডি দিন।"
        : "❌ User not found. Please enter a valid username or ID."
    );
    return;
  }

  if (recipientId === userId) {
    await sendMessage(token, chatId,
      lang === "bn" ? "❌ নিজেকে সেন্ড করতে পারবেন না।" : "❌ You can't send to yourself."
    );
    return;
  }

  const wallet = await getWallet(supabase, userId);
  const balance = wallet?.balance || 0;

  await setConversationState(supabase, userId, "send_awaiting_amount", {
    recipientId,
    recipientName,
  });

  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ প্রাপক: <b>${recipientName}</b> (<code>${recipientId}</code>)\n\n💰 আপনার ব্যালেন্স: <b>₹${balance}</b>\n\n✏️ কত টাকা সেন্ড করতে চান? (সর্বনিম্ন ₹${MIN_SEND_AMOUNT})`
      : `✅ Recipient: <b>${recipientName}</b> (<code>${recipientId}</code>)\n\n💰 Your balance: <b>₹${balance}</b>\n\n✏️ How much to send? (Min ₹${MIN_SEND_AMOUNT})`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "₹50", callback_data: "send_amt_50" },
            { text: "₹100", callback_data: "send_amt_100" },
            { text: "₹500", callback_data: "send_amt_500" },
          ],
          [{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "back_main" }],
        ],
      },
    }
  );
}

// Step 3: Amount entered → confirm
export async function handleSendAmountStep(token: string, supabase: any, chatId: number, userId: number, amount: number, stateData: Record<string, any>, lang: string) {
  const wallet = await getWallet(supabase, userId);
  const balance = wallet?.balance || 0;

  if (isNaN(amount) || amount < MIN_SEND_AMOUNT) {
    await sendMessage(token, chatId,
      lang === "bn" ? `⚠️ সর্বনিম্ন ₹${MIN_SEND_AMOUNT} সেন্ড করতে হবে।` : `⚠️ Minimum send amount is ₹${MIN_SEND_AMOUNT}.`
    );
    return;
  }

  if (amount > balance) {
    await sendMessage(token, chatId,
      lang === "bn" ? `⚠️ অপর্যাপ্ত ব্যালেন্স। আপনার ব্যালেন্স: ₹${balance}` : `⚠️ Insufficient balance. Your balance: ₹${balance}`
    );
    return;
  }

  await setConversationState(supabase, userId, "send_confirm", {
    ...stateData,
    amount,
  });

  await sendMessage(token, chatId,
    lang === "bn"
      ? `📋 <b>ট্রান্সফার কনফার্ম করুন</b>\n\n👤 প্রাপক: <b>${stateData.recipientName}</b>\n💰 পরিমাণ: <b>₹${amount}</b>\n\nকনফার্ম করতে নিচের বাটন চাপুন 👇`
      : `📋 <b>Confirm Transfer</b>\n\n👤 Recipient: <b>${stateData.recipientName}</b>\n💰 Amount: <b>₹${amount}</b>\n\nPress confirm below 👇`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "✅ কনফার্ম" : "✅ Confirm", callback_data: "send_confirm_yes" }],
          [{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "back_main" }],
        ],
      },
    }
  );
}

// Step 4: Confirm callback → execute transfer
export async function executeSendTransfer(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const { getConversationState } = await import("./db-helpers.ts");
  const state = await getConversationState(supabase, userId);
  if (!state || state.step !== "send_confirm") {
    await sendMessage(token, chatId, lang === "bn" ? "❌ সেশন শেষ হয়ে গেছে।" : "❌ Session expired.");
    return;
  }

  const { recipientId, recipientName, amount } = state.data;

  // Re-check daily limit
  const dailyCount = await getDailySendCount(supabase, userId);
  if (dailyCount >= DAILY_SEND_LIMIT) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId,
      lang === "bn"
        ? `❌ আজকের সেন্ড লিমিট (${DAILY_SEND_LIMIT}) শেষ।`
        : `❌ Daily send limit (${DAILY_SEND_LIMIT}) reached.`
    );
    return;
  }

  // Re-check balance
  const senderWallet = await getWallet(supabase, userId);
  if (!senderWallet || senderWallet.balance < amount) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, lang === "bn" ? "❌ অপর্যাপ্ত ব্যালেন্স।" : "❌ Insufficient balance.");
    return;
  }

  const receiverWallet = await getWallet(supabase, recipientId);
  if (!receiverWallet) {
    await deleteConversationState(supabase, userId);
    await sendMessage(token, chatId, lang === "bn" ? "❌ প্রাপকের ওয়ালেট পাওয়া যায়নি।" : "❌ Recipient wallet not found.");
    return;
  }

  // Deduct from sender
  await supabase.from("telegram_wallets").update({
    balance: senderWallet.balance - amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", userId);

  // Add to receiver
  await supabase.from("telegram_wallets").update({
    balance: receiverWallet.balance + amount,
    total_earned: (receiverWallet.total_earned || 0) + amount,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", recipientId);

  // Get sender name
  let senderName = "User";
  try {
    const { data: su } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", userId).maybeSingle();
    if (su?.first_name) senderName = su.first_name;
  } catch {}

  // Record transactions
  await supabase.from("telegram_wallet_transactions").insert([
    {
      telegram_id: userId,
      type: "transfer_out",
      amount: -amount,
      description: `Sent to ${recipientName} (${recipientId})`,
    },
    {
      telegram_id: recipientId,
      type: "transfer_in",
      amount: amount,
      description: `Received from ${senderName} (${userId})`,
    },
  ]);

  await deleteConversationState(supabase, userId);

  const newBalance = senderWallet.balance - amount;
  const remaining = DAILY_SEND_LIMIT - dailyCount - 1;

  // Notify sender
  await sendMessage(token, chatId,
    lang === "bn"
      ? `✅ <b>সফলভাবে সেন্ড হয়েছে!</b>\n\n👤 প্রাপক: <b>${recipientName}</b>\n💰 পরিমাণ: <b>₹${amount}</b>\n💳 নতুন ব্যালেন্স: <b>₹${newBalance}</b>\n\n📊 আজ আর ${remaining} বার সেন্ড করতে পারবেন।`
      : `✅ <b>Transfer Successful!</b>\n\n👤 Recipient: <b>${recipientName}</b>\n💰 Amount: <b>₹${amount}</b>\n💳 New Balance: <b>₹${newBalance}</b>\n\n📊 ${remaining} send(s) remaining today.`,
    { reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
  );

  // Notify receiver
  const receiverLang = (await getUserLang(supabase, recipientId)) || "en";
  await sendMessage(token, recipientId,
    receiverLang === "bn"
      ? `💰 <b>ব্যালেন্স পেয়েছেন!</b>\n\n👤 প্রেরক: <b>${senderName}</b>\n💵 পরিমাণ: <b>₹${amount}</b>\n💳 নতুন ব্যালেন্স: <b>₹${(receiverWallet.balance || 0) + amount}</b>`
      : `💰 <b>Balance Received!</b>\n\n👤 From: <b>${senderName}</b>\n💵 Amount: <b>₹${amount}</b>\n💳 New Balance: <b>₹${(receiverWallet.balance || 0) + amount}</b>`,
    { reply_markup: { inline_keyboard: [[{ text: receiverLang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] } }
  );

  // Log proof
  try {
    const proofText = `┌─────────────────────┐\n` +
      `   💸 <b>P2P TRANSFER</b>\n` +
      `└─────────────────────┘\n\n` +
      `👤 From: <b>${maskName(senderName)}</b>\n` +
      `👤 To: <b>${maskName(recipientName)}</b>\n` +
      `💰 Amount: <b>₹${amount}</b>\n` +
      `🕐 ${getTimeIST()}\n\n` +
      `💎 <i>Trusted P2P transfer!</i>`;
    await logProof(token, proofText);
  } catch {}

  // Sync to website profile
  try {
    const { resolveProfileUserId } = await import("../_shared/profile-id-resolver.ts");
    const senderProfileId = await resolveProfileUserId(supabase, userId);
    const receiverProfileId = await resolveProfileUserId(supabase, recipientId);

    if (senderProfileId) {
      const { data: sp } = await supabase.from("profiles").select("wallet_balance").eq("id", senderProfileId).single();
      if (sp) {
        await supabase.from("profiles").update({ wallet_balance: Math.max(0, (sp.wallet_balance || 0) - amount) }).eq("id", senderProfileId);
      }
    }
    if (receiverProfileId) {
      const { data: rp } = await supabase.from("profiles").select("wallet_balance").eq("id", receiverProfileId).single();
      if (rp) {
        await supabase.from("profiles").update({ wallet_balance: (rp.wallet_balance || 0) + amount }).eq("id", receiverProfileId);
      }
    }
  } catch (e) {
    console.error("Send: profile sync error:", e);
  }
}
