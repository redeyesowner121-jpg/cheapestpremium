// ===== TELEGRAM API HELPERS =====

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

export async function sendMessage(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts?.parse_mode || "HTML",
        ...(opts?.reply_markup && { reply_markup: opts.reply_markup }),
      }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.error("sendMessage failed:", JSON.stringify(result));
    }
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}

export async function sendPhoto(token: string, chatId: number, photoUrl: string, caption: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup }),
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

export async function getChatMember(token: string, chatId: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json();
    return data?.result?.status || "left";
  } catch {
    return "left";
  }
}

export async function getUserProfilePhotos(token: string, userId: number): Promise<string | null> {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, limit: 1 }),
    });
    const data = await res.json();
    if (!data?.result?.photos?.length) return null;

    const fileId = data.result.photos[0][data.result.photos[0].length - 1].file_id;

    const fileRes = await fetch(`${TELEGRAM_API(token)}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileRes.json();
    if (!fileData?.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
  } catch (e) {
    console.error("getUserProfilePhotos error:", e);
    return null;
  }
}

export async function sendMessageWithId(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }): Promise<number | null> {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts?.parse_mode || "HTML",
        ...(opts?.reply_markup && { reply_markup: opts.reply_markup }),
      }),
    });
    const result = await res.json();
    return result?.result?.message_id || null;
  } catch {
    return null;
  }
}

export async function editMessageText(token: string, chatId: number, messageId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  try {
    await fetch(`${TELEGRAM_API(token)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: opts?.parse_mode || "HTML",
        ...(opts?.reply_markup && { reply_markup: opts.reply_markup }),
      }),
    });
  } catch (e) {
    console.error("editMessageText error:", e);
  }
}

export function getTelegramApiUrl(token: string): string {
  return TELEGRAM_API(token);
}
