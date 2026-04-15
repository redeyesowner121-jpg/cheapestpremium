// ===== GIVEAWAY HELPERS =====

import { BOT_USERNAME, RESALE_BOT_USERNAME } from "../constants.ts";
import { resolveTelegramBotTokens } from "../../_shared/telegram-token-resolver.ts";

export const GIVEAWAY_REQUIRED_CHANNELS = [
  { id: "@rkrxott", name: "@rkrxott" },
  { id: "@rkrxmethods", name: "@rkrxmethods" },
];

export const MAIN_BOT_REF_LINK = "https://t.me/Air1_Premium_bot?start=ref_REFJFF7FC";

const MEMBER_STATUSES = new Set(["member", "administrator", "creator", "restricted"]);

function getUniqueTokens(tokens: Array<string | null | undefined>): string[] {
  return Array.from(new Set(tokens.map((token) => token?.trim()).filter((token): token is string => !!token)));
}

export async function getPoints(supabase: any, tgId: number) {
  const { data } = await supabase.from("giveaway_points").select("*").eq("telegram_id", tgId).single();
  if (data) return data;
  const { data: newData } = await supabase.from("giveaway_points").insert({ telegram_id: tgId }).select().single();
  return newData;
}

export async function getGiveawaySetting(supabase: any, key: string) {
  const { data } = await supabase.from("giveaway_settings").select("value").eq("key", key).single();
  return data?.value;
}

export async function checkGiveawayChannels(mainToken: string, userId: number): Promise<boolean> {
  const { getChatMember } = await import("../telegram-api.ts");

  const resolvedTokens = await resolveTelegramBotTokens({
    configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
    configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
    expectedMainUsername: BOT_USERNAME,
    expectedResaleUsername: RESALE_BOT_USERNAME,
  });

  const candidateTokens = getUniqueTokens([
    resolvedTokens.mainBotToken,
    mainToken,
    Deno.env.get("GIVEAWAY_BOT_TOKEN"),
    Deno.env.get("TELEGRAM_BOT_TOKEN"),
    resolvedTokens.resaleBotToken,
  ]);

  for (const token of candidateTokens) {
    const statuses = await Promise.all(
      GIVEAWAY_REQUIRED_CHANNELS.map((channel) => getChatMember(token, channel.id, userId))
    );

    if (statuses.every((status) => MEMBER_STATUSES.has(status))) {
      return true;
    }
  }

  return false;
}
