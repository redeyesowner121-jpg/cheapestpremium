// ===== Resale Bot - DB & Admin helpers =====

import { TELEGRAM_API, sendMessage, forwardMessage } from "./telegram-api.ts";

export async function getConversationState(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", telegramId).single();
  return data ? { step: data.step, data: data.data || {} } : null;
}

export async function setConversationState(supabase: any, telegramId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({
    telegram_id: telegramId, step, data: stateData, updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

export async function deleteConversationState(supabase: any, telegramId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", telegramId);
}

export async function ensureWallet(supabase: any, telegramId: number) {
  const { data: existing } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  if (existing) return existing;
  const refCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: wallet } = await supabase.from("telegram_wallets").insert({ telegram_id: telegramId, referral_code: refCode }).select("*").single();
  return wallet;
}

export async function getWallet(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  return data;
}

export async function upsertUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert({
    telegram_id: user.id, username: user.username || null,
    first_name: user.first_name || null, last_name: user.last_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

export async function getUserLang(supabase: any, telegramId: number): Promise<string> {
  const { data } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", telegramId).single();
  return data?.language || "en";
}

export async function getAllAdminIds(supabase: any): Promise<number[]> {
  const SUPER_ADMIN_ID = 6898461453;
  const ids = [SUPER_ADMIN_ID];
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (data?.length) {
    for (const a of data) { if (!ids.includes(a.telegram_id)) ids.push(a.telegram_id); }
  }
  return ids;
}

export async function notifyAllAdminsMainBot(mainBotToken: string, supabase: any, text: string, opts?: { reply_markup?: any }) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await sendMessage(mainBotToken, adminId, text, opts); } catch { /* */ }
  }
}

export async function forwardToAllAdminsMainBot(mainBotToken: string, supabase: any, fromChatId: number, messageId: number) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await forwardMessage(mainBotToken, adminId, fromChatId, messageId); } catch { /* */ }
  }
}

/**
 * Re-download photo via source bot, re-upload via main bot to admins.
 * file_id is bot-scoped, so cross-bot forwarding fails.
 */
export async function resendPhotoToAllAdminsMainBot(
  sourceToken: string, mainBotToken: string, supabase: any,
  fileId: string, caption?: string
) {
  try {
    const fileRes = await fetch(`${TELEGRAM_API(sourceToken)}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileRes.json();
    if (!fileData?.result?.file_path) return false;
    const downloadUrl = `https://api.telegram.org/file/bot${sourceToken}/${fileData.result.file_path}`;
    const photoRes = await fetch(downloadUrl);
    if (!photoRes.ok) return false;
    const photoBlob = await photoRes.blob();
    const adminIds = await getAllAdminIds(supabase);
    let anySent = false;
    for (const adminId of adminIds) {
      try {
        const form = new FormData();
        form.append("chat_id", adminId.toString());
        form.append("photo", photoBlob, "photo.jpg");
        if (caption) {
          form.append("caption", caption);
          form.append("parse_mode", "HTML");
        }
        const res = await fetch(`https://api.telegram.org/bot${mainBotToken}/sendPhoto`, { method: "POST", body: form });
        const result = await res.json();
        if (result.ok) anySent = true;
      } catch (e) { console.error("resendPhoto admin error:", e); }
    }
    return anySent;
  } catch (e) { console.error("resendPhoto error:", e); return false; }
}
