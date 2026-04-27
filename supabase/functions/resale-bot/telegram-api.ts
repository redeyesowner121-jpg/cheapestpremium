// ===== Resale Bot - Telegram API helpers =====

export const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

export function normalizeBackButtons(replyMarkup?: any) {
  if (!replyMarkup?.inline_keyboard) return replyMarkup;
  return {
    ...replyMarkup,
    inline_keyboard: replyMarkup.inline_keyboard.map((row: any[]) =>
      row.map((button: any) => {
        if (!button?.text) return button;
        const normalizedText = String(button.text).trim();
        const isBackButton =
          /back/i.test(normalizedText) ||
          normalizedText.includes("⬅️") ||
          normalizedText.includes("◀️") ||
          normalizedText.includes("🔙");
        if (!isBackButton) return button;
        const strippedText = normalizedText
          .replace(/^🔴\s*/u, "")
          .replace(/^🟥\s*/u, "")
          .trim();
        return { ...button, text: `🔴 ${strippedText}`, color: "red" };
      })
    ),
  };
}

export async function sendMessage(token: string, chatId: number, text: string, opts?: { reply_markup?: any }) {
  await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML",
      ...(opts?.reply_markup && { reply_markup: normalizeBackButtons(opts.reply_markup) }),
    }),
  });
}

export async function forwardMessage(token: string, chatId: number, fromChatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API(token)}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, from_chat_id: fromChatId, message_id: messageId }),
  });
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
  });
}
