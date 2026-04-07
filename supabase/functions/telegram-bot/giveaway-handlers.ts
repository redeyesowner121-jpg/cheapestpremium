// ===== GIVEAWAY HANDLERS for main bot =====

import { sendMessage } from "./telegram-api.ts";
import { t, BOT_USERNAME } from "./constants.ts";
import {
  checkChannelMembership, ensureWallet, notifyAllAdmins,
  getRequiredChannels, getSettings, setUserLang,
} from "./db-helpers.ts";
import { showLanguageSelection } from "./menu/menu-navigation.ts";

// ===== HELPERS =====

async function getPoints(supabase: any, tgId: number) {
  const { data } = await supabase.from("giveaway_points").select("*").eq("telegram_id", tgId).single();
  if (data) return data;
  const { data: newData } = await supabase.from("giveaway_points").insert({ telegram_id: tgId }).select().single();
  return newData;
}

async function getGiveawaySetting(supabase: any, key: string) {
  const { data } = await supabase.from("giveaway_settings").select("value").eq("key", key).single();
  return data?.value;
}

// ===== GIVEAWAY MAIN MENU =====

export async function showGiveawayMainMenu(token: string, supabase: any, chatId: number, lang: string, userId: number) {
  const points = await getPoints(supabase, userId);
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;

  const settings = await getSettings(supabase);
  const storeName = settings.app_name || "RKR Premium Store";

  const welcomeText = lang === "bn"
    ? `🎁 <b>${storeName} গিভওয়ে বট!</b>\n\n💰 পয়েন্ট: <b>${pts}</b> | 👥 রেফারেল: <b>${refs}</b>\n\n✨ রেফার করো → পয়েন্ট অর্জন করো → ফ্রি প্রোডাক্ট জিতো!\n\nনিচে একটি অপশন বেছে নিন:`
    : `🎁 <b>${storeName} Giveaway Bot!</b>\n\n💰 Points: <b>${pts}</b> | 👥 Referrals: <b>${refs}</b>\n\n✨ Refer friends → Earn points → Win free products!\n\nChoose an option below:`;

  await sendMessage(token, chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products" }, { text: "💰 My Points", callback_data: "gw_points" }],
        [{ text: "📎 Referral Link", callback_data: "gw_referral" }, { text: "📜 Redemptions", callback_data: "gw_history" }],
        [{ text: t("view_products", lang), callback_data: "view_products" }],
        [
          { text: t("my_orders", lang), callback_data: "my_orders" },
          { text: t("my_wallet", lang), callback_data: "my_wallet" },
        ],
        [
          { text: t("refer_earn", lang), callback_data: "refer_earn" },
          { text: t("support", lang), callback_data: "support" },
        ],
        [{ text: "Website Login", callback_data: "website_login" }],
      ],
    },
  });
}

// ===== GIVEAWAY JOIN CHANNELS =====

export async function showGiveawayJoinChannels(token: string, supabase: any, chatId: number, lang: string, userId: number) {
  const channels = await getRequiredChannels(supabase);
  const buttons: any[][] = channels.map((ch: string) => {
    const name = ch.startsWith("@") ? ch : `@${ch}`;
    return [{ text: `Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }];
  });
  buttons.push([{ text: `🤖 Start Main Bot (@${BOT_USERNAME})`, url: `https://t.me/${BOT_USERNAME}?start=ref_${userId}` }]);
  buttons.push([{ text: lang === "bn" ? "✅ যাচাই করুন" : "✅ Verify", callback_data: "gw_verify_join" }]);

  const text = lang === "bn"
    ? `🔒 <b>প্রথমে নিচের ধাপগুলি সম্পূর্ণ করুন!</b>\n\n1️⃣ সব চ্যানেলে যোগ দিন\n2️⃣ মেইন বট স্টার্ট করুন\n\nসম্পন্ন হলে "✅ যাচাই করুন" ক্লিক করুন।`
    : `🔒 <b>Complete these steps first!</b>\n\n1️⃣ Join all channels\n2️⃣ Start the Main Bot\n\nAfter completing, click "✅ Verify".`;

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== GIVEAWAY /start HANDLER =====

export async function handleGiveawayStart(
  token: string, supabase: any, chatId: number, userId: number,
  telegramUser: any, payload: string, lang: string, userData: any
) {
  const firstName = telegramUser.first_name || "User";

  // Handle giveaway referral
  if (payload.startsWith("ref_")) {
    const referrerId = parseInt(payload.replace("ref_", ""));
    if (referrerId && referrerId !== userId) {
      const { data: existing } = await supabase
        .from("giveaway_referrals")
        .select("id")
        .eq("referred_telegram_id", userId)
        .single();

      if (!existing) {
        const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");
        await supabase.from("giveaway_referrals").insert({
          referrer_telegram_id: referrerId,
          referred_telegram_id: userId,
          points_awarded: ppr,
        });

        const referrerPoints = await getPoints(supabase, referrerId);
        await supabase.from("giveaway_points")
          .update({
            points: (referrerPoints?.points || 0) + ppr,
            total_referrals: (referrerPoints?.total_referrals || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("telegram_id", referrerId);

        try {
          await sendMessage(token, referrerId,
            `🎉 <b>নতুন রেফারেল!</b>\n\n👤 <b>${firstName}</b> আপনার লিংক দিয়ে জয়েন করেছে!\n🎯 +${ppr} পয়েন্ট যোগ হয়েছে!`
          );
        } catch {}
      }
    }
  }

  await getPoints(supabase, userId);

  if (!userData.language) { await showLanguageSelection(token, chatId); return; }

  const { isAdminBot } = await import("./db-helpers.ts");
  const isUserAdmin = await isAdminBot(supabase, userId);
  const joined = await checkChannelMembership(token, userId, supabase);
  await ensureWallet(supabase, userId);

  if (!isUserAdmin && !joined) {
    await showGiveawayJoinChannels(token, supabase, chatId, lang, userId);
    return;
  }

  await showGiveawayMainMenu(token, supabase, chatId, lang, userId);
}

// ===== GIVEAWAY STATS =====

export async function showGiveawayStats(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const [wallet, points] = await Promise.all([
    supabase.from("telegram_wallets").select("balance, total_earned, is_reseller, referral_code").eq("telegram_id", userId).single().then((r: any) => r.data),
    getPoints(supabase, userId),
  ]);
  const { count: orderCount } = await supabase.from("telegram_orders").select("id", { count: "exact", head: true }).eq("telegram_user_id", userId);
  const bal = wallet?.balance || 0;
  const earned = wallet?.total_earned || 0;
  const refCode = wallet?.referral_code || "N/A";
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;
  const statsText = lang === "bn"
    ? `📊 <b>আপনার পরিসংখ্যান</b>\n\n💰 ব্যালেন্স: <b>₹${bal}</b>\n💵 মোট আয়: <b>₹${earned}</b>\n📦 মোট অর্ডার: <b>${orderCount || 0}</b>\n🎯 গিভওয়ে পয়েন্ট: <b>${pts}</b>\n👥 গিভওয়ে রেফারেল: <b>${refs}</b>\n🏷️ রেফারেল কোড: <code>${refCode}</code>`
    : `📊 <b>Your Stats</b>\n\n💰 Balance: <b>₹${bal}</b>\n💵 Total Earned: <b>₹${earned}</b>\n📦 Total Orders: <b>${orderCount || 0}</b>\n🎯 Giveaway Points: <b>${pts}</b>\n👥 Giveaway Referrals: <b>${refs}</b>\n🏷️ Referral Code: <code>${refCode}</code>`;
  await sendMessage(token, chatId, statsText, {
    reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "gw_main" }]] }
  });
}

// ===== GIVEAWAY REFERRAL LINK =====

export async function showGiveawayReferralLink(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const botInfo = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
  const botUsername = botInfo.result?.username || "giveaway_bot";
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  await sendMessage(token, chatId,
    lang === "bn"
      ? `📎 <b>আপনার গিভওয়ে রেফারেল লিংক:</b>\n\n<code>${refLink}</code>\n\n👆 ক্লিক করে কপি করো!`
      : `📎 <b>Your Giveaway Referral Link:</b>\n\n<code>${refLink}</code>\n\n👆 Click to copy!`, {
    reply_markup: { inline_keyboard: [
      [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join and win free products!")}` }],
      [{ text: "🔙 Back", callback_data: "gw_main" }],
    ]}
  });
}

// ===== GIVEAWAY CALLBACK HANDLERS =====

export async function handleGiveawayCallbacks(
  token: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {

  if (data === "gw_verify_join") {
    const joined = await checkChannelMembership(token, userId, supabase);
    if (!joined) {
      await sendMessage(token, chatId, t("not_joined", lang));
    } else {
      await sendMessage(token, chatId, t("verified", lang));
      await ensureWallet(supabase, userId);
      await showGiveawayMainMenu(token, supabase, chatId, lang, userId);
    }
    return true;
  }

  if (data === "gw_main") {
    await showGiveawayMainMenu(token, supabase, chatId, lang, userId);
    return true;
  }

  if (data === "gw_products") {
    const { data: products } = await supabase
      .from("giveaway_products")
      .select("*, product:products(name, image_url), variation:product_variations(name)")
      .eq("is_active", true);

    if (!products || products.length === 0) {
      await sendMessage(token, chatId,
        lang === "bn" ? "😔 <b>এখন কোনো গিভওয়ে প্রোডাক্ট নেই।</b>" : "😔 <b>No giveaway products available.</b>", {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
      });
      return true;
    }

    let productText = lang === "bn" ? "🎁 <b>গিভওয়ে প্রোডাক্টস:</b>\n\n" : "🎁 <b>Giveaway Products:</b>\n\n";
    const buttons: any[][] = [];
    for (const p of products) {
      const name = (p as any).product?.name || "Unknown";
      const varName = (p as any).variation?.name ? ` (${(p as any).variation.name})` : "";
      const stockText = p.stock !== null ? `📦 ${p.stock} left` : "📦 Unlimited";
      productText += `🏷️ <b>${name}${varName}</b>\n   🎯 ${p.points_required} pts | ${stockText}\n\n`;
      buttons.push([{ text: `🎁 ${name}${varName} (${p.points_required} pts)`, callback_data: `gw_redeem_${p.id}` }]);
    }
    buttons.push([{ text: "🔙 Back", callback_data: "gw_main" }]);
    await sendMessage(token, chatId, productText, { reply_markup: { inline_keyboard: buttons } });
    return true;
  }

  if (data?.startsWith("gw_redeem_")) {
    const productId = data.replace("gw_redeem_", "");
    const [userPoints, product] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("*, product:products(name), variation:product_variations(name)")
        .eq("id", productId).single().then((r: any) => r.data),
    ]);

    if (!product || !product.is_active) {
      await sendMessage(token, chatId, "❌ Product no longer available.");
      return true;
    }
    if (product.stock !== null && product.stock <= 0) {
      await sendMessage(token, chatId, lang === "bn" ? "❌ স্টকে নেই!" : "❌ Out of stock!");
      return true;
    }

    const pts = userPoints?.points || 0;
    if (pts < product.points_required) {
      const needed = product.points_required - pts;
      await sendMessage(token, chatId,
        lang === "bn"
          ? `❌ <b>পর্যাপ্ত পয়েন্ট নেই!</b>\n\n🎯 প্রয়োজন: ${product.points_required} pts\n💰 আপনার: ${pts} pts\n📌 আরো ${needed} দরকার`
          : `❌ <b>Not enough points!</b>\n\n🎯 Need: ${product.points_required} pts\n💰 Yours: ${pts} pts\n📌 ${needed} more needed`, {
        reply_markup: { inline_keyboard: [[{ text: "📎 Referral Link", callback_data: "gw_referral" }, { text: "🔙 Back", callback_data: "gw_products" }]] }
      });
      return true;
    }

    const name = (product as any).product?.name || "Unknown";
    const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";
    await sendMessage(token, chatId,
      lang === "bn"
        ? `🎁 <b>কনফার্ম?</b>\n\n🏷️ ${name}${varName}\n🎯 খরচ: ${product.points_required} pts\n💰 ব্যালেন্স: ${pts} pts\nপরে: ${pts - product.points_required} pts`
        : `🎁 <b>Confirm?</b>\n\n🏷️ ${name}${varName}\n🎯 Cost: ${product.points_required} pts\n💰 Balance: ${pts} pts\nAfter: ${pts - product.points_required} pts`, {
      reply_markup: { inline_keyboard: [
        [{ text: "✅ Confirm", callback_data: `gw_confirm_${productId}` }],
        [{ text: "❌ Cancel", callback_data: "gw_products" }],
      ]}
    });
    return true;
  }

  if (data?.startsWith("gw_confirm_")) {
    const productId = data.replace("gw_confirm_", "");
    const [userPoints, product] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("*, product:products(name), variation:product_variations(name)")
        .eq("id", productId).single().then((r: any) => r.data),
    ]);

    if (!product || !product.is_active || (userPoints?.points || 0) < product.points_required) {
      await sendMessage(token, chatId, "❌ Cannot redeem.");
      return true;
    }

    const pts = userPoints?.points || 0;
    await supabase.from("giveaway_points")
      .update({ points: pts - product.points_required, updated_at: new Date().toISOString() })
      .eq("telegram_id", userId);

    if (product.stock !== null) {
      await supabase.from("giveaway_products")
        .update({ stock: product.stock - 1, updated_at: new Date().toISOString() })
        .eq("id", productId);
    }

    await supabase.from("giveaway_redemptions").insert({
      telegram_id: userId,
      giveaway_product_id: productId,
      points_spent: product.points_required,
      status: "pending",
    });

    const name = (product as any).product?.name || "Unknown";
    const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";
    const firstName = telegramUser.first_name || "User";
    const username = telegramUser.username || null;

    await sendMessage(token, chatId,
      lang === "bn"
        ? `✅ <b>রিডেম্পশন জমা!</b>\n\n🏷️ ${name}${varName}\n🎯 ${product.points_required} pts খরচ\n💰 বাকি: ${pts - product.points_required} pts\n\n⏳ অ্যাডমিন শীঘ্রই ডেলিভার করবে!`
        : `✅ <b>Redemption Submitted!</b>\n\n🏷️ ${name}${varName}\n🎯 ${product.points_required} pts spent\n💰 Remaining: ${pts - product.points_required} pts\n\n⏳ Admin will deliver soon!`, {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "gw_main" }]] }
    });

    // Notify admins
    const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    await notifyAllAdmins(MAIN_TOKEN, supabase,
      `🎁 <b>New Giveaway Redemption!</b>\n\n👤 ${firstName} ${username ? `(@${username})` : ""}\n🆔 <code>${userId}</code>\n🏷️ ${name}${varName}\n🎯 ${product.points_required} pts\n\n📱 Admin Panel → Giveaway Bot → Redemptions`
    );
    return true;
  }

  if (data === "gw_referral") {
    await showGiveawayReferralLink(token, supabase, chatId, userId, lang);
    return true;
  }

  if (data === "gw_points") {
    const points = await getPoints(supabase, userId);
    await sendMessage(token, chatId,
      lang === "bn"
        ? `💰 <b>আপনার পয়েন্ট</b>\n\n🎯 পয়েন্ট: <b>${points?.points || 0}</b>\n👥 রেফারেল: <b>${points?.total_referrals || 0}</b>`
        : `💰 <b>Your Points</b>\n\n🎯 Points: <b>${points?.points || 0}</b>\n👥 Referrals: <b>${points?.total_referrals || 0}</b>`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Referral Link", callback_data: "gw_referral" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  if (data === "gw_history") {
    const { data: redeems } = await supabase
      .from("giveaway_redemptions")
      .select("*, giveaway_product:giveaway_products(product:products(name))")
      .eq("telegram_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    let histText = lang === "bn" ? "📜 <b>রিডেম্পশন:</b>\n\n" : "📜 <b>Redemptions:</b>\n\n";
    if (!redeems?.length) {
      histText += lang === "bn" ? "কোনো রিডেম্পশন নেই।" : "No redemptions yet.";
    } else {
      for (const r of redeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const icon = r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳";
        histText += `${icon} <b>${name}</b> — ${r.points_spent} pts (${r.status})\n`;
      }
    }
    await sendMessage(token, chatId, histText, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
    });
    return true;
  }

  return false;
}
