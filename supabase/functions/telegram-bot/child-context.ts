// ===== CHILD BOT REQUEST CONTEXT =====
// Module-level state safe in Deno Deploy (single-threaded per isolate request)

export interface ChildBotContext {
  id: string;
  bot_token: string;
  owner_telegram_id: number;
  revenue_percent: number;
  bot_username: string | null;
}

let _ctx: ChildBotContext | null = null;

export function setChildBotContext(ctx: ChildBotContext | null) { _ctx = ctx; }
export function getChildBotContext(): ChildBotContext | null { return _ctx; }
export function isChildBotMode(): boolean { return _ctx !== null; }
export function clearChildBotContext() { _ctx = null; }

/**
 * Fetch a child bot's username (with @) given its ID. Returns "@username" or fallback "<id-prefix>".
 * Used in admin notifications so admins can see WHICH child bot the order came from.
 */
export async function getChildBotLabel(supabase: any, childBotId: string): Promise<string> {
  if (!childBotId) return "Unknown";
  // Prefer in-memory context if it matches
  if (_ctx && _ctx.id === childBotId && _ctx.bot_username) {
    return `@${_ctx.bot_username}`;
  }
  try {
    const { data } = await supabase.from("child_bots").select("bot_username").eq("id", childBotId).single();
    if (data?.bot_username) return `@${data.bot_username}`;
  } catch {}
  return `<code>${childBotId.slice(0, 8)}</code>`;
}

/**
 * Calculate child bot display price from reseller price + markup
 */
export function childBotPrice(resellerPrice: number | null, regularPrice: number): number {
  if (!_ctx) return regularPrice;
  const base = resellerPrice ?? regularPrice;
  return Math.ceil(base * (1 + _ctx.revenue_percent / 100));
}
