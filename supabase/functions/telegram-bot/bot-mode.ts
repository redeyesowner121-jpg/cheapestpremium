// ===== BOT MODE / TOKEN RESOLUTION =====
// Detects giveaway / child / main mode and resolves the bot token to use.

import { BOT_USERNAME, RESALE_BOT_USERNAME } from "./constants.ts";
import { initPremiumEmoji } from "./premium-emoji.ts";
import { setChildBotContext } from "./child-context.ts";
import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";

export type BotMode = {
  isGiveaway: boolean;
  isChildMode: boolean;
  childBotId: string | null;
  botToken: string | null;
};

export async function detectAndInitBotMode(req: Request, supabase: any): Promise<BotMode> {
  const url = new URL(req.url);
  const isGiveaway = url.searchParams.get("bot") === "giveaway" || req.headers.get("X-Bot-Mode") === "giveaway";
  const childBotId = url.searchParams.get("child");

  let botToken: string | null = null;
  let isChildMode = false;

  if (childBotId) {
    const { data: childBot } = await supabase.from("child_bots").select("*").eq("id", childBotId).single();
    if (!childBot || !childBot.is_active) {
      return { isGiveaway, isChildMode: false, childBotId, botToken: null };
    }
    botToken = childBot.bot_token;
    isChildMode = true;
    setChildBotContext({
      id: childBot.id,
      bot_token: childBot.bot_token,
      owner_telegram_id: childBot.owner_telegram_id,
      revenue_percent: childBot.revenue_percent,
      bot_username: childBot.bot_username,
    });
    await initPremiumEmoji(supabase, childBotId);
  } else {
    await initPremiumEmoji(supabase);
  }

  if (!botToken) {
    if (isGiveaway) {
      botToken = Deno.env.get("GIVEAWAY_BOT_TOKEN") || null;
    } else {
      const tokenResult = await resolveTelegramBotTokens({
        configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN") ?? null,
        configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN") ?? null,
        expectedMainUsername: BOT_USERNAME,
        expectedResaleUsername: RESALE_BOT_USERNAME,
      });
      botToken = tokenResult.mainBotToken;

      if (tokenResult.tokenUsernames.configuredMainTokenUsername &&
          tokenResult.tokenUsernames.configuredMainTokenUsername.toLowerCase() !== BOT_USERNAME.toLowerCase()) {
        console.warn(`TELEGRAM_BOT_TOKEN mapped to @${tokenResult.tokenUsernames.configuredMainTokenUsername}; using resolved for @${BOT_USERNAME}`);
      }
    }
  }

  return { isGiveaway, isChildMode, childBotId, botToken };
}
