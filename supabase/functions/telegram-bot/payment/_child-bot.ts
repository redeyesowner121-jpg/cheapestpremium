// Child-bot specific commission/notification logic for confirmed orders
import { sendToUser } from "./_admin-helpers.ts";

export async function processChildBotConfirmation(
  supabase: any, order: any, orderId: string, resolvedDelivery: any
) {
  try {
    const childBotId = order.username.replace("child_bot:", "");
    const { data: childBot } = await supabase.from("child_bots").select("*").eq("id", childBotId).single();
    if (!childBot) return;

    await supabase.from("child_bot_orders").update({ status: "confirmed" }).eq("telegram_order_id", orderId);
    const commission = Math.round(order.amount * childBot.revenue_percent) / 100;

    const { data: ownerWallet } = await supabase.from("telegram_wallets")
      .select("balance, total_earned").eq("telegram_id", childBot.owner_telegram_id).single();
    if (ownerWallet) {
      await supabase.from("telegram_wallets").update({
        balance: ownerWallet.balance + commission,
        total_earned: ownerWallet.total_earned + commission,
        updated_at: new Date().toISOString(),
      }).eq("telegram_id", childBot.owner_telegram_id);

      await supabase.from("telegram_wallet_transactions").insert({
        telegram_id: childBot.owner_telegram_id, type: "child_bot_commission",
        amount: commission, description: `Commission: ${order.product_name} (${childBot.revenue_percent}%)`,
      });
    }

    await supabase.from("child_bots").update({
      total_earnings: childBot.total_earnings + commission,
      total_orders: childBot.total_orders + 1,
    }).eq("id", childBotId);

    const { data: childOrder } = await supabase.from("child_bot_orders")
      .select("id").eq("telegram_order_id", orderId).single();
    if (childOrder) {
      await supabase.from("child_bot_earnings").insert({
        child_bot_id: childBotId, order_id: childOrder.id, amount: commission, status: "paid",
      });
    }

    try {
      await sendToUser([childBot.bot_token], order.telegram_user_id,
        `✅ <b>Order Confirmed!</b>\n\nProduct: <b>${order.product_name}</b>\nYour order has been confirmed and delivered! ⚡`
      );

      if (resolvedDelivery?.link) {
        const deliveryLink = resolvedDelivery.link;
        const isCredentials = deliveryLink.includes("|");
        const isDriveLink = deliveryLink.includes("drive.google.com");

        if (isCredentials) {
          const parts = deliveryLink.split("|").map((p: string) => p.trim());
          let credText = `🔑 <b>Your Credentials</b>\n\n`;
          if (parts.length >= 2) {
            credText += `📧 ID: <code>${parts[0]}</code>\n🔒 Password: <code>${parts[1]}</code>`;
          } else {
            credText += `<code>${deliveryLink}</code>`;
          }
          await sendToUser([childBot.bot_token], order.telegram_user_id, credText);
        } else if (!isDriveLink) {
          await sendToUser([childBot.bot_token], order.telegram_user_id,
            `🔗 <b>Your Access Link</b>\n\n${deliveryLink}`);
        }
      }
    } catch (e) { console.error("Child bot notification error:", e); }

    try {
      const motherToken = Deno.env.get("MOTHER_BOT_TOKEN");
      if (motherToken) {
        await sendToUser([motherToken], childBot.owner_telegram_id,
          `💰 <b>Commission Earned!</b>\n\n🤖 Bot: @${childBot.bot_username}\n📦 Product: ${order.product_name}\n💵 Commission: ₹${commission} (${childBot.revenue_percent}%)`
        );
      }
    } catch {}
  } catch (e) {
    console.error("Child bot commission error:", e);
  }
}
