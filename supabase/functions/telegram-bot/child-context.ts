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
 * Calculate child bot display price from reseller price + markup
 */
export function childBotPrice(resellerPrice: number | null, regularPrice: number): number {
  if (!_ctx) return regularPrice;
  const base = resellerPrice ?? regularPrice;
  return Math.ceil(base * (1 + _ctx.revenue_percent / 100));
}
