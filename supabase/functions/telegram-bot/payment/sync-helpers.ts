// ===== CROSS-PLATFORM SYNC HELPERS =====
// Keeps telegram_wallets and profiles.wallet_balance in sync

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Find website profile linked to a telegram user.
 * Telegram users have email: telegram_{telegramId}@bot.local
 */
export async function findLinkedProfile(supabase: any, telegramId: number): Promise<any | null> {
  const email = `telegram_${telegramId}@bot.local`;
  const { data } = await supabase
    .from("profiles")
    .select("id, wallet_balance, total_deposit, rank_balance, has_blue_check, total_orders")
    .eq("email", email)
    .maybeSingle();
  return data;
}

/**
 * Auto-create a website account for a telegram user if one doesn't exist.
 * Uses the same deterministic password pattern as telegram-login.
 */
async function ensureLinkedProfile(supabase: any, telegramId: number): Promise<any | null> {
  // First check if profile already exists
  let profile = await findLinkedProfile(supabase, telegramId);
  if (profile) return profile;

  try {
    const email = `telegram_${telegramId}@bot.local`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const stablePassword = `tg_${telegramId}_${serviceKey.slice(-12)}`;

    // Get telegram user info for name
    const { data: botUser } = await supabase
      .from("telegram_bot_users")
      .select("first_name, username")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    const name = botUser?.first_name || botUser?.username || `User_${telegramId}`;

    // Create auth user using admin API
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      serviceKey
    );

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password: stablePassword,
      email_confirm: true,
      user_metadata: { telegram_id: telegramId, name },
    });

    if (createError) {
      console.error("Auto-create user error:", createError);
      return null;
    }

    // Wait briefly for the trigger to create the profile
    await new Promise(r => setTimeout(r, 500));

    // Fetch the newly created profile
    profile = await findLinkedProfile(supabase, telegramId);
    return profile;
  } catch (e) {
    console.error("ensureLinkedProfile error:", e);
    return null;
  }
}

/**
 * Find telegram wallet linked to a website user profile.
 * Extracts telegram_id from the email pattern.
 */
export async function findLinkedTelegramWallet(supabase: any, userId: string): Promise<{ telegramId: number; wallet: any } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!profile?.email) return null;

  const match = profile.email.match(/^telegram_(\d+)@bot\.local$/);
  if (!match) return null;

  const telegramId = parseInt(match[1]);
  const { data: wallet } = await supabase
    .from("telegram_wallets")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  return { telegramId, wallet };
}

/**
 * After a bot deposit: also credit the website profile
 */
export async function syncDepositToProfile(supabase: any, telegramId: number, amount: number, method: string) {
  const profile = await findLinkedProfile(supabase, telegramId);
  if (!profile) return; // No linked website account

  const newBalance = (profile.wallet_balance || 0) + amount;
  const newTotalDeposit = (profile.total_deposit || 0) + amount;
  const newRankBalance = (profile.rank_balance || 0) + amount;

  const updateData: any = {
    wallet_balance: newBalance,
    total_deposit: newTotalDeposit,
    rank_balance: newRankBalance,
  };

  // Grant blue tick if total deposit >= 1000 or single deposit >= 1000
  if (amount >= 1000 || newTotalDeposit >= 1000) {
    updateData.has_blue_check = true;
  }

  await supabase.from("profiles").update(updateData).eq("id", profile.id);

  // Also create a website transaction record
  await supabase.from("transactions").insert({
    user_id: profile.id,
    type: "deposit",
    amount,
    status: "completed",
    description: `Deposited ₹${amount} via ${method} (Bot)`,
  });
}

/**
 * After a bot wallet purchase: also deduct from website profile and create order
 */
export async function syncPurchaseToProfile(
  supabase: any, telegramId: number, amount: number,
  productName: string, productId?: string, accessLink?: string
) {
  const profile = await findLinkedProfile(supabase, telegramId);
  if (!profile) return;

  const newBalance = (profile.wallet_balance || 0) - amount;

  await supabase.from("profiles").update({
    wallet_balance: Math.max(0, newBalance),
    total_orders: (profile.total_orders || 0) + 1,
  }).eq("id", profile.id);

  // Create website transaction
  await supabase.from("transactions").insert({
    user_id: profile.id,
    type: "purchase",
    amount: -amount,
    status: "completed",
    description: `Purchased ${productName} (Bot)`,
  });

  // Create website order
  await supabase.from("orders").insert({
    user_id: profile.id,
    product_id: productId || null,
    product_name: productName,
    unit_price: amount,
    total_price: amount,
    quantity: 1,
    status: accessLink ? "completed" : "confirmed",
    access_link: accessLink || null,
  });
}

/**
 * After a website deposit: also credit the telegram wallet
 */
export async function syncDepositToTelegramWallet(supabase: any, userId: string, amount: number, method: string) {
  const linked = await findLinkedTelegramWallet(supabase, userId);
  if (!linked || !linked.wallet) return;

  const newBalance = (linked.wallet.balance || 0) + amount;
  const newEarned = (linked.wallet.total_earned || 0) + amount;

  await supabase.from("telegram_wallets").update({
    balance: newBalance,
    total_earned: newEarned,
    updated_at: new Date().toISOString(),
  }).eq("telegram_id", linked.telegramId);

  await supabase.from("telegram_wallet_transactions").insert({
    telegram_id: linked.telegramId,
    type: "deposit",
    amount,
    description: `Deposit via ${method} (Website)`,
  });
}
