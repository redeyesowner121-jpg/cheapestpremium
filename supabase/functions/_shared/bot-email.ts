// Shared helper: send branded emails to Telegram bot users (uses SMTP config)
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getActiveSmtpConfig, sendViaSmtp } from "./smtp-sender.ts";

const BRAND_NAME = "Cheapest-Premium.in";
const BRAND_URL = "https://cheapest-premiums.in";
const BRAND_PRIMARY = "#6366f1";
const BRAND_DARK = "#0f172a";
const FOOTER_TEXT = `Thanks for choosing ${BRAND_NAME}`;

export function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

export async function getBotUserEmail(
  supabase: SupabaseClient,
  telegramId: number
): Promise<string | null> {
  const { data } = await supabase
    .from("telegram_bot_users")
    .select("email")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const email = (data?.email || "").trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

interface EmailBlock {
  label: string;
  value: string;       // raw text — will be escaped
  mono?: boolean;      // render as code block
  link?: string;       // render value as a clickable link/button
}

interface BuildOptions {
  title: string;       // top heading
  preheader?: string;  // hidden preview text
  intro?: string;      // intro paragraph (plain text)
  badge?: { text: string; color: string };
  blocks?: EmailBlock[];
  ctaButton?: { label: string; url: string };
  warning?: string;    // optional yellow note
}

export function buildBotEmailHtml(opts: BuildOptions): { html: string; text: string } {
  const blocksHtml = (opts.blocks || []).map((b) => {
    if (b.link) {
      return `
        <tr><td style="padding:6px 0;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:4px;">${escapeHtml(b.label)}</div>
          <a href="${escapeHtml(b.link)}" style="display:inline-block;padding:10px 16px;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;word-break:break-all;">${escapeHtml(b.value)}</a>
        </td></tr>`;
    }
    if (b.mono) {
      return `
        <tr><td style="padding:6px 0;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:4px;">${escapeHtml(b.label)}</div>
          <pre style="margin:0;padding:12px 14px;background:#0f172a;color:#e2e8f0;border-radius:8px;font-family:Menlo,Monaco,Consolas,monospace;font-size:13px;white-space:pre-wrap;word-break:break-all;line-height:1.5;">${escapeHtml(b.value)}</pre>
        </td></tr>`;
    }
    return `
      <tr><td style="padding:6px 0;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:4px;">${escapeHtml(b.label)}</div>
        <div style="font-size:15px;color:#0f172a;font-weight:500;">${escapeHtml(b.value)}</div>
      </td></tr>`;
  }).join("");

  const badgeHtml = opts.badge
    ? `<div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${opts.badge.color}20;color:${opts.badge.color};font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:12px;">${escapeHtml(opts.badge.text)}</div>`
    : "";

  const introHtml = opts.intro
    ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(opts.intro)}</p>`
    : "";

  const ctaHtml = opts.ctaButton
    ? `<div style="margin:24px 0 8px;text-align:center;">
         <a href="${escapeHtml(opts.ctaButton.url)}" style="display:inline-block;padding:13px 28px;background:${BRAND_PRIMARY};color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">${escapeHtml(opts.ctaButton.label)}</a>
       </div>`
    : "";

  const warningHtml = opts.warning
    ? `<div style="margin:18px 0 0;padding:12px 14px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;font-size:13px;color:#78350f;line-height:1.5;">⚠️ ${escapeHtml(opts.warning)}</div>`
    : "";

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#fff;opacity:0;">${escapeHtml(opts.preheader)}</div>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,.06);">
      <tr><td style="background:${BRAND_DARK};padding:22px 28px;">
        <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.3px;">${escapeHtml(BRAND_NAME)}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px;">Premium digital products at the cheapest prices</div>
      </td></tr>
      <tr><td style="padding:28px;">
        ${badgeHtml}
        <h1 style="margin:0 0 14px;font-size:22px;color:#0f172a;font-weight:700;line-height:1.3;">${escapeHtml(opts.title)}</h1>
        ${introHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:14px 18px;">
          ${blocksHtml}
        </table>
        ${ctaHtml}
        ${warningHtml}
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e2e8f0;text-align:center;">
        <div style="font-size:14px;color:#0f172a;font-weight:600;margin-bottom:4px;">${FOOTER_TEXT}</div>
        <div style="font-size:12px;color:#64748b;">
          <a href="${BRAND_URL}" style="color:${BRAND_PRIMARY};text-decoration:none;">${BRAND_URL.replace("https://", "")}</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  // Plain-text fallback
  const lines: string[] = [];
  lines.push(opts.title);
  lines.push("");
  if (opts.intro) { lines.push(opts.intro); lines.push(""); }
  for (const b of (opts.blocks || [])) {
    lines.push(`${b.label}: ${b.value}${b.link ? ` (${b.link})` : ""}`);
  }
  if (opts.ctaButton) { lines.push(""); lines.push(`${opts.ctaButton.label}: ${opts.ctaButton.url}`); }
  if (opts.warning) { lines.push(""); lines.push(`Warning: ${opts.warning}`); }
  lines.push(""); lines.push("---"); lines.push(FOOTER_TEXT); lines.push(BRAND_URL);
  const text = lines.join("\n");
  return { html, text };
}

export async function sendBotUserEmail(
  supabase: SupabaseClient,
  telegramId: number,
  subject: string,
  build: BuildOptions,
  meta?: { order_id?: string; template?: string }
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const email = await getBotUserEmail(supabase, telegramId);
    if (!email) return { ok: false, reason: "no_email_set" };

    const cfg = await getActiveSmtpConfig(supabase);
    if (!cfg) return { ok: false, reason: "smtp_not_configured" };

    const { html, text } = buildBotEmailHtml(build);
    const result = await sendViaSmtp(cfg, { to: email, subject, html, text });

    // Best-effort log
    try {
      await supabase.from("email_send_log").insert({
        recipient_email: email,
        subject,
        provider: "smtp",
        status: result.ok ? "sent" : "failed",
        error_message: result.ok ? null : (result.error || "send_failed"),
        template_name: meta?.template || "telegram_bot_user",
        order_id: meta?.order_id || null,
        metadata: { telegram_id: telegramId },
      } as any);
    } catch {}

    return { ok: !!result.ok, reason: result.ok ? undefined : (result.error || "send_failed") };
  } catch (e) {
    console.error("[bot-email] send error:", e);
    return { ok: false, reason: String(e?.message || e) };
  }
}
