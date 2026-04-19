// Netflix OTP Forwarding Bot
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "@supabase/supabase-js/cors";

const TOKEN = Deno.env.get("NETFLIX_BOT_TOKEN")!;
const TG_API = `https://api.telegram.org/bot${TOKEN}`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function tg(method: string, body: any) {
  const r = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function sendMessage(chatId: number, text: string, extra: any = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function handleStart(supabase: any, chatId: number, user: any) {
  await supabase.from("netflix_bot_users").upsert({
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_active: new Date().toISOString(),
  }, { onConflict: "telegram_id" });

  const text = `🎬 <b>Welcome to Netflix OTP Bot!</b>\n\n` +
    `যখনই তোমার Netflix অ্যাকাউন্টে OTP আসবে, এই বটে অটোমেটিক চলে আসবে।\n\n` +
    `<b>Commands:</b>\n` +
    `/myaccount — Your assigned Netflix account\n` +
    `/lastotp — Last 5 OTPs received\n` +
    `/help — Help & support`;

  await sendMessage(chatId, text);
}

async function handleMyAccount(supabase: any, chatId: number, telegramId: number) {
  const { data: assignments } = await supabase
    .from("netflix_assignments")
    .select("*, netflix_accounts(email, label, status)")
    .eq("buyer_telegram_id", telegramId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!assignments || assignments.length === 0) {
    await sendMessage(chatId, "❌ তোমার কোনো active Netflix account নেই।\n\nNetflix কিনতে চাইলে @Air1_Premium_bot-এ যাও।");
    return;
  }

  let text = `🎬 <b>Your Netflix Account(s)</b>\n\n`;
  for (const a of assignments) {
    const acc = a.netflix_accounts;
    text += `📧 <code>${acc?.email || "N/A"}</code>\n`;
    if (acc?.label) text += `🏷️ ${acc.label}\n`;
    if (a.expires_at) text += `⏰ Expires: ${new Date(a.expires_at).toLocaleDateString()}\n`;
    text += `\n`;
  }
  text += `<i>OTP এলে এখানে অটোমেটিক চলে আসবে।</i>`;
  await sendMessage(chatId, text);
}

async function handleLastOtp(supabase: any, chatId: number, telegramId: number) {
  const { data: assignments } = await supabase
    .from("netflix_assignments")
    .select("netflix_account_id")
    .eq("buyer_telegram_id", telegramId)
    .eq("is_active", true);

  if (!assignments || assignments.length === 0) {
    await sendMessage(chatId, "❌ কোনো account assigned নেই।");
    return;
  }

  const accountIds = assignments.map((a: any) => a.netflix_account_id);
  const { data: otps } = await supabase
    .from("netflix_otp_logs")
    .select("*")
    .in("netflix_account_id", accountIds)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!otps || otps.length === 0) {
    await sendMessage(chatId, "📭 এখনো কোনো OTP আসেনি।");
    return;
  }

  let text = `🔐 <b>Last ${otps.length} OTP(s)</b>\n\n`;
  for (const o of otps) {
    text += `<b>${o.otp_code || "Link only"}</b>\n`;
    text += `📧 ${o.netflix_email}\n`;
    text += `📝 ${o.email_subject || "Netflix"}\n`;
    text += `🕐 ${new Date(o.created_at).toLocaleString()}\n`;
    if (o.otp_link) text += `🔗 <a href="${o.otp_link}">Open Link</a>\n`;
    text += `\n`;
  }
  await sendMessage(chatId, text, { disable_web_page_preview: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const update = await req.json();
    const msg = update.message;
    if (!msg || !msg.text) return new Response("ok");

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const user = msg.from;

    if (text.startsWith("/start")) await handleStart(supabase, chatId, user);
    else if (text === "/myaccount") await handleMyAccount(supabase, chatId, user.id);
    else if (text === "/lastotp") await handleLastOtp(supabase, chatId, user.id);
    else if (text === "/help") {
      await sendMessage(chatId, `<b>📖 Help</b>\n\nএই বট তোমার কেনা Netflix account-এ আসা OTP অটোমেটিক forward করে।\n\nProblem? @Air1xott-এ message করো।`);
    } else {
      await sendMessage(chatId, "Unknown command. Try /myaccount or /lastotp");
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (e) {
    console.error("netflix-bot error:", e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
