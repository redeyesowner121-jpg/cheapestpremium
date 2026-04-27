export async function syncProfileAndWallet(
  supabase: any,
  user: any,
  telegramId: number,
  loginCode: any,
  email: string,
  avatarUrl: string | null,
  isNewUser: boolean
) {
  const name = loginCode.first_name || loginCode.username || "User";

  const { data: telegramWallet } = await supabase
    .from("telegram_wallets")
    .select("balance, total_earned")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  const blueTickExpiry = isNewUser
    ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, has_blue_check, avatar_url, wallet_balance, total_deposit, rank_balance")
    .eq("id", user.id)
    .maybeSingle();

  const botBalance = telegramWallet?.balance || 0;
  const botTotalDeposit = telegramWallet?.total_earned || 0;
  const webBalance = existingProfile?.wallet_balance || 0;
  const webTotalDeposit = existingProfile?.total_deposit || 0;

  const mergedBalance = Math.max(botBalance, webBalance);
  const mergedTotalDeposit = Math.max(botTotalDeposit, webTotalDeposit);

  const { count: resaleLinkCount } = await supabase
    .from("telegram_resale_links")
    .select("id", { count: "exact", head: true })
    .eq("reseller_telegram_id", telegramId)
    .eq("is_active", true);

  const isBotReseller = (resaleLinkCount || 0) > 0;

  const profileUpdate: any = {
    name,
    wallet_balance: mergedBalance,
    total_deposit: mergedTotalDeposit,
    telegram_id: telegramId,
  };

  if (isBotReseller) profileUpdate.is_reseller = true;
  if (avatarUrl) profileUpdate.avatar_url = avatarUrl;
  if (isNewUser) profileUpdate.has_blue_check = true;

  if (!existingProfile) {
    await supabase.from("profiles").insert({ id: user.id, email, ...profileUpdate });
  } else {
    await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
  }

  if (telegramWallet && mergedBalance !== botBalance) {
    await supabase.from("telegram_wallets").update({
      balance: mergedBalance,
      total_earned: mergedTotalDeposit,
      updated_at: new Date().toISOString(),
    }).eq("telegram_id", telegramId);
  }

  if (isNewUser && blueTickExpiry) {
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        telegram_id: telegramId,
        username: loginCode.username,
        name,
        blue_tick_expiry: blueTickExpiry,
      },
    });
  }
}
