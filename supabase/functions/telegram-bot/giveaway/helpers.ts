// ===== GIVEAWAY HELPERS =====

import { sendMessage } from "../telegram-api.ts";
import { ensureWallet } from "../db-helpers.ts";

export const GIVEAWAY_REQUIRED_CHANNELS = [
  { id: "@rkrxott", name: "@rkrxott" },
  { id: "@rkrxmethods", name: "@rkrxmethods" },
];

export const MAIN_BOT_REF_LINK = "https://t.me/Air1_Premium_bot?start=ref_REFJFF7FC";

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
  const results = await Promise.all(
    GIVEAWAY_REQUIRED_CHANNELS.map(async (ch) => {
      const status = await getChatMember(mainToken, ch.id, userId);
      return status;
    })
  );
  return results.every(status => ["member", "administrator", "creator"].includes(status));
}
