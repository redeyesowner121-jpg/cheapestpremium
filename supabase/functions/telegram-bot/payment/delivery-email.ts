// ===== Email copy of the delivered order (best-effort) =====

export async function sendDeliveryEmail(
  supabase: any,
  telegramId: number,
  productName: string,
  accessLink: string,
) {
  try {
    const { sendBotUserEmail } = await import("../../_shared/bot-email.ts");
    const isCreds = accessLink.includes("\n") || accessLink.includes("|");
    const blocks: Array<{ label: string; value: string; mono?: boolean; link?: string }> = [
      { label: "Product", value: productName },
    ];
    // Hide 2FA secret in email too
    const visibleAccess = accessLink
      .split("\n")
      .filter((line) => !/^\s*(2fa|two[-\s]?fa|totp|otp\s*secret|secret)\s*[:=]/i.test(line))
      .join("\n")
      .trim();
    if (isCreds || visibleAccess.includes("\n") || visibleAccess.includes("|")) {
      blocks.push({ label: "Your Credentials", value: visibleAccess.replace(/\|/g, "\n"), mono: true });
    } else if (/^https?:\/\//i.test(visibleAccess)) {
      blocks.push({ label: "Access Link", value: "Open Access", link: visibleAccess });
    } else {
      blocks.push({ label: "Access", value: visibleAccess, mono: true });
    }
    await sendBotUserEmail(
      supabase,
      telegramId,
      `🚀 ${productName} — Delivery from Cheapest-Premium.in`,
      {
        title: `${productName} delivered!`,
        preheader: `Your ${productName} is ready — full access details inside.`,
        badge: { text: "Delivered", color: "#10b981" },
        intro: `Your order has been delivered successfully. Your access details are below — keep them safe.`,
        blocks,
        warning: "Do not share these details with anyone. If you face any problem, reply on Telegram or contact our support.",
      },
      { template: "bot_instant_delivery" }
    );
  } catch (e) {
    console.error("[delivery-email] failed:", e);
  }
}
