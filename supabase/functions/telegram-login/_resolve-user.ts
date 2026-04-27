// Resolve which auth user corresponds to a telegram session.
import { mergeVerifiedTelegramEmailAccount } from "./_helpers.ts";

export async function resolveAuthUser(
  supabase: any,
  telegramId: number,
  loginCode: { username?: string | null; first_name?: string | null }
): Promise<{ user: any; resolvedEmail: string | null; isNewUser: boolean }> {
  const name = loginCode.first_name || loginCode.username || "User";
  let user: any = null;
  let resolvedEmail: string | null = null;
  let isNewUser = false;

  const { data: botUserForEmail } = await supabase
    .from("telegram_bot_users")
    .select("email, email_verified")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  const verifiedBotEmail = botUserForEmail?.email_verified ? botUserForEmail.email : null;

  // 1) Existing profile linked via telegram_id
  const { data: linkedProfile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (linkedProfile?.id) {
    const { data: linkedAuthUser } = await supabase.auth.admin.getUserById(linkedProfile.id);
    if (linkedAuthUser?.user) {
      user = linkedAuthUser.user;
      resolvedEmail = linkedAuthUser.user.email || linkedProfile.email || null;
    }
  }

  // 2) Bot user's verified email matches an auth user
  if ((!user || resolvedEmail?.endsWith("@bot.local")) && verifiedBotEmail) {
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: pageData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listError || !pageData?.users?.length) break;
      const match = pageData.users.find(
        (u: any) => (u.email || "").toLowerCase() === verifiedBotEmail.toLowerCase()
      );
      if (match) {
        user = match;
        resolvedEmail = match.email || verifiedBotEmail;
        break;
      }
      if (pageData.users.length < perPage) break;
      page++;
    }
  }

  if (user && resolvedEmail) {
    await mergeVerifiedTelegramEmailAccount(supabase, telegramId, resolvedEmail);
  }

  // 3) Fallback synthetic account
  const fallbackEmail = `telegram_${telegramId}@bot.local`;
  const stablePassword = `tg_${telegramId}_${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-12)}`;

  if (!user) {
    const { data: signInCheck, error: signInCheckError } = await supabase.auth.signInWithPassword({
      email: fallbackEmail,
      password: stablePassword,
    });

    if (!signInCheckError && signInCheck?.user) {
      user = signInCheck.user;
      resolvedEmail = fallbackEmail;
    } else {
      let page = 1;
      const perPage = 1000;
      while (!user) {
        const { data: pageData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
        if (listError || !pageData?.users?.length) break;
        const match = pageData.users.find((u: any) => u.email === fallbackEmail);
        if (match) {
          user = match;
          resolvedEmail = fallbackEmail;
          break;
        }
        if (pageData.users.length < perPage) break;
        page++;
      }
    }
  }

  if (!user) {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: fallbackEmail,
      password: stablePassword,
      email_confirm: true,
      user_metadata: { telegram_id: telegramId, username: loginCode.username, name },
    });
    if (createError) throw new Error("Failed to create user");
    user = newUser.user;
    resolvedEmail = fallbackEmail;
    isNewUser = true;
  }

  // Always reset password to deterministic value
  await supabase.auth.admin.updateUserById(user.id, { password: stablePassword });

  return { user, resolvedEmail: resolvedEmail || user.email || fallbackEmail, isNewUser };
}

export function getStablePassword(telegramId: number): string {
  return `tg_${telegramId}_${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-12)}`;
}
