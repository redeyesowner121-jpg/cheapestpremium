// Netflix OTP Poller — checks Outlook inbox for Netflix OTP emails and forwards to assigned buyers
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "@supabase/supabase-js/cors";

const TOKEN = Deno.env.get("NETFLIX_BOT_TOKEN")!;
const TG_API = `https://api.telegram.org/bot${TOKEN}`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const OUTLOOK_API_KEY = Deno.env.get("MICROSOFT_OUTLOOK_API_KEY_1") || Deno.env.get("MICROSOFT_OUTLOOK_API_KEY")!;
const OUTLOOK_GATEWAY = "https://connector-gateway.lovable.dev/microsoft_outlook";

async function sendTg(chatId: number, text: string) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false }),
  });
}

// Extract OTP code from Netflix email body (4-6 digit code)
function extractOtp(body: string, subject: string): { code?: string; link?: string } {
  const text = `${subject}\n${body}`;
  // Common Netflix OTP patterns
  const codeMatch = text.match(/\b(\d{4,6})\b(?=[\s\S]{0,200}(?:code|verification|sign[- ]?in|otp))/i)
    || text.match(/(?:code|verification|otp)[\s:]*(\d{4,6})/i)
    || text.match(/\b(\d{4})\b/);
  const linkMatch = text.match(/https:\/\/(?:www\.)?netflix\.com\/[^\s"'<>]+/i);
  return {
    code: codeMatch?.[1],
    link: linkMatch?.[0],
  };
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary: any = { checked: 0, found: 0, forwarded: 0, errors: [] };

  try {
    // Get last poll time
    const { data: state } = await supabase
      .from("netflix_bot_state")
      .select("last_polled_at")
      .eq("id", 1)
      .single();

    const sinceIso = state?.last_polled_at || new Date(Date.now() - 3600_000).toISOString();
    const filter = `receivedDateTime ge ${sinceIso} and (contains(from/emailAddress/address,'netflix.com') or contains(subject,'Netflix'))`;
    const url = `${OUTLOOK_GATEWAY}/me/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body,toRecipients&$filter=${encodeURIComponent(filter)}`;

    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": OUTLOOK_API_KEY,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      await supabase.from("netflix_bot_state").update({
        last_error: `Outlook fetch ${res.status}: ${errText.slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      return new Response(JSON.stringify({ error: "outlook_fetch_failed", status: res.status, detail: errText.slice(0, 200) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const messages = data.value || [];
    summary.checked = messages.length;

    for (const m of messages) {
      try {
        // Skip if already processed
        const { data: existing } = await supabase
          .from("netflix_otp_logs")
          .select("id")
          .eq("raw_message_id", m.id)
          .maybeSingle();
        if (existing) continue;

        // The "to" address is the Netflix account email
        const toAddr = m.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();
        if (!toAddr) continue;

        // Find matching netflix_account
        const { data: account } = await supabase
          .from("netflix_accounts")
          .select("id, email")
          .ilike("email", toAddr)
          .maybeSingle();

        const bodyText = m.body?.contentType === "html" ? htmlToText(m.body.content || "") : (m.body?.content || "");
        const { code, link } = extractOtp(bodyText, m.subject || "");

        // Find buyers assigned to this account
        let buyerIds: number[] = [];
        if (account) {
          const { data: assigns } = await supabase
            .from("netflix_assignments")
            .select("buyer_telegram_id")
            .eq("netflix_account_id", account.id)
            .eq("is_active", true);
          buyerIds = (assigns || []).map((a: any) => Number(a.buyer_telegram_id));
        }

        // Forward to each buyer
        let forwardStatus = "no_buyers";
        if (buyerIds.length > 0) {
          let msgText = `🔐 <b>Netflix OTP</b>\n\n`;
          if (code) msgText += `Code: <code>${code}</code>\n\n`;
          msgText += `📧 ${toAddr}\n`;
          msgText += `📝 ${m.subject || "Netflix"}\n`;
          msgText += `🕐 ${new Date(m.receivedDateTime).toLocaleString()}\n`;
          if (link) msgText += `\n🔗 <a href="${link}">Open Netflix Link</a>`;

          let sent = 0;
          for (const buyerId of buyerIds) {
            try {
              await sendTg(buyerId, msgText);
              sent++;
            } catch (e) {
              summary.errors.push(`tg_send_${buyerId}: ${(e as Error).message}`);
            }
          }
          forwardStatus = sent > 0 ? "sent" : "failed";
          summary.forwarded += sent;
        }

        await supabase.from("netflix_otp_logs").insert({
          netflix_account_id: account?.id || null,
          netflix_email: toAddr,
          otp_code: code || null,
          otp_link: link || null,
          email_subject: m.subject || null,
          email_from: m.from?.emailAddress?.address || null,
          email_received_at: m.receivedDateTime,
          forwarded_to_telegram_ids: buyerIds,
          forward_status: forwardStatus,
          raw_message_id: m.id,
        });

        summary.found++;
      } catch (e) {
        summary.errors.push(`msg_${m.id}: ${(e as Error).message}`);
      }
    }

    // Update state
    await supabase.from("netflix_bot_state").update({
      last_polled_at: new Date().toISOString(),
      poll_count: (state as any)?.poll_count ? undefined : 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("netflix_bot_state").update({
      last_error: msg.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
