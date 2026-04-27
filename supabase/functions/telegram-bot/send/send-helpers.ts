export const DAILY_SEND_LIMIT = 2;
export const MIN_SEND_AMOUNT = 10;

export function getTimeIST(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

export function maskName(name: string): string {
  if (!name || name.length <= 2) return name || "User";
  return name[0] + "•".repeat(Math.min(name.length - 2, 4)) + name[name.length - 1];
}

export async function getDailySendCount(supabase: any, telegramId: number): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(todayStart.getHours() + 5, todayStart.getMinutes() + 30);
  todayStart.setHours(0, 0, 0, 0);
  todayStart.setHours(todayStart.getHours() - 5, todayStart.getMinutes() - 30);

  const { count } = await supabase
    .from("telegram_wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("telegram_id", telegramId)
    .eq("type", "transfer_out")
    .gte("created_at", todayStart.toISOString());

  return count || 0;
}

export async function findRecipient(supabase: any, input: string) {
  let recipientId: number | null = null;
  let recipientName = "User";

  if (/^\d+$/.test(input)) {
    const { data: user } = await supabase
      .from("telegram_bot_users")
      .select("telegram_id, first_name, username")
      .eq("telegram_id", parseInt(input, 10))
      .maybeSingle();
    if (user) {
      recipientId = user.telegram_id;
      recipientName = user.first_name || user.username || "User";
    }
  }

  if (!recipientId) {
    const { data: user } = await supabase
      .from("telegram_bot_users")
      .select("telegram_id, first_name, username")
      .ilike("username", input)
      .maybeSingle();
    if (user) {
      recipientId = user.telegram_id;
      recipientName = user.first_name || user.username || "User";
    }
  }

  return { recipientId, recipientName };
}
