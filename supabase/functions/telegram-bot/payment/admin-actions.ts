// ===== ADMIN ORDER ACTIONS =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getWallet, getUserLang, getAllAdminIds } from "../db-helpers.ts";
import { processReferralBonus } from "./wallet-pay.ts";
import { logProof, formatOrderConfirmed, formatOrderDelivered, formatDepositSuccess } from "../proof-logger.ts";

// Try sending message via multiple bot tokens (for resale buyers who only talked to resale bot)
async function sendToUser(tokens: string[], chatId: number, text: string) {
  for (const token of tokens) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
      const result = await res.json();
      if (result.ok) return true;
      console.log(`sendToUser token attempt failed for chat ${chatId}:`, result.description);
    } catch (e) {
      console.error(`sendToUser error:`, e);
    }
  }
  return false;
}

export async function handleAdminAction(token: string, supabase: any, orderId: string, newStatus: string, adminChatId: number) {
  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";

  await supabase.from("telegram_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);

  // Build list of tokens to try
  // For resale orders, use resale bot token FIRST so user gets messages in the same bot
  // For child bot orders, use child bot token FIRST
  const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
  const isResaleOrder = !!order.reseller_telegram_id;
  const isChildBotOrder = order.username?.startsWith("child_bot:");
  let tokensToTry: string[];
  let userToken: string;

  if (isChildBotOrder) {
    // For child bot orders, resolve the child bot token
    const childBotId = order.username.replace("child_bot:", "");
    const { data: childBot } = await supabase.from("child_bots").select("bot_token").eq("id", childBotId).single();
    if (childBot?.bot_token) {
      tokensToTry = [childBot.bot_token, token];
      userToken = childBot.bot_token;
    } else {
      tokensToTry = [token];
      userToken = token;
    }
  } else if (isResaleOrder && resaleToken && resaleToken !== token) {
    tokensToTry = [resaleToken, token]; // Resale bot first
    userToken = resaleToken;
  } else {
    tokensToTry = [token];
    if (resaleToken && resaleToken !== token) tokensToTry.push(resaleToken);
    userToken = token;
  }

  const msgKey: Record<string, string> = { confirmed: "order_confirmed", rejected: "order_rejected", shipped: "order_shipped" };
  await sendToUser(tokensToTry, order.telegram_user_id, t(msgKey[newStatus] || "order_confirmed", userLang));

  // If rejected, refund any wallet deduction
  if (newStatus === "rejected") {
    const { data: deductions } = await supabase.from("telegram_wallet_transactions")
      .select("*")
      .eq("telegram_id", order.telegram_user_id)
      .eq("type", "purchase_deduction")
      .ilike("description", `%${order.product_name}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (deductions?.length && deductions[0].amount < 0) {
      const refundAmount = Math.abs(deductions[0].amount);
      const wallet = await getWallet(supabase, order.telegram_user_id);
      if (wallet) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance + refundAmount,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.telegram_user_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.telegram_user_id,
          type: "refund",
          amount: refundAmount,
          description: `Refund: ${order.product_name} (rejected)`,
        });

        await sendToUser(tokensToTry, order.telegram_user_id,
          userLang === "bn"
            ? `💰 ₹${refundAmount} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`
            : `💰 ₹${refundAmount} refunded to your wallet.`
        );
      }
    }
  }

  // If confirmed, process referral, reseller profit, and auto-send access_link
  if (newStatus === "confirmed") {
    let resolvedDelivery: { link: string | null; showInBot: boolean; showInWebsite: boolean; deliveryMessage?: string | null } | null = null;

    if (!order.product_name?.startsWith("Wallet Deposit") && order.product_id) {
      const { resolveAccessLink } = await import("./instant-delivery.ts");
      resolvedDelivery = await resolveAccessLink(supabase, order.product_id, undefined, order.id);
    }

    // If this is a wallet deposit order, credit the wallet
    if (order.product_name?.startsWith("Wallet Deposit")) {
      const depositAmount = order.amount;
      const wallet = await getWallet(supabase, order.telegram_user_id);
      if (wallet) {
        await supabase.from("telegram_wallets").update({
          balance: wallet.balance + depositAmount,
          total_earned: wallet.total_earned + depositAmount,
          updated_at: new Date().toISOString(),
        }).eq("telegram_id", order.telegram_user_id);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: order.telegram_user_id,
          type: "deposit",
          amount: depositAmount,
          description: `Manual UPI deposit approved`,
        });

        await sendToUser(tokensToTry, order.telegram_user_id,
          userLang === "bn"
            ? `💰 ₹${depositAmount} আপনার ওয়ালেটে জমা হয়েছে!`
            : `💰 ₹${depositAmount} has been deposited to your wallet!`
        );

        const { syncDepositToProfile } = await import("./sync-helpers.ts");
        await syncDepositToProfile(supabase, order.telegram_user_id, depositAmount, "manual_upi");
      }
    } else {
      try {
        const { syncPurchaseToProfile } = await import("./sync-helpers.ts");
        const websiteLink = resolvedDelivery?.link && resolvedDelivery.showInWebsite ? resolvedDelivery.link : undefined;
        await syncPurchaseToProfile(supabase, order.telegram_user_id, order.amount, order.product_name || "Product", order.product_id || undefined, websiteLink, true);
      } catch (e) { console.error("Sync purchase to profile error:", e); }
    }

    await processReferralBonus(supabase, order.telegram_user_id, token, order.amount);

    if (resolvedDelivery?.link && resolvedDelivery.showInBot && !isChildBotOrder) {
      const { sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
      await sendInstantDeliveryWithLoginCode(userToken, supabase, order.telegram_user_id, order.telegram_user_id, resolvedDelivery.link, order.product_name || "Product", userLang, resolvedDelivery.deliveryMessage);
    } else if (resolvedDelivery?.deliveryMessage?.trim() && !isChildBotOrder) {
      // Even if no link, send the delivery message
      await sendToUser(tokensToTry, order.telegram_user_id, `📝 ${resolvedDelivery.deliveryMessage}`);
    }

    // Credit child bot owner commission if this is a child bot order
    if (order.username?.startsWith("child_bot:")) {
      try {
        const childBotId = order.username.replace("child_bot:", "");
        const { data: childBot } = await supabase.from("child_bots").select("*").eq("id", childBotId).single();
        if (childBot) {
          // Update child bot order status
          await supabase.from("child_bot_orders")
            .update({ status: "confirmed" })
            .eq("telegram_order_id", orderId);

          // Calculate and credit commission
          const commission = Math.round(order.amount * childBot.revenue_percent) / 100;

          // Credit to child bot owner's wallet
          const { data: ownerWallet } = await supabase.from("telegram_wallets").select("balance, total_earned").eq("telegram_id", childBot.owner_telegram_id).single();
          if (ownerWallet) {
            await supabase.from("telegram_wallets").update({
              balance: ownerWallet.balance + commission,
              total_earned: ownerWallet.total_earned + commission,
              updated_at: new Date().toISOString(),
            }).eq("telegram_id", childBot.owner_telegram_id);

            await supabase.from("telegram_wallet_transactions").insert({
              telegram_id: childBot.owner_telegram_id,
              type: "child_bot_commission",
              amount: commission,
              description: `Commission: ${order.product_name} (${childBot.revenue_percent}%)`,
            });
          }

          // Update child bot stats
          await supabase.from("child_bots").update({
            total_earnings: childBot.total_earnings + commission,
            total_orders: childBot.total_orders + 1,
          }).eq("id", childBotId);

          // Create earnings record
          const { data: childOrder } = await supabase.from("child_bot_orders")
            .select("id").eq("telegram_order_id", orderId).single();
          if (childOrder) {
            await supabase.from("child_bot_earnings").insert({
              child_bot_id: childBotId,
              order_id: childOrder.id,
              amount: commission,
              status: "paid",
            });
          }

          // Notify buyer via child bot token (no website link)
          try {
            await sendToUser([childBot.bot_token], order.telegram_user_id,
              `✅ <b>Order Confirmed!</b>\n\nProduct: <b>${order.product_name}</b>\nYour order has been confirmed and delivered! ⚡`
            );

            // Send access link via child bot using the consumed unique/repeated delivery
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
                  `🔗 <b>Your Access Link</b>\n\n${deliveryLink}`
                );
              }
            }
          } catch (e) {
            console.error("Child bot notification error:", e);
          }

          // Notify child bot owner about commission
          try {
            const motherToken = Deno.env.get("MOTHER_BOT_TOKEN");
            if (motherToken) {
              await sendToUser([motherToken], childBot.owner_telegram_id,
                `💰 <b>Commission Earned!</b>\n\n🤖 Bot: @${childBot.bot_username}\n📦 Product: ${order.product_name}\n💵 Commission: ₹${commission} (${childBot.revenue_percent}%)`
              );
            }
          } catch {}
        }
      } catch (e) {
        console.error("Child bot commission error:", e);
      }
    }
  }

  const emoji: Record<string, string> = { confirmed: "✅", rejected: "❌", shipped: "📦" };
  const statusLabel: Record<string, string> = { confirmed: "CONFIRMED", rejected: "REJECTED", shipped: "SHIPPED" };
  await sendMessage(token, adminChatId, `${emoji[newStatus] || "📋"} Order <b>${orderId.slice(0, 8)}</b> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>`);

  // Log proof to channel (show name, not username)
  try {
    let proofName = "User";
    try {
      const { data: bu } = await supabase.from("telegram_bot_users").select("first_name").eq("telegram_id", order.telegram_user_id).single();
      if (bu?.first_name) proofName = bu.first_name;
    } catch {}
    if (newStatus === "confirmed") {
      if (order.product_name?.startsWith("Wallet Deposit")) {
        await logProof(token, formatDepositSuccess(order.telegram_user_id, order.amount, "manual_upi", proofName));
      } else {
        await logProof(token, formatOrderConfirmed(order.telegram_user_id, order.product_name || "N/A", order.amount, proofName));
      }
    } else if (newStatus === "shipped") {
      await logProof(token, formatOrderDelivered(order.telegram_user_id, order.product_name || "N/A", order.amount, proofName));
    }
  } catch { /* proof log non-critical */ }

  // Notify other admins
  const allAdminIds = await getAllAdminIds(supabase);
  const otherAdmins = allAdminIds.filter(id => id !== adminChatId);
  for (const otherAdmin of otherAdmins) {
    try {
      await sendMessage(token, otherAdmin,
        `📋 <b>Order Handled by Another Admin</b>\n\n` +
        `${emoji[newStatus] || "📋"} Order <code>${orderId.slice(0, 8)}</code> → <b>${statusLabel[newStatus] || newStatus.toUpperCase()}</b>\n` +
        `📦 Product: <b>${order.product_name || "N/A"}</b>\n` +
        `👤 Customer: <code>${order.telegram_user_id}</code>\n` +
        `🛡️ Handled by Admin: <code>${adminChatId}</code>`
      );
    } catch { /* admin may have blocked bot */ }
  }
}

// Resend delivery (ID-Pass / Links) for an already confirmed order
export async function handleAdminResend(token: string, supabase: any, orderId: string, adminChatId: number) {
  const { data: order } = await supabase.from("telegram_orders").select("*").eq("id", orderId).single();
  if (!order) { await sendMessage(token, adminChatId, "❌ Order not found."); return; }

  if (order.status !== "confirmed" && order.status !== "shipped") {
    await sendMessage(token, adminChatId, `⚠️ Order is <b>${order.status}</b>. Can only resend for confirmed/shipped orders.`);
    return;
  }

  // Skip wallet deposits
  if (order.product_name?.startsWith("Wallet Deposit")) {
    await sendMessage(token, adminChatId, "ℹ️ This is a wallet deposit — no delivery to resend.");
    return;
  }

  if (!order.product_id) {
    await sendMessage(token, adminChatId, "❌ No product linked to this order.");
    return;
  }

  // Resolve access link (repeated mode returns same link, unique mode returns from product directly)
  const { data: product } = await supabase.from("products").select("access_link, delivery_mode, show_link_in_bot").eq("id", order.product_id).single();
  if (!product?.access_link) {
    await sendMessage(token, adminChatId, "❌ No access link found for this product.");
    return;
  }

  // Determine which bot token to use
  const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
  const isResaleOrder = !!order.reseller_telegram_id;
  const isChildBotOrder = order.username?.startsWith("child_bot:");
  let userToken = token;

  if (isChildBotOrder) {
    const childBotId = order.username.replace("child_bot:", "");
    const { data: childBot } = await supabase.from("child_bots").select("bot_token").eq("id", childBotId).single();
    if (childBot?.bot_token) userToken = childBot.bot_token;
  } else if (isResaleOrder && resaleToken) {
    userToken = resaleToken;
  }

  // Send delivery
  const { sendInstantDeliveryWithLoginCode } = await import("./instant-delivery.ts");
  const userLang = (await getUserLang(supabase, order.telegram_user_id)) || "en";
  await sendInstantDeliveryWithLoginCode(userToken, supabase, order.telegram_user_id, order.telegram_user_id, product.access_link, order.product_name || "Product", userLang);

  await sendMessage(token, adminChatId, `🔄 Delivery resent for order <b>${orderId.slice(0, 8)}</b> → <b>${order.product_name}</b>`);
}