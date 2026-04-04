// ===== DATABASE HELPERS =====

import { SUPER_ADMIN_ID } from "./constants.ts";
import { sendMessage, forwardMessage } from "./telegram-api.ts";

// ===== ADMIN HELPERS =====

export function isSuperAdmin(userId: number): boolean {
  return userId === SUPER_ADMIN_ID;
}

export async function isAdminBot(supabase: any, userId: number): Promise<boolean> {
  if (userId === SUPER_ADMIN_ID) return true;
  const { data } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", userId).maybeSingle();
  return !!data;
}

export async function getAllAdminIds(supabase: any): Promise<number[]> {
  const ids = [SUPER_ADMIN_ID];
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (data?.length) {
    for (const a of data) {
      if (!ids.includes(a.telegram_id)) ids.push(a.telegram_id);
    }
  }
  return ids;
}

export async function notifyAllAdmins(token: string, supabase: any, text: string, opts?: { reply_markup?: any }, excludeId?: number) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    if (excludeId && adminId === excludeId) continue;
    try { await sendMessage(token, adminId, text, opts); } catch { /* admin may have blocked bot */ }
  }
}

export async function forwardToAllAdmins(token: string, supabase: any, fromChatId: number, messageId: number) {
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try { await forwardMessage(token, adminId, fromChatId, messageId); } catch { /* */ }
  }
}

// ===== CONVERSATION STATE =====

export async function getConversationState(supabase: any, telegramId: number): Promise<{ step: string; data: Record<string, any> } | null> {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", telegramId).single();
  return data ? { step: data.step, data: data.data || {} } : null;
}

export async function setConversationState(supabase: any, telegramId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({
    telegram_id: telegramId,
    step,
    data: stateData,
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

export async function deleteConversationState(supabase: any, telegramId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", telegramId);
}

// ===== SETTINGS =====

export async function getSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  data?.forEach((s: any) => (settings[s.key] = s.value));
  return settings;
}

// ===== USER HELPERS =====

export async function upsertTelegramUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert(
    {
      telegram_id: user.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      last_active: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );
}

export async function isBanned(supabase: any, telegramId: number): Promise<boolean> {
  const { data } = await supabase.from("telegram_bot_users").select("is_banned").eq("telegram_id", telegramId).single();
  return data?.is_banned === true;
}

export async function getUserLang(supabase: any, telegramId: number): Promise<string | null> {
  const { data } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", telegramId).single();
  return data?.language || null;
}

// Combined fetch: ban status + language in ONE query
export async function getUserData(supabase: any, telegramId: number): Promise<{ is_banned: boolean; language: string | null }> {
  const { data } = await supabase.from("telegram_bot_users").select("is_banned, language").eq("telegram_id", telegramId).single();
  return { is_banned: data?.is_banned === true, language: data?.language || null };
}

export async function setUserLang(supabase: any, telegramId: number, lang: string) {
  await supabase.from("telegram_bot_users").update({ language: lang }).eq("telegram_id", telegramId);
}

// ===== WALLET HELPERS =====

export async function ensureWallet(supabase: any, telegramId: number): Promise<any> {
  const { data: existing } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  if (existing) return existing;

  const refCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: wallet } = await supabase.from("telegram_wallets").insert({
    telegram_id: telegramId,
    referral_code: refCode,
  }).select("*").single();
  return wallet;
}

export async function getWallet(supabase: any, telegramId: number): Promise<any> {
  const { data } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).single();
  return data;
}

// ===== CHANNEL HELPERS =====

export async function getRequiredChannels(supabase: any): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "required_channels").maybeSingle();
  if (data?.value) {
    try {
      const channels = JSON.parse(data.value);
      if (Array.isArray(channels)) return channels;
    } catch { /* ignore parse error */ }
  }
  return [];
}

export async function addRequiredChannel(supabase: any, channel: string): Promise<string[]> {
  const channels = await getRequiredChannels(supabase);
  const normalized = channel.startsWith("@") ? channel : `@${channel}`;
  if (!channels.includes(normalized)) channels.push(normalized);
  await supabase.from("app_settings").upsert({ key: "required_channels", value: JSON.stringify(channels), updated_at: new Date().toISOString() }, { onConflict: "key" });
  return channels;
}

export async function removeRequiredChannel(supabase: any, channel: string): Promise<string[]> {
  const channels = await getRequiredChannels(supabase);
  const normalized = channel.startsWith("@") ? channel : `@${channel}`;
  const updated = channels.filter((c: string) => c.toLowerCase() !== normalized.toLowerCase());
  await supabase.from("app_settings").upsert({ key: "required_channels", value: JSON.stringify(updated), updated_at: new Date().toISOString() }, { onConflict: "key" });
  return updated;
}

// ===== CHANNEL MEMBERSHIP =====

export async function checkChannelMembership(token: string, userId: number, supabase?: any): Promise<boolean> {
  const { getChatMember } = await import("./telegram-api.ts");
  if (!supabase) return true;
  const channels = await getRequiredChannels(supabase);
  if (channels.length === 0) return true;
  // Check all channels in PARALLEL instead of sequential
  const results = await Promise.all(
    channels.map(ch => getChatMember(token, ch, userId))
  );
  return results.every(status => ["member", "administrator", "creator"].includes(status));
}
