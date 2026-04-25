import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TELEGRAM_ID_PATTERN = /^\d+$/;

async function findProfileByTelegramId(supabase: any, telegramId: number) {
  const email = `telegram_${telegramId}@bot.local`;
  const { data: linkedProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (linkedProfile?.id) return linkedProfile;

  const { data: botUser } = await supabase
    .from("telegram_bot_users")
    .select("email, email_verified")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (botUser?.email_verified && botUser?.email) {
    const { data: emailProfile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", botUser.email)
      .maybeSingle();

    if (emailProfile?.id) return emailProfile;
  }

  const { data: fallbackProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return fallbackProfile;
}

async function getTelegramDisplayName(supabase: any, telegramId: number) {
  for (const table of ["telegram_bot_users", "mother_bot_users", "child_bot_users"]) {
    try {
      const { data } = await supabase
        .from(table)
        .select("first_name, username")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      const displayName = data?.first_name || data?.username;
      if (displayName) return displayName;
    } catch {
      continue;
    }
  }

  return `User_${telegramId}`;
}

async function ensureTelegramProfile(supabase: any, telegramId: number): Promise<string | null> {
  const existingProfile = await findProfileByTelegramId(supabase, telegramId);
  if (existingProfile?.id) {
    const { data: botUser } = await supabase
      .from("telegram_bot_users")
      .select("email, email_verified")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (botUser?.email_verified && botUser?.email) {
      await supabase.rpc("merge_telegram_email_account", {
        _telegram_id: telegramId,
        _email: botUser.email,
      });
    }

    return existingProfile.id;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceKey) return null;

  const email = `telegram_${telegramId}@bot.local`;
  const stablePassword = `tg_${telegramId}_${serviceKey.slice(-12)}`;
  const name = await getTelegramDisplayName(supabase, telegramId);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password: stablePassword,
    email_confirm: true,
    user_metadata: { telegram_id: telegramId, name },
  });

  if (error && !/already|registered|exists/i.test(error.message || "")) {
    console.error("Failed to auto-create telegram-linked profile:", error);
    return null;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await findProfileByTelegramId(supabase, telegramId);
    if (profile?.id) return profile.id;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

export async function resolveProfileUserId(
  supabase: any,
  userId: string | number | null | undefined,
): Promise<string | null> {
  if (userId === null || userId === undefined) return null;

  const normalizedUserId = String(userId).trim();
  if (!normalizedUserId) return null;

  if (UUID_PATTERN.test(normalizedUserId)) {
    return normalizedUserId;
  }

  if (!TELEGRAM_ID_PATTERN.test(normalizedUserId)) {
    return null;
  }

  return ensureTelegramProfile(supabase, Number(normalizedUserId));
}