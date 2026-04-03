import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { code } = await req.json();
    if (!code) return jsonResponse({ error: "Code is required" }, 400);

    // Find the login code
    const { data: loginCode, error: findError } = await supabase
      .from("telegram_login_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (findError) {
      console.error("Find error:", findError);
      return jsonResponse({ error: "Database error" }, 500);
    }
    if (!loginCode) return jsonResponse({ error: "Invalid code" }, 401);
    if (loginCode.used) return jsonResponse({ error: "Code already used" }, 401);
    if (new Date(loginCode.expires_at) < new Date()) return jsonResponse({ error: "Code expired" }, 401);

    // Mark code as used immediately
    await supabase
      .from("telegram_login_codes")
      .update({ used: true })
      .eq("id", loginCode.id);

    const telegramId = loginCode.telegram_id;
    const email = `telegram_${telegramId}@bot.local`;
    const name = loginCode.first_name || loginCode.username || "User";

    // Deterministic password for telegram users (only usable via this edge function)
    const stablePassword = `tg_${telegramId}_${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-12)}`;

    // Try to find existing user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let user = existingUsers?.users?.find(
      (u: any) => u.email === email
    );

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: stablePassword,
        email_confirm: true,
        user_metadata: { telegram_id: telegramId, username: loginCode.username, name },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return jsonResponse({ error: "Failed to create user" }, 500);
      }
      user = newUser.user;
    } else {
      // Update password to ensure it matches
      await supabase.auth.admin.updateUserById(user.id, { password: stablePassword });
    }

    // Sync wallet data from telegram
    const { data: telegramWallet } = await supabase
      .from("telegram_wallets")
      .select("balance, total_earned")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    // Upsert profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: user.id,
        email,
        name,
        wallet_balance: telegramWallet?.balance || 0,
        total_deposit: telegramWallet?.total_earned || 0,
      });
    } else {
      await supabase.from("profiles").update({
        name,
        wallet_balance: telegramWallet?.balance || 0,
        total_deposit: telegramWallet?.total_earned || 0,
      }).eq("id", user.id);
    }

    // Sign in to get a real session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: stablePassword,
    });

    if (signInError || !signInData.session) {
      console.error("Sign in error:", signInError);
      return jsonResponse({ error: "Failed to create session" }, 500);
    }

    return jsonResponse({
      success: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
      user_id: user.id,
      email,
      name,
    });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
