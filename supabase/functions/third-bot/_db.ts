import { THIRD_BOT_OWNER_ID } from "./_helpers.ts";

export async function upsertTelegramUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert({
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

export async function getUserLang(supabase: any, telegramId: number): Promise<string> {
  const { data } = await supabase.from("telegram_bot_users").select("language").eq("telegram_id", telegramId).maybeSingle();
  return data?.language || "en";
}

export async function isThirdBotAdmin(supabase: any, userId: number): Promise<boolean> {
  if (userId === THIRD_BOT_OWNER_ID) return true;
  const { data } = await supabase.from("telegram_bot_admins").select("id").eq("telegram_id", userId).maybeSingle();
  return !!data;
}

export async function ensureWallet(supabase: any, telegramId: number) {
  const { data: existing } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).maybeSingle();
  if (existing) return existing;
  const refCode = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: wallet } = await supabase.from("telegram_wallets").insert({ telegram_id: telegramId, referral_code: refCode }).select("*").single();
  return wallet;
}

export async function getWallet(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_wallets").select("*").eq("telegram_id", telegramId).maybeSingle();
  return data;
}

export async function getConversationState(supabase: any, telegramId: number) {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", telegramId).maybeSingle();
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
