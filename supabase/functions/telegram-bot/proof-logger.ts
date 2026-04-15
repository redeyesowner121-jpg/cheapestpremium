// ===== PROOF CHANNEL LOGGER =====
// Sends automatic proof/log messages to @RKRxProofs channel

import { getChildBotContext } from "./child-context.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROOF_CHANNEL = "@RKRxProofs";

const PROMO_FOOTER = `\n\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n🤖 <b>@Air1_Premium_bot</b>\n💎 Cheapest Premium Subscriptions\n🔒 100% Trusted · Instant Delivery\n🛒 Start Shopping → @Air1_Premium_bot`;

function getTimeIST(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function maskName(name: string): string {
  if (!name || name.length <= 2) return name || "User";
  return name[0] + "•".repeat(Math.min(name.length - 2, 4)) + name[name.length - 1];
}

async function getChildBotFooter(): Promise<string> {
  const ctx = getChildBotContext();
  if (!ctx) return "";

  let ownerUsername = "unknown";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Try telegram_bot_users first, then mother_bot_users
    const { data: botUser } = await supabase
      .from("telegram_bot_users")
      .select("username")
      .eq("telegram_id", ctx.owner_telegram_id)
      .maybeSingle();
    
    if (botUser?.username) {
      ownerUsername = botUser.username;
    } else {
      const { data: motherUser } = await supabase
        .from("mother_bot_users")
        .select("username")
        .eq("telegram_id", ctx.owner_telegram_id)
        .maybeSingle();
      if (motherUser?.username) ownerUsername = motherUser.username;
    }
  } catch {}

  return `\n\n🤖 <b>Via Child Bot:</b> @${ctx.bot_username || "unknown"}\n👤 <b>Bot Owner:</b> @${ownerUsername}`;
}

export async function logProof(token: string, text: string) {
  try {
    const childFooter = await getChildBotFooter();
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PROOF_CHANNEL,
        text: text + childFooter + PROMO_FOOTER,
        parse_mode: "HTML",
      }),
    });
    const result = await res.json();
    if (!result.ok) console.error("Proof log failed:", result.description);
  } catch (e) {
    console.error("Proof log error:", e);
  }
}

export async function logProofPhoto(token: string, fileId: string, caption: string) {
  try {
    const childFooter = await getChildBotFooter();
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PROOF_CHANNEL,
        photo: fileId,
        caption: caption + childFooter + PROMO_FOOTER,
        parse_mode: "HTML",
      }),
    });
    const result = await res.json();
    if (!result.ok) console.error("Proof photo log failed:", result.description);
  } catch (e) {
    console.error("Proof photo log error:", e);
  }
}

// ===== Specific proof formatters =====
// Public proofs show masked first_name only. Admin messages show username separately.

export function formatOrderPlaced(userId: number, firstName: string, productName: string, amount: number, method: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName);
  return `┌─────────────────────┐\n` +
    `   📦 <b>NEW ORDER PLACED</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `💳 Payment: <b>${method}</b>\n` +
    `🕐 ${time}\n\n` +
    `✨ <i>Another happy customer!</i>`;
}

export function formatOrderConfirmed(userId: number, productName: string, amount: number, firstName?: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName || "User");
  return `┌─────────────────────┐\n` +
    `   ✅ <b>ORDER CONFIRMED</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `🕐 ${time}\n\n` +
    `🎉 <i>Delivered successfully!</i>`;
}

export function formatOrderDelivered(userId: number, productName: string, amount: number, firstName?: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName || "User");
  return `┌─────────────────────┐\n` +
    `   📬 <b>ORDER DELIVERED</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `🕐 ${time}\n\n` +
    `⚡ <i>Lightning-fast delivery!</i>`;
}

export function formatDepositSuccess(userId: number, amount: number, method: string, firstName?: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName || "User");
  return `┌─────────────────────┐\n` +
    `   💰 <b>DEPOSIT SUCCESSFUL</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `💵 Amount: <b>₹${amount}</b>\n` +
    `💳 Method: <b>${method}</b>\n` +
    `🕐 ${time}\n\n` +
    `💎 <i>Wallet topped up!</i>`;
}

export function formatWithdrawalUpdate(userId: number, amount: number, method: string, status: string, accountDetails: string, firstName?: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName || "User");
  const emoji = status === "accepted" ? "💸" : status === "delivered" ? "📦" : "❌";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return `┌─────────────────────┐\n` +
    `   ${emoji} <b>WITHDRAWAL ${label.toUpperCase()}</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `💵 Amount: <b>₹${amount}</b>\n` +
    `💳 ${method.toUpperCase()}: <code>${accountDetails}</code>\n` +
    `🕐 ${time}`;
}

export function formatRedeemCode(userId: number, code: string, amount: number, firstName?: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName || "User");
  return `┌─────────────────────┐\n` +
    `   🎟️ <b>REDEEM CODE USED</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `🏷️ Code: <code>${code}</code>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `🕐 ${time}`;
}

export function formatGiveawayRedeem(userId: number, productName: string, points: number, firstName?: string): string {
  const time = getTimeIST();
  const displayName = maskName(firstName || "User");
  return `┌─────────────────────┐\n` +
    `   🎁 <b>GIVEAWAY REDEEMED</b>\n` +
    `└─────────────────────┘\n\n` +
    `👤 Customer: <b>${displayName}</b>\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `🎯 Points: <b>${points}</b>\n` +
    `🕐 ${time}\n\n` +
    `🌟 <i>Free product claimed!</i>`;
}
