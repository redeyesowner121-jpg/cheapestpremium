// ===== GIVEAWAY USER CALLBACKS =====

import { sendMessage } from "../telegram-api.ts";
import { ensureWallet } from "../db-helpers.ts";
import { getPoints, getGiveawaySetting, checkGiveawayChannels } from "./helpers.ts";
import { showGiveawayMainMenu, showGiveawayReferralLink } from "./menu.ts";

const BUTTON_STYLES = ["primary", "success", "danger"] as const;
function rotateStyle(index: number): string { return BUTTON_STYLES[index % BUTTON_STYLES.length]; }

export async function handleGiveawayCallbacks(
  token: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, _lang: string
): Promise<boolean> {

  if (data === "gw_verify_join") {
    const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    const joined = await checkGiveawayChannels(MAIN_TOKEN, userId);
    if (!joined) {
      await sendMessage(token, chatId, "❌ You haven't joined all channels yet. Please join both channels and try again.");
    } else {
      const wallet = await ensureWallet(supabase, userId);
      const { data: existingBonus } = await supabase
        .from("telegram_wallet_transactions").select("id")
        .eq("telegram_id", userId).eq("description", "Giveaway Bot Welcome Bonus").single();

      if (!existingBonus) {
        const currentBal = wallet?.balance || 0;
        await supabase.from("telegram_wallets").update({ balance: currentBal + 1, updated_at: new Date().toISOString() }).eq("telegram_id", userId);
        await supabase.from("telegram_wallet_transactions").insert({ telegram_id: userId, amount: 1, type: "bonus", description: "Giveaway Bot Welcome Bonus" });
        await sendMessage(token, chatId, `✅ <b>Verified Successfully!</b>\n\n🎉 +₹1 added to your wallet!\n\n💰 You can withdraw it, refer & redeem premium or earn money! 💸`);
      } else {
        await sendMessage(token, chatId, "✅ Verified! Welcome aboard!");
      }
      await showGiveawayMainMenu(token, supabase, chatId, "en", userId);
    }
    return true;
  }

  if (data === "gw_main") { await showGiveawayMainMenu(token, supabase, chatId, "en", userId); return true; }

  if (data === "gw_products") {
    const { data: giveawayItems } = await supabase.from("giveaway_products").select("id, product_id").eq("is_active", true);
    const productIds = Array.from(new Set((giveawayItems || []).map((item: any) => item.product_id).filter(Boolean)));

    if (productIds.length === 0) {
      await sendMessage(token, chatId, "😔 <b>No giveaway products available.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] } });
      return true;
    }

    const { data: productRows } = await supabase.from("products").select("id, name").in("id", productIds).order("name", { ascending: true });
    if (!productRows?.length) {
      await sendMessage(token, chatId, "😔 <b>No giveaway products available.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] } });
      return true;
    }

    const buttons: any[][] = productRows.map((p: any, i: number) => [{ text: `🎁 ${p.name}`, callback_data: `gw_pdetail_${p.id}`, style: rotateStyle(i) }]);
    buttons.push([{ text: "🔙 Back", callback_data: "gw_main" }]);
    await sendMessage(token, chatId, "🎁 <b>Giveaway Products</b>\n\nChoose a product:", { reply_markup: { inline_keyboard: buttons } });
    return true;
  }

  if (data?.startsWith("gw_pdetail_")) {
    await handleProductDetail(token, supabase, chatId, data.replace("gw_pdetail_", ""));
    return true;
  }

  if (data?.startsWith("gw_redeem_")) {
    await handleRedeemRequest(token, supabase, chatId, userId, data.replace("gw_redeem_", ""));
    return true;
  }

  if (data?.startsWith("gw_confirm_")) {
    await handleRedeemConfirm(token, supabase, chatId, userId, telegramUser, data.replace("gw_confirm_", ""));
    return true;
  }

  if (data === "gw_referral") { await showGiveawayReferralLink(token, supabase, chatId, userId, "en"); return true; }

  if (data === "gw_points") {
    const points = await getPoints(supabase, userId);
    const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");
    await sendMessage(token, chatId,
      `💰 <b>Your Points</b>\n\n🎯 Points: <b>${points?.points || 0}</b>\n👥 Total Referrals: <b>${points?.total_referrals || 0}</b>\n\n📌 Per Referral: <b>${ppr} points</b>`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Refer & Earn", callback_data: "gw_referral", style: "success" }],
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products", style: "primary" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  if (data === "gw_history") {
    const { data: redeems } = await supabase
      .from("giveaway_redemptions").select("*, giveaway_product:giveaway_products(product:products(name))")
      .eq("telegram_id", userId).order("created_at", { ascending: false }).limit(10);

    let histText = "📜 <b>My Redemptions:</b>\n\n";
    if (!redeems?.length) {
      histText += "No redemptions yet.\n\n🎁 Redeem giveaway products!";
    } else {
      for (const r of redeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const icon = r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳";
        const date = new Date(r.created_at).toLocaleDateString();
        histText += `${icon} <b>${name}</b> — ${r.points_spent} pts (${r.status})\n   📅 ${date}\n\n`;
      }
    }
    await sendMessage(token, chatId, histText, {
      reply_markup: { inline_keyboard: [[{ text: "🎁 Giveaway Products", callback_data: "gw_products", style: "success" }, { text: "🔙 Back", callback_data: "gw_main" }]] }
    });
    return true;
  }

  if (data === "gw_reviews") {
    const { data: approvedRedeems } = await supabase
      .from("giveaway_redemptions").select("*, giveaway_product:giveaway_products(product:products(name))")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(10);

    let reviewText = "⭐ <b>Reviews / Successful Redemptions:</b>\n\n";
    if (!approvedRedeems?.length) {
      reviewText += "No successful redemptions yet.";
    } else {
      for (const r of approvedRedeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const date = new Date(r.created_at).toLocaleDateString();
        reviewText += `✅ <b>${name}</b> — ${r.points_spent} pts\n   🆔 ${String(r.telegram_id).slice(0, 4)}**** | 📅 ${date}\n\n`;
      }
    }
    reviewText += "\n🎁 You too can win free products by referring!";
    await sendMessage(token, chatId, reviewText, {
      reply_markup: { inline_keyboard: [[{ text: "📎 Refer & Earn", callback_data: "gw_referral", style: "success" }, { text: "🔙 Back", callback_data: "gw_main" }]] }
    });
    return true;
  }

  return false;
}

// ===== INTERNAL HELPERS =====

async function handleProductDetail(token: string, supabase: any, chatId: number, productId: string) {
  const [productRes, giveawayRes, variationRes] = await Promise.all([
    supabase.from("products").select("id, name, image_url, description").eq("id", productId).maybeSingle(),
    supabase.from("giveaway_products").select("id, product_id, variation_id, points_required, stock, is_active").eq("product_id", productId).eq("is_active", true).order("created_at", { ascending: true }),
    supabase.from("product_variations").select("id, name").eq("product_id", productId).order("created_at", { ascending: true }),
  ]);

  const product = productRes.data;
  const items = giveawayRes.data || [];
  const variationMap = new Map((variationRes.data || []).map((v: any) => [v.id, v.name]));

  if (!product) { await sendMessage(token, chatId, "❌ Product not found."); return; }
  if (items.length === 0) { await sendMessage(token, chatId, "❌ No giveaway options available for this product."); return; }

  const buttons: any[][] = items.map((item: any) => {
    const variationName = item.variation_id ? variationMap.get(item.variation_id) || "Selected variation" : "Standard";
    const stockText = item.stock !== null ? (item.stock > 0 ? `📦${item.stock}` : "❌Sold") : "∞";
    return [{ text: `${variationName} — ${item.points_required} pts (${stockText})`, callback_data: `gw_redeem_${item.id}`, style: "success" }];
  });
  buttons.push([{ text: "🔙 Back", callback_data: "gw_products" }]);

  const caption = `🎁 <b>${product.name}</b>\n\n${product.description || ""}\n\nChoose a variation to redeem:`;

  if (product.image_url) {
    const { sendPhoto } = await import("../telegram-api.ts");
    await sendPhoto(token, chatId, product.image_url, caption, { inline_keyboard: buttons });
  } else {
    await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
  }
}

async function handleRedeemRequest(token: string, supabase: any, chatId: number, userId: number, gpId: string) {
  const [userPoints, giveawayItemRes] = await Promise.all([
    getPoints(supabase, userId),
    supabase.from("giveaway_products").select("id, product_id, variation_id, points_required, stock, is_active").eq("id", gpId).maybeSingle(),
  ]);

  const giveawayItem = giveawayItemRes.data;
  if (!giveawayItem || !giveawayItem.is_active) { await sendMessage(token, chatId, "❌ Product no longer available."); return; }
  if (giveawayItem.stock !== null && giveawayItem.stock <= 0) { await sendMessage(token, chatId, "❌ Out of stock!"); return; }

  const [productRes, variationRes] = await Promise.all([
    supabase.from("products").select("name").eq("id", giveawayItem.product_id).maybeSingle(),
    giveawayItem.variation_id ? supabase.from("product_variations").select("name").eq("id", giveawayItem.variation_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const pts = userPoints?.points || 0;
  const name = productRes.data?.name || "Unknown";
  const varName = variationRes.data?.name ? ` (${variationRes.data.name})` : "";

  if (pts < giveawayItem.points_required) {
    const needed = giveawayItem.points_required - pts;
    await sendMessage(token, chatId,
      `❌ <b>Not enough points!</b>\n\n🎯 Need: ${giveawayItem.points_required} pts\n💰 Yours: ${pts} pts\n📌 ${needed} more needed`, {
        reply_markup: { inline_keyboard: [[{ text: "📎 Refer & Earn", callback_data: "gw_referral", style: "success" }, { text: "🔙 Back", callback_data: `gw_pdetail_${giveawayItem.product_id}` }]] }
      });
    return;
  }

  await sendMessage(token, chatId,
    `🎁 <b>Confirm Redeem?</b>\n\n🏷️ ${name}${varName}\n🎯 Cost: ${giveawayItem.points_required} pts\n💰 Balance: ${pts} pts\nAfter: ${pts - giveawayItem.points_required} pts`, {
      reply_markup: { inline_keyboard: [
        [{ text: "✅ Confirm", callback_data: `gw_confirm_${gpId}`, style: "success" }],
        [{ text: "❌ Cancel", callback_data: `gw_pdetail_${giveawayItem.product_id}`, style: "danger" }],
      ]}
    });
}

async function handleRedeemConfirm(token: string, supabase: any, chatId: number, userId: number, telegramUser: any, giveawayItemId: string) {
  const [userPoints, giveawayItemRes] = await Promise.all([
    getPoints(supabase, userId),
    supabase.from("giveaway_products").select("id, product_id, variation_id, points_required, stock, is_active").eq("id", giveawayItemId).maybeSingle(),
  ]);

  const giveawayItem = giveawayItemRes.data;
  if (!giveawayItem || !giveawayItem.is_active || (userPoints?.points || 0) < giveawayItem.points_required) {
    await sendMessage(token, chatId, "❌ Cannot redeem.");
    return;
  }

  const [productRes, variationRes] = await Promise.all([
    supabase.from("products").select("name").eq("id", giveawayItem.product_id).maybeSingle(),
    giveawayItem.variation_id ? supabase.from("product_variations").select("name").eq("id", giveawayItem.variation_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const pts = userPoints?.points || 0;
  await supabase.from("giveaway_points").update({ points: pts - giveawayItem.points_required, updated_at: new Date().toISOString() }).eq("telegram_id", userId);

  if (giveawayItem.stock !== null) {
    await supabase.from("giveaway_products").update({ stock: Math.max(0, giveawayItem.stock - 1), updated_at: new Date().toISOString() }).eq("id", giveawayItemId);
  }

  const name = productRes.data?.name || "Unknown";
  const varName = variationRes.data?.name ? ` (${variationRes.data.name})` : "";

  // Fetch access link for instant delivery
  const { data: productFull } = await supabase.from("products").select("access_link").eq("id", giveawayItem.product_id).maybeSingle();
  const accessLink = productFull?.access_link || null;

  await supabase.from("giveaway_redemptions").insert({
    telegram_id: userId, giveaway_product_id: giveawayItemId,
    points_spent: giveawayItem.points_required, status: "completed",
  });

  const remaining = pts - giveawayItem.points_required;
  let deliveryMsg = `✅ <b>Redemption Complete!</b>\n\n🏷️ ${name}${varName}\n🎯 ${giveawayItem.points_required} pts spent\n💰 Remaining: ${remaining} pts`;

  if (accessLink) {
    const isCredentials = accessLink.includes("ID:") && accessLink.includes("Password:");
    deliveryMsg += isCredentials
      ? `\n\n🔑 <b>Your Credentials:</b>\n<code>${accessLink}</code>`
      : `\n\n🔗 <b>Your Access Link:</b>\n${accessLink}`;
  } else {
    deliveryMsg += `\n\n📦 Your product has been delivered!`;
  }

  await sendMessage(token, chatId, deliveryMsg, {
    reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "gw_main", style: "primary" }]] }
  });

  const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
  try {
    const { logProof, formatGiveawayRedeem } = await import("../proof-logger.ts");
    await logProof(MAIN_TOKEN, formatGiveawayRedeem(userId, `${name}${varName}`, giveawayItem.points_required));
  } catch {}
}
