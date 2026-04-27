// ===== ESCROW SHARED CONSTANTS, TYPES & HELPERS =====

import { resolveProfileUserId } from "../_shared/profile-id-resolver.ts";

export const STATUS_EMOJI: Record<string, string> = {
  pending_acceptance: "⏳",
  funded: "🔒",
  delivered: "📦",
  completed: "✅",
  disputed: "⚠️",
  refunded: "↩️",
  cancelled: "❌",
};

export const STATUS_LABEL: Record<string, string> = {
  pending_acceptance: "Awaiting Seller",
  funded: "Funded",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export type EscrowCounterparty = {
  profile_id: string;
  name: string | null;
  email: string | null;
  identifier_kind: "email" | "username" | "telegram_id";
};

const BOT_USER_TABLES = ["telegram_bot_users", "mother_bot_users", "child_bot_users", "netflix_bot_users"];

async function profileSummary(supabase: any, profileId: string, kind: EscrowCounterparty["identifier_kind"]): Promise<EscrowCounterparty | null> {
  const { data } = await supabase.from("profiles").select("id,name,email").eq("id", profileId).maybeSingle();
  return data?.id ? { profile_id: data.id, name: data.name ?? null, email: data.email ?? null, identifier_kind: kind } : null;
}

async function findTelegramIdByUsername(supabase: any, username: string): Promise<number | null> {
  const normalized = username.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(normalized)) return null;

  for (const table of BOT_USER_TABLES) {
    try {
      const { data } = await supabase
        .from(table)
        .select("telegram_id,username,last_active")
        .ilike("username", normalized)
        .order("last_active", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (data?.telegram_id) return Number(data.telegram_id);
    } catch (e) {
      console.warn(`Escrow username lookup skipped ${table}:`, e);
    }
  }
  return null;
}

export async function resolveEscrowCounterparty(supabase: any, identifier: string): Promise<EscrowCounterparty | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  if (/^\d{4,15}$/.test(raw)) {
    const profileId = await resolveProfileUserId(supabase, Number(raw));
    return profileId ? profileSummary(supabase, profileId, "telegram_id") : null;
  }

  const username = raw.replace(/^@+/, "");
  if (/^[a-z0-9_]{3,32}$/i.test(username)) {
    const telegramId = await findTelegramIdByUsername(supabase, username);
    if (telegramId) {
      const profileId = await resolveProfileUserId(supabase, telegramId);
      if (profileId) return profileSummary(supabase, profileId, "username");
    }
  }

  const { data: rows, error } = await supabase.rpc("find_profile_by_identifier", { _identifier: raw });
  if (error) {
    console.error("find_profile_by_identifier failed:", error);
    return null;
  }
  const row = Array.isArray(rows) ? rows[0] : null;
  return row?.profile_id ? row : null;
}

export async function resolveTgIdForProfile(supabase: any, profileId: string): Promise<number | null> {
  try {
    const { data: p } = await supabase.from("profiles").select("email,telegram_id").eq("id", profileId).single();
    if (p?.telegram_id) return Number(p.telegram_id);
    const m = p?.email?.match(/^telegram_(\d+)@bot\.local$/);
    if (m) return parseInt(m[1]);
    if (p?.email) {
      const { data: bu } = await supabase
        .from("telegram_bot_users").select("telegram_id").eq("email", p.email).maybeSingle();
      if (bu?.telegram_id) return Number(bu.telegram_id);
    }
  } catch (e) { console.error("resolveTgIdForProfile:", e); }
  return null;
}

export async function notifyOther(token: string, supabase: any, dealId: string, senderProfileId: string, msg: string, viewDealId: string) {
  const { sendMessage } = await import("./telegram-api.ts");
  try {
    const { data: d } = await supabase.from("escrow_deals").select("buyer_id,seller_id,status").eq("id", dealId).single();
    if (!d) return;
    const otherProfileId = d.buyer_id === senderProfileId ? d.seller_id : d.buyer_id;
    const tgId = await resolveTgIdForProfile(supabase, otherProfileId);
    if (!tgId) { console.log("notifyOther: no TG id for profile", otherProfileId); return; }

    const isOtherBuyer = otherProfileId === d.buyer_id;
    const rows: any[] = [];
    if (d.status === 'delivered' && isOtherBuyer) {
      rows.push([
        { text: "💰 Release Funds", callback_data: `escrow_release_${viewDealId}` },
        { text: "⚠️ Dispute", callback_data: `escrow_dispute_${viewDealId}` },
      ]);
    } else if (d.status === 'funded' && !isOtherBuyer) {
      rows.push([{ text: "📦 Mark Delivered", callback_data: `escrow_deliver_${viewDealId}` }]);
    } else if (d.status === 'pending_acceptance' && !isOtherBuyer) {
      rows.push([
        { text: "✅ Accept", callback_data: `escrow_accept_${viewDealId}` },
        { text: "❌ Decline", callback_data: `escrow_decline_${viewDealId}` },
      ]);
    }
    rows.push([{ text: "👀 View Deal", callback_data: `escrow_view_${viewDealId}` }]);

    await sendMessage(token, tgId, msg, { reply_markup: { inline_keyboard: rows } });
  } catch (e) { console.error("notifyOther:", e); }
}
