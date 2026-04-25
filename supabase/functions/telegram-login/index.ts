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

async function mergeVerifiedTelegramEmailAccount(supabase: any, telegramId: number, email: string | null) {
  if (!email || email.endsWith("@bot.local")) return;
  const { error } = await supabase.rpc("merge_telegram_email_account", {
    _telegram_id: telegramId,
    _email: email,
  });
  if (error) console.error("merge_telegram_email_account failed:", error);
}

async function fetchTelegramAvatar(botToken: string, telegramId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: telegramId, limit: 1 }),
    });
    const data = await res.json();
    if (!data?.result?.photos?.length) return null;

    const photos = data.result.photos[0];
    const fileId = photos[photos.length - 1].file_id;

    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileRes.json();
    if (!fileData?.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
  } catch (e) {
    console.error("fetchTelegramAvatar error:", e);
    return null;
  }
}

async function downloadAndUploadAvatar(
  supabase: any,
  photoUrl: string,
  userId: string
): Promise<string | null> {
  try {
    const response = await fetch(photoUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const filePath = `avatars/${userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, uint8Array, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("downloadAndUploadAvatar error:", e);
    return null;
  }
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
    const name = loginCode.first_name || loginCode.username || "User";

    // ===== Find or create the linked website account =====
    // Priority:
    //   1. Existing profile already linked via telegram_id
    //   2. Bot user's verified email matches a website account
    //   3. Fallback: synthetic telegram_<id>@bot.local account
    let user: any = null;
    let isNewUser = false;
    let resolvedEmail: string | null = null;

    // 1) Try profile already linked to this telegram_id
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

    // 2) Look up bot user's verified email
    if (!user) {
      const { data: botUser } = await supabase
        .from("telegram_bot_users")
        .select("email, email_verified")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      const verifiedEmail = botUser?.email_verified ? botUser.email : null;
      if (verifiedEmail) {
        // Find auth user with this email
        let page = 1;
        const perPage = 1000;
        while (!user) {
          const { data: pageData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
          if (listError || !pageData?.users?.length) break;
          const match = pageData.users.find(
            (u: any) => (u.email || "").toLowerCase() === verifiedEmail.toLowerCase()
          );
          if (match) {
            user = match;
            resolvedEmail = match.email || verifiedEmail;
            break;
          }
          if (pageData.users.length < perPage) break;
          page++;
        }
      }
    }

    // Ensure verified email links are fully merged before resolving profile data.
    if (user && resolvedEmail) {
      await mergeVerifiedTelegramEmailAccount(supabase, telegramId, resolvedEmail);
    }

    // 3) Fallback synthetic account (existing behaviour)
    const fallbackEmail = `telegram_${telegramId}@bot.local`;
    const stablePassword = `tg_${telegramId}_${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-12)}`;

    if (!user) {
      // Try sign-in with synthetic credentials
      const { data: signInCheck, error: signInCheckError } = await supabase.auth.signInWithPassword({
        email: fallbackEmail,
        password: stablePassword,
      });

      if (!signInCheckError && signInCheck?.user) {
        user = signInCheck.user;
        resolvedEmail = fallbackEmail;
      } else {
        // List users to find synthetic email account
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
      // Truly new — create synthetic account
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: fallbackEmail,
        password: stablePassword,
        email_confirm: true,
        user_metadata: { telegram_id: telegramId, username: loginCode.username, name },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return jsonResponse({ error: "Failed to create user" }, 500);
      }
      user = newUser.user;
      resolvedEmail = fallbackEmail;
      isNewUser = true;
    }

    // Always reset password to deterministic value so we can sign in
    await supabase.auth.admin.updateUserById(user.id, { password: stablePassword });

    const email = resolvedEmail || user.email || fallbackEmail;

    // Sync wallet data: merge bot + website balances
    const { data: telegramWallet } = await supabase
      .from("telegram_wallets")
      .select("balance, total_earned")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    // Fetch Telegram profile photo and upload
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    let avatarUrl: string | null = null;
    if (botToken) {
      const photoUrl = await fetchTelegramAvatar(botToken, telegramId);
      if (photoUrl) {
        avatarUrl = await downloadAndUploadAvatar(supabase, photoUrl, user.id);
      }
    }

    // Calculate blue tick expiry (3 days from now for new users)
    const blueTick = isNewUser;
    const blueTickExpiry = isNewUser
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Get existing profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, has_blue_check, avatar_url, wallet_balance, total_deposit, rank_balance")
      .eq("id", user.id)
      .maybeSingle();

    // Merge wallets: take the HIGHER value to avoid losing money from either side
    const botBalance = telegramWallet?.balance || 0;
    const botTotalDeposit = telegramWallet?.total_earned || 0;
    const webBalance = existingProfile?.wallet_balance || 0;
    const webTotalDeposit = existingProfile?.total_deposit || 0;

    // Use the maximum of both - prevents overwriting a higher website balance with lower bot balance
    const mergedBalance = Math.max(botBalance, webBalance);
    const mergedTotalDeposit = Math.max(botTotalDeposit, webTotalDeposit);

    // Check if user is a reseller in the bot (has active resale links)
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
      telegram_id: telegramId, // permanent bot↔website link
    };

    // Sync reseller status from bot to website
    if (isBotReseller) {
      profileUpdate.is_reseller = true;
    }

    // Always update avatar if we got one from Telegram
    if (avatarUrl) {
      profileUpdate.avatar_url = avatarUrl;
    }

    // Grant 3-day blue tick for new users
    if (isNewUser) {
      profileUpdate.has_blue_check = true;
    }

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: user.id,
        email,
        ...profileUpdate,
      });
    } else {
      await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
    }

    // Also sync website balance back to telegram wallet (ensure both match)
    if (telegramWallet && mergedBalance !== botBalance) {
      await supabase.from("telegram_wallets").update({
        balance: mergedBalance,
        total_earned: mergedTotalDeposit,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", telegramId);
    }

    // Schedule blue tick removal after 3 days (store expiry in user metadata)
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
      avatar_url: avatarUrl,
      is_new_user: isNewUser,
    });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
