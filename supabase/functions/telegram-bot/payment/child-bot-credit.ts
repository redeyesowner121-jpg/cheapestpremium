// ===== CHILD BOT OWNER COMMISSION CREDIT =====
// Credits the child bot owner's telegram wallet with their commission share
// and notifies them via Telegram.

import { sendMessage } from "../telegram-api.ts";

export async function creditChildBotOwnerCommission(
  supabase: any,
  childBotId: string,
  orderId: string,
  productName: string,
  totalPrice: number,
  buyerId: number,
) {
  try {
    // Fetch child bot details (owner + revenue %)
    const { data: bot } = await supabase
      .from("child_bots")
      .select("owner_telegram_id, revenue_percent, bot_username")
      .eq("id", childBotId)
      .single();

    if (!bot?.owner_telegram_id) {
      console.error(`[child-bot-credit] No owner found for bot ${childBotId}`);
      return;
    }

    const revenuePercent = bot.revenue_percent || 0;
    const commission = Math.round(totalPrice * revenuePercent) / 100;

    if (commission <= 0) return;

    // Get or create owner's telegram wallet
    let { data: ownerWallet } = await supabase
      .from("telegram_wallets")
      .select("balance, total_earned")
      .eq("telegram_id", bot.owner_telegram_id)
      .maybeSingle();

    if (!ownerWallet) {
      const { data: newWallet } = await supabase
        .from("telegram_wallets")
        .insert({
          telegram_id: bot.owner_telegram_id,
          balance: 0,
          total_earned: 0,
        })
        .select("balance, total_earned")
        .single();
      ownerWallet = newWallet;
    }

    if (!ownerWallet) {
      console.error(`[child-bot-credit] Could not get/create wallet for ${bot.owner_telegram_id}`);
      return;
    }

    // Credit commission to owner's wallet
    await supabase
      .from("telegram_wallets")
      .update({
        balance: (ownerWallet.balance || 0) + commission,
        total_earned: (ownerWallet.total_earned || 0) + commission,
        updated_at: new Date().toISOString(),
      })
      .eq("telegram_id", bot.owner_telegram_id);

    // Log transaction
    await supabase.from("telegram_wallet_transactions").insert({
      telegram_id: bot.owner_telegram_id,
      type: "child_bot_commission",
      amount: commission,
      description: `Commission from @${bot.bot_username || "your bot"}: ${productName}`,
    });

    // Record earnings entry
    await supabase.from("child_bot_earnings").insert({
      child_bot_id: childBotId,
      order_id: orderId,
      amount: commission,
      status: "credited",
    });

    // Notify owner
    try {
      const mainToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (mainToken) {
        await sendMessage(
          mainToken,
          bot.owner_telegram_id,
          `💰 <b>New Commission Earned!</b>\n\n` +
          `🤖 Bot: @${bot.bot_username || "your bot"}\n` +
          `📦 Product: ${productName}\n` +
          `💵 Sale: ₹${totalPrice}\n` +
          `🎁 Your Commission (${revenuePercent}%): <b>₹${commission}</b>\n\n` +
          `✅ Added to your wallet balance!`
        );
      }
    } catch (e) {
      console.error("[child-bot-credit] Notify owner error:", e);
    }
  } catch (e) {
    console.error("[child-bot-credit] Error:", e);
  }
}
