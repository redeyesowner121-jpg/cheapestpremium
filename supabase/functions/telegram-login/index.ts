import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { corsHeaders, jsonResponse } from "./_helpers.ts";
import { fetchTelegramAvatar, downloadAndUploadAvatar } from "./_avatar.ts";
import { resolveAuthUser, getStablePassword } from "./_resolve-user.ts";
import { syncProfileAndWallet } from "./_sync-profile.ts";

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

    // Mark used immediately
    await supabase.from("telegram_login_codes").update({ used: true }).eq("id", loginCode.id);

    const telegramId = loginCode.telegram_id;
    const name = loginCode.first_name || loginCode.username || "User";

    // Find or create the linked website account
    const { user, resolvedEmail, isNewUser } = await resolveAuthUser(supabase, telegramId, loginCode);

    // Avatar fetch (best-effort)
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    let avatarUrl: string | null = null;
    if (botToken) {
      const photoUrl = await fetchTelegramAvatar(botToken, telegramId);
      if (photoUrl) avatarUrl = await downloadAndUploadAvatar(supabase, photoUrl, user.id);
    }

    // Sync profile & wallet
    await syncProfileAndWallet(supabase, user, telegramId, loginCode, resolvedEmail, avatarUrl, isNewUser);

    // Sign in to get a real session
    const stablePassword = getStablePassword(telegramId);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
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
      email: resolvedEmail,
      name,
      avatar_url: avatarUrl,
      is_new_user: isNewUser,
    });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
