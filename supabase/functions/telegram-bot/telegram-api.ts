// ===== TELEGRAM API HELPERS =====

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

function normalizeBackButtons(replyMarkup?: any) {
  if (!replyMarkup?.inline_keyboard) return replyMarkup;

  return {
    ...replyMarkup,
    inline_keyboard: replyMarkup.inline_keyboard.map((row: any[]) =>
      row.map((button: any) => {
        if (!button?.text) return button;

        const normalizedText = String(button.text).trim();
        const callbackData = typeof button.callback_data === "string" ? button.callback_data : "";
        const isBackButton =
          /back/i.test(normalizedText) ||
          /main\s*menu/i.test(normalizedText) ||
          /মূল\s*মেনু/i.test(normalizedText) ||
          /পিছনে/i.test(normalizedText) ||
          /ফিরুন/i.test(normalizedText) ||
          /cancel/i.test(normalizedText) ||
          /বাতিল/i.test(normalizedText) ||
          normalizedText.includes("⬅️") ||
          normalizedText.includes("◀️") ||
          normalizedText.includes("🔙") ||
          /back/i.test(callbackData) ||
          /^(back_main|back_products|adm_back|cadm_back|cadm_settings|adm_settings|adm_ai_training|gw_main|gw_products|gwa_admin|mother_admin|mother_my_bots|third_back|my_wallet|deposit_cancel|binance_cancel)$/.test(callbackData);

        if (!isBackButton) return button;

        const strippedText = normalizedText
          .replace(/^🔴\s*/u, "")
          .replace(/^🟥\s*/u, "")
          .trim();

        return {
          ...button,
          text: strippedText,
          color: "red",
          style: "danger",
        };
      })
    ),
  };
}

function stripPremiumEmojiTags(content: string): string {
  return String(content).replace(/<tg-emoji\b[^>]*>(.*?)<\/tg-emoji>/gisu, "$1");
}

function shouldRetryWithoutPremiumEmoji(result: any, content?: string): boolean {
  const description = String(result?.description || "");
  return description.includes("DOCUMENT_INVALID") && content !== stripPremiumEmojiTags(content || "");
}

async function telegramRequest(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function retryWithoutPremiumEmoji(
  token: string,
  method: string,
  body: Record<string, unknown>,
  contentField: "text" | "caption",
) {
  const sanitizedBody = {
    ...body,
    [contentField]: stripPremiumEmojiTags(String(body[contentField] || "")),
  };

  const retryResult = await telegramRequest(token, method, sanitizedBody);
  if (!retryResult.ok) {
    console.error(`${method} retry failed:`, JSON.stringify(retryResult));
  }
  return retryResult;
}

export async function sendMessage(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  try {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode || "HTML",
      ...(opts?.reply_markup && { reply_markup: normalizeBackButtons(opts.reply_markup) }),
    };

    const result = await telegramRequest(token, "sendMessage", body);
    if (!result.ok) {
      if (shouldRetryWithoutPremiumEmoji(result, text)) {
        await retryWithoutPremiumEmoji(token, "sendMessage", body, "text");
        return;
      }
      console.error("sendMessage failed:", JSON.stringify(result));
    }
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}

export async function sendPhoto(token: string, chatId: number, photoUrl: string, caption: string, replyMarkup?: any) {
  try {
    const body = {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: normalizeBackButtons(replyMarkup) }),
    };

    const result = await telegramRequest(token, "sendPhoto", body);
    if (!result.ok) {
      if (shouldRetryWithoutPremiumEmoji(result, caption)) {
        await retryWithoutPremiumEmoji(token, "sendPhoto", body, "caption");
        return;
      }
      console.error("sendPhoto failed:", JSON.stringify(result));
    }
  } catch (e) {
    console.error("sendPhoto error:", e);
  }
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
    const body = {
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode || "HTML",
      ...(opts?.reply_markup && { reply_markup: normalizeBackButtons(opts.reply_markup) }),
    };

    let result = await telegramRequest(token, "sendMessage", body);
    if (!result.ok && shouldRetryWithoutPremiumEmoji(result, text)) {
      result = await retryWithoutPremiumEmoji(token, "sendMessage", body, "text");
    }

    if (!result.ok) {
      console.error("sendMessageWithId failed:", JSON.stringify(result));
      return null;
    }

    return result?.result?.message_id || null;
  } catch {
    return null;
  }
}

export async function editMessageText(token: string, chatId: number, messageId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };
    if (opts?.parse_mode) body.parse_mode = opts.parse_mode;
    if (opts?.reply_markup) body.reply_markup = normalizeBackButtons(opts.reply_markup);

    let result = await telegramRequest(token, "editMessageText", body);
    if (!result.ok && shouldRetryWithoutPremiumEmoji(result, text)) {
      result = await retryWithoutPremiumEmoji(token, "editMessageText", body, "text");
    }

    if (!result.ok) {
      console.error("editMessageText failed:", JSON.stringify(result));
    }
  } catch (e) {
    console.error("editMessageText error:", e);
  }
}

export function getTelegramApiUrl(token: string): string {
  return TELEGRAM_API(token);
}

export async function sendChatAction(token: string, chatId: number, action: string = "typing") {
  try {
    await fetch(`${TELEGRAM_API(token)}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (e) {
    console.error("sendChatAction error:", e);
  }
}
