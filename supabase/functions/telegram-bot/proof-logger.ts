// ===== PROOF CHANNEL LOGGER =====
// Sends automatic proof/log messages to @RKRxProofs channel

const PROOF_CHANNEL = "@RKRxProofs";

export async function logProof(token: string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PROOF_CHANNEL,
        text,
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
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PROOF_CHANNEL,
        photo: fileId,
        caption,
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

export function formatOrderPlaced(userId: number, username: string, productName: string, amount: number, method: string): string {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return `📦 <b>New Order Placed</b>\n\n` +
    `👤 User: <b>${username}</b> (<code>${userId}</code>)\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `💳 Method: <b>${method}</b>\n` +
    `🕐 Time: ${now}`;
}

export function formatOrderConfirmed(userId: number, productName: string, amount: number): string {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return `✅ <b>Order Confirmed</b>\n\n` +
    `👤 User: <code>${userId}</code>\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `🕐 Time: ${now}`;
}

export function formatOrderDelivered(userId: number, productName: string, amount: number): string {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return `📬 <b>Order Delivered</b>\n\n` +
    `👤 User: <code>${userId}</code>\n` +
    `🛒 Product: <b>${productName}</b>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `🕐 Time: ${now}`;
}

export function formatDepositSuccess(userId: number, amount: number, method: string): string {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return `💰 <b>Deposit Successful</b>\n\n` +
    `👤 User: <code>${userId}</code>\n` +
    `💵 Amount: <b>₹${amount}</b>\n` +
    `💳 Method: <b>${method}</b>\n` +
    `🕐 Time: ${now}`;
}

export function formatWithdrawalUpdate(userId: number, amount: number, method: string, status: string, accountDetails: string): string {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const emoji = status === "accepted" ? "💸" : status === "delivered" ? "📦" : "❌";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return `${emoji} <b>Withdrawal ${label}</b>\n\n` +
    `👤 User: <code>${userId}</code>\n` +
    `💵 Amount: <b>₹${amount}</b>\n` +
    `💳 ${method.toUpperCase()}: <code>${accountDetails}</code>\n` +
    `🕐 Time: ${now}`;
}

export function formatRedeemCode(userId: number, code: string, amount: number): string {
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return `🎟️ <b>Redeem Code Used</b>\n\n` +
    `👤 User: <code>${userId}</code>\n` +
    `🏷️ Code: <code>${code}</code>\n` +
    `💰 Amount: <b>₹${amount}</b>\n` +
    `🕐 Time: ${now}`;
}
