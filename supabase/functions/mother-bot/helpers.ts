// ===== MOTHER BOT HELPERS =====

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;

export async function sendMsg(token: string, chatId: number, text: string, opts?: { reply_markup?: any; parse_mode?: string }) {
  try {
    await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: opts?.parse_mode || "HTML", ...(opts?.reply_markup && { reply_markup: opts.reply_markup }) }),
    });
  } catch (e) { console.error("sendMsg error:", e); }
}

export async function answerCb(token: string, cbId: string, text?: string) {
  await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId, text: text || "" }),
  }).catch(() => {});
}

export async function getChatMemberStatus(token: string, chatId: string, userId: number): Promise<string> {
  try {
    const res = await fetch(`${TELEGRAM_API(token)}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json();
    return data?.result?.status || "left";
  } catch { return "left"; }
}

export async function validateBotToken(token: string): Promise<{ ok: boolean; username?: string; id?: number }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data?.ok && data.result) {
      return { ok: true, username: data.result.username, id: data.result.id };
    }
    return { ok: false };
  } catch { return { ok: false }; }
}

// ===== CONVERSATION STATE =====
export async function getConvState(supabase: any, tgId: number) {
  const { data } = await supabase.from("telegram_conversation_state").select("step, data").eq("telegram_id", tgId).single();
  return data ? { step: data.step, data: data.data || {} } : null;
}

export async function setConvState(supabase: any, tgId: number, step: string, stateData: Record<string, any>) {
  await supabase.from("telegram_conversation_state").upsert({ telegram_id: tgId, step, data: stateData, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
}

export async function deleteConvState(supabase: any, tgId: number) {
  await supabase.from("telegram_conversation_state").delete().eq("telegram_id", tgId);
}

// ===== MOTHER BOT OWNER =====
export const MOTHER_OWNER_ID = 6898461453;

export function isMotherOwner(userId: number): boolean {
  return userId === MOTHER_OWNER_ID;
}

export async function getAdminTelegramIds(supabase: any): Promise<number[]> {
  const SUPER_ADMIN_ID = 1667104164;
  const ids = [SUPER_ADMIN_ID, MOTHER_OWNER_ID];
  const { data } = await supabase.from("telegram_bot_admins").select("telegram_id");
  if (data?.length) {
    for (const a of data) {
      if (!ids.includes(a.telegram_id)) ids.push(a.telegram_id);
    }
  }
  return ids;
}

export async function notifyAdminsViaMainBot(mainToken: string, supabase: any, text: string, opts?: { reply_markup?: any }) {
  const adminIds = await getAdminTelegramIds(supabase);
  for (const adminId of adminIds) {
    try { await sendMsg(mainToken, adminId, text, opts); } catch { /* admin may have blocked bot */ }
  }
}

export async function getRequiredChannels(supabase: any): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "mother_required_channels").maybeSingle();
  if (data?.value) {
    try { const ch = JSON.parse(data.value); if (Array.isArray(ch)) return ch; } catch {}
  }
  return [];
}

export async function saveRequiredChannels(supabase: any, channels: string[]) {
  await supabase.from("app_settings").upsert(
    { key: "mother_required_channels", value: JSON.stringify(channels), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

export async function upsertMotherUser(supabase: any, user: any) {
  await supabase.from("mother_bot_users").upsert({
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}
