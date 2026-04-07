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

// Fixed referral link for main bot
const MAIN_BOT_REF_LINK = "https://t.me/Air1_Premium_bot?start=ref_REFJFF7FC";

// Giveaway-specific required channels (hardcoded)
const GIVEAWAY_REQUIRED_CHANNELS = ["@rkrxott", "@pocket_money27"];

export async function checkGiveawayChannels(mainToken: string, userId: number): Promise<boolean> {
  const { getChatMember } = await import("./telegram-api.ts");
  const results = await Promise.all(
    GIVEAWAY_REQUIRED_CHANNELS.map(ch => getChatMember(mainToken, ch, userId))
  );
  return results.every(status => ["member", "administrator", "creator"].includes(status));
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
        [
          { text: "🎁 Giveaway Products", callback_data: "gw_products" },
          { text: "💰 My Points", callback_data: "gw_points" },
        ],
        [
          { text: "📜 Redemptions", callback_data: "gw_history" },
          { text: "📎 Refer & Earn", callback_data: "gw_referral" },
        ],
        [
          { text: "⭐ Reviews", callback_data: "gw_reviews" },
          { text: "📞 Support", callback_data: "support" },
        ],
        [{ text: "🌐 Website Login", callback_data: "website_login" }],
      ],
    },
  });
}

// ===== GIVEAWAY JOIN CHANNELS =====

export async function showGiveawayJoinChannels(token: string, supabase: any, chatId: number, lang: string, userId: number) {
  // Fixed channels: @rkrxott, @pocket_money27, and main bot ref link
  const buttons: any[][] = [
    [{ text: "Join @RKRxOTT", url: "https://t.me/RKRxOTT" }],
    [{ text: "Join @pocket_money27", url: "https://t.me/pocket_money27" }],
    [{ text: "🤖 Start Main Bot", url: MAIN_BOT_REF_LINK }],
    [{ text: lang === "bn" ? "✅ যাচাই করুন" : "✅ Verify", callback_data: "gw_verify_join" }],
  ];

  const text = lang === "bn"
    ? `🔒 <b>প্রথমে নিচের ধাপগুলি সম্পূর্ণ করুন!</b>\n\n1️⃣ @RKRxOTT চ্যানেলে জয়েন করুন\n2️⃣ @pocket_money27 চ্যানেলে জয়েন করুন\n3️⃣ মেইন বট স্টার্ট করুন\n\nসম্পন্ন হলে "✅ যাচাই করুন" ক্লিক করুন।`
    : `🔒 <b>Complete these steps first!</b>\n\n1️⃣ Join @RKRxOTT channel\n2️⃣ Join @pocket_money27 channel\n3️⃣ Start the Main Bot\n\nAfter completing, click "✅ Verify".`;

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
  // Use MAIN bot token for channel checks since giveaway bot isn't admin of channels
  const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
  const joined = await checkGiveawayChannels(MAIN_TOKEN, userId);
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
  
  const points = await getPoints(supabase, userId);
  const pts = points?.points || 0;
  const refs = points?.total_referrals || 0;
  const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");

  const text = lang === "bn"
    ? `📎 <b>রেফার & আর্ন</b>\n\n🔗 আপনার গিভওয়ে রেফারেল লিংক:\n<code>${refLink}</code>\n\n💰 পয়েন্ট: <b>${pts}</b>\n👥 মোট রেফারেল: <b>${refs}</b>\n🎯 প্রতি রেফারে: <b>${ppr} পয়েন্ট</b>\n\n✨ বন্ধুদের শেয়ার করো এবং ফ্রি প্রোডাক্ট জিতো!\n\n👆 লিংকে ক্লিক করে কপি করো!`
    : `📎 <b>Refer & Earn</b>\n\n🔗 Your Giveaway Referral Link:\n<code>${refLink}</code>\n\n💰 Points: <b>${pts}</b>\n👥 Total Referrals: <b>${refs}</b>\n🎯 Per Referral: <b>${ppr} points</b>\n\n✨ Share with friends and win free products!\n\n👆 Click to copy!`;

  await sendMessage(token, chatId, text, {
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
    // Use MAIN bot token for channel checks
    const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    const joined = await checkGiveawayChannels(MAIN_TOKEN, userId);
    if (!joined) {
      await sendMessage(token, chatId, t("not_joined", lang));
    } else {
      // Add ₹1 welcome bonus to wallet (only first time)
      const wallet = await ensureWallet(supabase, userId);
      
      // Check if this user already got the welcome bonus
      const { data: existingBonus } = await supabase
        .from("telegram_wallet_transactions")
        .select("id")
        .eq("telegram_id", userId)
        .eq("description", "Giveaway Bot Welcome Bonus")
        .single();

      if (!existingBonus) {
        // Add ₹1 to wallet
        const currentBal = wallet?.balance || 0;
        await supabase.from("telegram_wallets")
          .update({ balance: currentBal + 1, updated_at: new Date().toISOString() })
          .eq("telegram_id", userId);

        await supabase.from("telegram_wallet_transactions").insert({
          telegram_id: userId,
          amount: 1,
          type: "bonus",
          description: "Giveaway Bot Welcome Bonus",
        });

        const successText = lang === "bn"
          ? `✅ <b>সফলভাবে ভেরিফাই হয়েছে!</b>\n\n🎉 +₹1 আপনার ওয়ালেটে যোগ হয়েছে!\n\n💰 আপনি এটি উইথড্র করতে পারবেন, রেফার করে প্রিমিয়াম রিডিম করতে পারবেন অথবা টাকা আয় করতে পারবেন! 💸`
          : `✅ <b>Verified Successfully!</b>\n\n🎉 +₹1 added to your wallet!\n\n💰 You can withdraw it, refer & redeem premium or earn money! 💸`;

        await sendMessage(token, chatId, successText);
      } else {
        await sendMessage(token, chatId, t("verified", lang));
      }

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
      .select("*, product:products(id, name)")
      .eq("is_active", true);

    if (!products || products.length === 0) {
      await sendMessage(token, chatId,
        lang === "bn" ? "😔 <b>এখন কোনো গিভওয়ে প্রোডাক্ট নেই।</b>" : "😔 <b>No giveaway products available.</b>", {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
      });
      return true;
    }

    // Group by product name to avoid duplicates
    const seen = new Set<string>();
    const buttons: any[][] = [];
    for (const p of products) {
      const name = (p as any).product?.name || "Unknown";
      const productId = (p as any).product?.id;
      if (!productId || seen.has(productId)) continue;
      seen.add(productId);
      buttons.push([{ text: `🎁 ${name}`, callback_data: `gw_pdetail_${productId}` }]);
    }
    buttons.push([{ text: "🔙 Back", callback_data: "gw_main" }]);

    const text = lang === "bn"
      ? "🎁 <b>গিভওয়ে প্রোডাক্টস</b>\n\nএকটি প্রোডাক্ট বেছে নিন:"
      : "🎁 <b>Giveaway Products</b>\n\nChoose a product:";
    await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
    return true;
  }

  // Product detail with photo + variations
  if (data?.startsWith("gw_pdetail_")) {
    const productId = data.replace("gw_pdetail_", "");
    
    const [productRes, gwProducts] = await Promise.all([
      supabase.from("products").select("id, name, image_url, description").eq("id", productId).single(),
      supabase.from("giveaway_products")
        .select("*, variation:product_variations(id, name)")
        .eq("product_id", productId).eq("is_active", true),
    ]);

    const product = productRes.data;
    if (!product) {
      await sendMessage(token, chatId, "❌ Product not found.");
      return true;
    }

    const items = gwProducts.data || [];
    if (items.length === 0) {
      await sendMessage(token, chatId, "❌ No giveaway options available for this product.");
      return true;
    }

    const buttons: any[][] = [];
    for (const gp of items) {
      const varName = (gp as any).variation?.name || "Standard";
      const stockText = gp.stock !== null ? (gp.stock > 0 ? `📦${gp.stock}` : "❌Sold") : "∞";
      buttons.push([{
        text: `${varName} — ${gp.points_required} pts (${stockText})`,
        callback_data: `gw_redeem_${gp.id}`,
      }]);
    }
    buttons.push([{ text: "🔙 Back", callback_data: "gw_products" }]);

    const caption = lang === "bn"
      ? `🎁 <b>${product.name}</b>\n\n${product.description || ""}\n\nনিচে একটি ভেরিয়েশন বেছে রিডিম করুন:`
      : `🎁 <b>${product.name}</b>\n\n${product.description || ""}\n\nChoose a variation to redeem:`;

    if (product.image_url) {
      const { sendPhoto } = await import("./telegram-api.ts");
      await sendPhoto(token, chatId, product.image_url, caption, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
    }
    return true;
  }

  if (data?.startsWith("gw_redeem_")) {
    const gpId = data.replace("gw_redeem_", "");
    const [userPoints, gpRes] = await Promise.all([
      getPoints(supabase, userId),
      supabase.from("giveaway_products")
        .select("*, product:products(name, image_url), variation:product_variations(name)")
        .eq("id", gpId).single(),
    ]);
    const product = gpRes.data;

    if (!product || !product.is_active) {
      await sendMessage(token, chatId, "❌ Product no longer available.");
      return true;
    }
    if (product.stock !== null && product.stock <= 0) {
      await sendMessage(token, chatId, lang === "bn" ? "❌ স্টকে নেই!" : "❌ Out of stock!");
      return true;
    }

    const pts = userPoints?.points || 0;
    const name = (product as any).product?.name || "Unknown";
    const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";

    if (pts < product.points_required) {
      const needed = product.points_required - pts;
      await sendMessage(token, chatId,
        lang === "bn"
          ? `❌ <b>পর্যাপ্ত পয়েন্ট নেই!</b>\n\n🎯 প্রয়োজন: ${product.points_required} pts\n💰 আপনার: ${pts} pts\n📌 আরো ${needed} দরকার`
          : `❌ <b>Not enough points!</b>\n\n🎯 Need: ${product.points_required} pts\n💰 Yours: ${pts} pts\n📌 ${needed} more needed`, {
        reply_markup: { inline_keyboard: [[{ text: "📎 Refer & Earn", callback_data: "gw_referral" }, { text: "🔙 Back", callback_data: `gw_pdetail_${product.product_id}` }]] }
      });
      return true;
    }

    await sendMessage(token, chatId,
      lang === "bn"
        ? `🎁 <b>কনফার্ম রিডিম?</b>\n\n🏷️ ${name}${varName}\n🎯 খরচ: ${product.points_required} pts\n💰 ব্যালেন্স: ${pts} pts\nপরে: ${pts - product.points_required} pts`
        : `🎁 <b>Confirm Redeem?</b>\n\n🏷️ ${name}${varName}\n🎯 Cost: ${product.points_required} pts\n💰 Balance: ${pts} pts\nAfter: ${pts - product.points_required} pts`, {
      reply_markup: { inline_keyboard: [
        [{ text: "✅ Confirm", callback_data: `gw_confirm_${gpId}` }],
        [{ text: "❌ Cancel", callback_data: `gw_pdetail_${product.product_id}` }],
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

    // Notify admins on bot
    const MAIN_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || token;
    await notifyAllAdmins(MAIN_TOKEN, supabase,
      `🎁 <b>New Giveaway Redemption!</b>\n\n👤 ${firstName} ${username ? `(@${username})` : ""}\n🆔 <code>${userId}</code>\n🏷️ ${name}${varName}\n🎯 ${product.points_required} pts\n\n📱 Admin Panel → Giveaway Bot → Redemptions`
    );

    // Notify admins on web (create notification for all admin users)
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "temp_admin"]);
    
    if (adminRoles?.length) {
      const notifications = adminRoles.map((ar: any) => ({
        user_id: ar.user_id,
        title: "🎁 New Giveaway Redemption",
        message: `${firstName} ${username ? `(@${username})` : ""} redeemed ${name}${varName} for ${product.points_required} pts`,
        type: "order",
      }));
      await supabase.from("notifications").insert(notifications);
    }

    return true;
  }

  if (data === "gw_referral") {
    await showGiveawayReferralLink(token, supabase, chatId, userId, lang);
    return true;
  }

  if (data === "gw_points") {
    const points = await getPoints(supabase, userId);
    const ppr = parseInt(await getGiveawaySetting(supabase, "points_per_referral") || "2");
    await sendMessage(token, chatId,
      lang === "bn"
        ? `💰 <b>আপনার পয়েন্ট</b>\n\n🎯 পয়েন্ট: <b>${points?.points || 0}</b>\n👥 মোট রেফারেল: <b>${points?.total_referrals || 0}</b>\n\n📌 প্রতি রেফারে: <b>${ppr} পয়েন্ট</b>`
        : `💰 <b>Your Points</b>\n\n🎯 Points: <b>${points?.points || 0}</b>\n👥 Total Referrals: <b>${points?.total_referrals || 0}</b>\n\n📌 Per Referral: <b>${ppr} points</b>`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Refer & Earn", callback_data: "gw_referral" }],
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products" }],
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

    let histText = lang === "bn" ? "📜 <b>আমার রিডেম্পশনস:</b>\n\n" : "📜 <b>My Redemptions:</b>\n\n";
    if (!redeems?.length) {
      histText += lang === "bn" ? "কোনো রিডেম্পশন নেই।\n\n🎁 গিভওয়ে প্রোডাক্ট রিডিম করুন!" : "No redemptions yet.\n\n🎁 Redeem giveaway products!";
    } else {
      for (const r of redeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const icon = r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳";
        const date = new Date(r.created_at).toLocaleDateString();
        histText += `${icon} <b>${name}</b> — ${r.points_spent} pts (${r.status})\n   📅 ${date}\n\n`;
      }
    }
    await sendMessage(token, chatId, histText, {
      reply_markup: { inline_keyboard: [
        [{ text: "🎁 Giveaway Products", callback_data: "gw_products" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  if (data === "gw_reviews") {
    // Show recent approved redemptions as social proof / reviews
    const { data: approvedRedeems } = await supabase
      .from("giveaway_redemptions")
      .select("*, giveaway_product:giveaway_products(product:products(name))")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10);

    let reviewText = lang === "bn" ? "⭐ <b>রিভিউস / সফল রিডেম্পশন:</b>\n\n" : "⭐ <b>Reviews / Successful Redemptions:</b>\n\n";
    if (!approvedRedeems?.length) {
      reviewText += lang === "bn" ? "এখনো কোনো সফল রিডেম্পশন নেই।" : "No successful redemptions yet.";
    } else {
      for (const r of approvedRedeems) {
        const name = (r as any).giveaway_product?.product?.name || "Unknown";
        const date = new Date(r.created_at).toLocaleDateString();
        reviewText += `✅ <b>${name}</b> — ${r.points_spent} pts\n   🆔 ${String(r.telegram_id).slice(0, 4)}**** | 📅 ${date}\n\n`;
      }
    }
    reviewText += lang === "bn" ? "\n🎁 তুমিও রেফার করে ফ্রি প্রোডাক্ট জিতো!" : "\n🎁 You too can win free products by referring!";

    await sendMessage(token, chatId, reviewText, {
      reply_markup: { inline_keyboard: [
        [{ text: "📎 Refer & Earn", callback_data: "gw_referral" }],
        [{ text: "🔙 Back", callback_data: "gw_main" }],
      ]}
    });
    return true;
  }

  return false;
}
