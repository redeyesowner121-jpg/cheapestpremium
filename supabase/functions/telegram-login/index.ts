import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LoginRequest {
  code: string;
}

interface TelegramLoginCode {
  id: string;
  code: string;
  telegram_id: bigint;
  username: string | null;
  first_name: string | null;
  used: boolean;
  expires_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    if (req.method === "POST") {
      const { code }: LoginRequest = await req.json();

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Code is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: loginCode, error: findError } = await supabase
        .from("telegram_login_codes")
        .select("*")
        .eq("code", code)
        .maybeSingle() as { data: TelegramLoginCode | null; error: any };

      if (findError) {
        console.error("Find error:", findError);
        return new Response(
          JSON.stringify({ error: "Database error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!loginCode) {
        return new Response(
          JSON.stringify({ error: "Invalid code" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (loginCode.used) {
        return new Response(
          JSON.stringify({ error: "Code already used" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (new Date(loginCode.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Code expired" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: telegramUser } = await supabase
        .from("telegram_bot_users")
        .select("*")
        .eq("telegram_id", loginCode.telegram_id)
        .maybeSingle();

      const { data: telegramWallet } = await supabase
        .from("telegram_wallets")
        .select("*")
        .eq("telegram_id", loginCode.telegram_id)
        .maybeSingle();

      const name = loginCode.first_name || loginCode.username || "User";

      const { data: authUser, error: authError } = await supabase.auth.admin
        .createUser({
          email: `telegram_${loginCode.telegram_id}@bot.local`,
          password: Math.random().toString(36).slice(-20),
          email_confirm: true,
          user_metadata: {
            telegram_id: loginCode.telegram_id,
            username: loginCode.username,
          },
        });

      if (authError || !authUser?.user) {
        const { data: existingUser } = await supabase.auth.admin
          .listUsers();

        const user = existingUser?.users?.find(
          (u: any) =>
            u.user_metadata?.telegram_id === loginCode.telegram_id
        );

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (!profile) {
            await supabase.from("profiles").insert({
              id: user.id,
              email: user.email,
              name: name,
              wallet_balance: telegramWallet?.balance || 0,
              total_deposit: telegramWallet?.total_earned || 0,
            });
          } else {
            await supabase.from("profiles").update({
              name: name,
              wallet_balance: telegramWallet?.balance || 0,
              total_deposit: telegramWallet?.total_earned || 0,
            }).eq("id", user.id);
          }

          await supabase
            .from("telegram_login_codes")
            .update({ used: true })
            .eq("id", loginCode.id);

          const { data: session } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: user.email!,
            options: {
              redirectTo: `${new URL(req.url).origin}/?session=true`,
            },
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: "Login successful",
              user_id: user.id,
              email: user.email,
              name: name,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const userId = authUser?.user?.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!profile) {
        await supabase.from("profiles").insert({
          id: userId,
          email: authUser?.user?.email,
          name: name,
          wallet_balance: telegramWallet?.balance || 0,
          total_deposit: telegramWallet?.total_earned || 0,
        });
      } else {
        await supabase.from("profiles").update({
          name: name,
          wallet_balance: telegramWallet?.balance || 0,
          total_deposit: telegramWallet?.total_earned || 0,
        }).eq("id", userId);
      }

      await supabase
        .from("telegram_login_codes")
        .update({ used: true })
        .eq("id", loginCode.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Login successful",
          user_id: userId,
          email: authUser?.user?.email,
          name: name,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
