// ===== /send COMMAND - P2P Balance Transfer =====
import { sendMessage } from "./telegram-api.ts";
import { getWallet, setConversationState } from "./db-helpers.ts";
import { DAILY_SEND_LIMIT, MIN_SEND_AMOUNT, getDailySendCount, findRecipient } from "./send/send-helpers.ts";

export { executeSendTransfer } from "./send/execute-transfer.ts";

// Step 1: /send command entry
export async function handleSendCommand(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const dailyCount = await getDailySendCount(supabase, userId);
  if (dailyCount >= DAILY_SEND_LIMIT) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? `❌ আপনি আজ ইতিমধ্যে ${DAILY_SEND_LIMIT} বার সেন্ড করেছেন। আগামীকাল আবার চেষ্টা করুন।`
        : `❌ You've already sent ${DAILY_SEND_LIMIT} times today. Try again tomorrow.`);
    return;
  }

  await setConversationState(supabase, userId, "send_awaiting_recipient", {});
  await sendMessage(token, chatId,
    lang === "bn"
      ? `💸 <b>ব্যালেন্স সেন্ড</b>\n\nযাকে সেন্ড করতে চান তার:\n• টেলিগ্রাম ইউজারনেম (যেমন: @username)\n• অথবা টেলিগ্রাম আইডি (সংখ্যা)\n\nলিখে পাঠান 👇\n\n/cancel বাতিল করতে`
      : `💸 <b>Send Balance</b>\n\nEnter the recipient's:\n• Telegram username (e.g. @username)\n• Or Telegram numeric ID\n\nSend it below 👇\n\n/cancel to abort`,
    { reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "back_main" }]] } }
  );
}

// Step 2: Recipient entered → ask amount
export async function handleSendRecipientStep(token: string, supabase: any, chatId: number, userId: number, text: string, lang: string) {
  const input = text.trim().replace(/^@/, "");

  if (!input) {
    await sendMessage(token, chatId, lang === "bn" ? "⚠️ সঠিক ইউজারনেম বা আইডি দিন।" : "⚠️ Please enter a valid username or ID.");
    return;
  }

  const { recipientId, recipientName } = await findRecipient(supabase, input);

  if (!recipientId) {
    await sendMessage(token, chatId,
      lang === "bn" ? "❌ এই ইউজার খুঁজে পাওয়া যায়নি। সঠিক ইউজারনেম বা আইডি দিন।"
        : "❌ User not found. Please enter a valid username or ID.");
    return;
  }

  if (recipientId === userId) {
    await sendMessage(token, chatId, lang === "bn" ? "❌ নিজেকে সেন্ড করতে পারবেন না।" : "❌ You can't send to yourself.");
    return;
  }

  const wallet = await getWallet(supabase, userId);
  const balance = wallet?.balance || 0;

  await setConversationState(supabase, userId, "send_awaiting_amount", { recipientId, recipientName });

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
      lang === "bn" ? `⚠️ সর্বনিম্ন ₹${MIN_SEND_AMOUNT} সেন্ড করতে হবে।` : `⚠️ Minimum send amount is ₹${MIN_SEND_AMOUNT}.`);
    return;
  }

  if (amount > balance) {
    await sendMessage(token, chatId,
      lang === "bn" ? `⚠️ অপর্যাপ্ত ব্যালেন্স। আপনার ব্যালেন্স: ₹${balance}` : `⚠️ Insufficient balance. Your balance: ₹${balance}`);
    return;
  }

  await setConversationState(supabase, userId, "send_confirm", { ...stateData, amount });

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
