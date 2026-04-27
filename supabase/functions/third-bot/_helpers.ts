// Shared helpers for the third-bot edge function
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const MAIN_BOT_USERNAME = "Air1_Premium_bot";
export const RESALE_BOT_USERNAME = "AIR1XOTT_bot";
export const THIRD_BOT_USERNAME = "third_store_bot";
export const THIRD_BOT_OWNER_ID = 7170630274;

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
        const strippedText = normalizedText.replace(/^🔴\s*/u, "").replace(/^🟥\s*/u, "").trim();
        return { ...button, text: `🔴 ${strippedText}`, color: "red" };
      })
    ),
  };
}

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  opts?: { reply_markup?: any; parse_mode?: string; disable_web_page_preview?: boolean }
) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts?.parse_mode || "HTML",
        disable_web_page_preview: opts?.disable_web_page_preview || false,
        ...(opts?.reply_markup && { reply_markup: normalizeBackButtons(opts.reply_markup) }),
      }),
    });
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}
