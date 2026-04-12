// ===== WALLET, ORDERS, REFERRAL, OFFERS =====

import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getSettings, ensureWallet, getWallet } from "../db-helpers.ts";

export async function handleMyOrders(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const { data: orders } = await supabase
    .from("telegram_orders")
    .select("*")
    .eq("telegram_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!orders?.length) {
    await sendMessage(token, chatId,
      lang === "bn"
        ? "📦 আপনার কোনো অর্ডার নেই।\n\nপ্রোডাক্ট কিনতে নিচের বাটনে ক্লিক করুন!"
        : "📦 You have no orders yet.\n\nClick below to browse products!",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: t("view_products", lang), callback_data: "view_products" }],
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      }
    );
    return;
  }

  const statusEmoji: Record<string, string> = { pending: "⏳", confirmed: "✅", rejected: "❌", shipped: "📦", delivered: "🎉" };
  const statusText: Record<string, Record<string, string>> = {
    pending: { en: "Pending", bn: "অপেক্ষমান" },
    confirmed: { en: "Confirmed", bn: "নিশ্চিত" },
    rejected: { en: "Rejected", bn: "প্রত্যাখ্যাত" },
    shipped: { en: "Shipped", bn: "শিপ হয়েছে" },
    delivered: { en: "Delivered", bn: "ডেলিভারি হয়েছে" },
  };

  let text = lang === "bn"
    ? "📦 <b>আমার অর্ডারসমূহ</b> (সর্বশেষ ১০টি)\n\n"
    : "📦 <b>My Orders</b> (Last 10)\n\n";

  orders.forEach((o: any, i: number) => {
    const emoji = statusEmoji[o.status] || "📋";
    const status = statusText[o.status]?.[lang] || o.status;
    const date = new Date(o.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    text += `${i + 1}. ${emoji} <b>${o.product_name || "N/A"}</b>\n`;
    text += `   💵 ₹${o.amount} | ${lang === "bn" ? "স্ট্যাটাস" : "Status"}: <b>${status}</b>\n`;
    text += `   📅 ${date}\n`;
    if (o.status === "shipped") text += `   ${lang === "bn" ? "🎉 শীঘ্রই ডেলিভারি হবে!" : "🎉 Arriving soon!"}\n`;
    text += "\n";
  });

  text += lang === "bn"
    ? "💡 <i>সমস্যা থাকলে সাপোর্টে যোগাযোগ করুন।</i>"
    : "💡 <i>Contact support if you have any issues.</i>";

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === "bn" ? "আরো কিনুন" : "Buy More", callback_data: "view_products" }],
        [{ text: t("support", lang), callback_data: "support" }],
        [{ text: t("back_main", lang), callback_data: "back_main" }],
      ],
    },
  });
}

export async function handleMyWallet(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const wallet = await ensureWallet(supabase, userId);
  const balance = wallet?.balance || 0;
  const totalEarned = wallet?.total_earned || 0;
  const refCode = wallet?.referral_code || "N/A";

  // Read bot username from DB settings
  const settings = await getSettings(supabase);
  const botUsername = settings.bot_username || "Air1_Premium_bot";

  const { data: recent } = await supabase
    .from("telegram_wallet_transactions")
    .select("type, amount, description, created_at")
    .eq("telegram_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  let text = `${t("wallet_header", lang)}\n\n`;
  text += `💵 ${lang === "bn" ? "ব্যালেন্স" : "Balance"}: <b>₹${balance}</b>\n`;
  text += `📈 ${lang === "bn" ? "মোট আয়" : "Total Earned"}: <b>₹${totalEarned}</b>\n`;
  text += `🔗 ${lang === "bn" ? "রেফারেল কোড" : "Referral Code"}: <code>${refCode}</code>\n`;
  text += `📎 ${lang === "bn" ? "রেফারেল লিংক" : "Referral Link"}: https://t.me/${botUsername}?start=ref_${encodeURIComponent(refCode)}\n`;

  if (recent?.length) {
    text += `\n<b>${lang === "bn" ? "সাম্প্রতিক লেনদেন:" : "Recent Transactions:"}</b>\n`;
    for (const tx of recent) {
      const emoji = tx.amount > 0 ? "🟢" : "🔴";
      const sign = tx.amount > 0 ? "+" : "";
      text += `${emoji} ${sign}₹${tx.amount} - ${tx.description || tx.type}\n`;
    }
  }

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === "bn" ? "টপ আপ" : "Deposit", callback_data: "wallet_deposit" },
          { text: lang === "bn" ? "উইথড্র" : "Withdraw", callback_data: "wallet_withdraw" }
        ],
        [{ text: t("back_main", lang), callback_data: "back_main" }],
      ],
    },
  });
}

export async function handleReferEarn(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const wallet = await ensureWallet(supabase, userId);
  const refCode = wallet?.referral_code || "N/A";
  const settings = await getSettings(supabase);
  const bonus = settings.referral_bonus || "10";
  const botUsername = settings.bot_username || "Air1_Premium_bot";

  let text = `${t("referral_header", lang)}\n\n`;
  text += lang === "bn"
    ? `প্রতিটি রেফারেলের জন্য ₹${bonus} বোনাস পান!\n\n🔗 আপনার রেফারেল লিংক:\nhttps://t.me/${botUsername}?start=ref_${encodeURIComponent(refCode)}\n\n📋 কোড: <code>${refCode}</code>\n\n1️⃣ লিংক শেয়ার করুন\n2️⃣ বন্ধু যোগ দিক\n3️⃣ তারা কেনাকাটা করলে আপনি বোনাস পাবেন!`
    : `Earn ₹${bonus} for every referral!\n\n🔗 Your referral link:\nhttps://t.me/${botUsername}?start=ref_${encodeURIComponent(refCode)}\n\n📋 Code: <code>${refCode}</code>\n\n1️⃣ Share the link\n2️⃣ Friend joins\n3️⃣ When they purchase, you get a bonus!`;

  await sendMessage(token, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] },
  });
}

export async function handleGetOffers(token: string, supabase: any, chatId: number, lang: string) {
  const { data: flashSales } = await supabase
    .from("flash_sales")
    .select("*, products(name, price, image_url)")
    .eq("is_active", true)
    .gt("end_time", new Date().toISOString())
    .limit(5);

  const { data: coupons } = await supabase
    .from("coupons")
    .select("code, description, discount_type, discount_value")
    .eq("is_active", true)
    .limit(5);

  let text = lang === "bn" ? "🔥 <b>অফার ও ডিসকাউন্ট</b>\n\n" : "🔥 <b>Offers & Discounts</b>\n\n";

  if (flashSales?.length) {
    text += lang === "bn" ? "<b>⚡ ফ্ল্যাশ সেল:</b>\n" : "<b>⚡ Flash Sales:</b>\n";
    flashSales.forEach((s: any) => {
      const name = s.products?.name || "Product";
      text += `• ${name}: <b>₹${s.sale_price}</b> (was ₹${s.products?.price || "?"})\n`;
    });
    text += "\n";
  }

  if (coupons?.length) {
    text += lang === "bn" ? "<b>🎟️ কুপন কোড:</b>\n" : "<b>🎟️ Coupon Codes:</b>\n";
    coupons.forEach((c: any) => {
      const disc = c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`;
      text += `• <code>${c.code}</code> — ${disc} OFF${c.description ? ` (${c.description})` : ""}\n`;
    });
  }

  if (!flashSales?.length && !coupons?.length) {
    text += lang === "bn" ? "😔 এখন কোনো অফার নেই।" : "😔 No offers available right now.";
  }

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: t("view_products", lang), callback_data: "view_products" }],
        [{ text: t("back_main", lang), callback_data: "back_main" }],
      ],
    },
  });
}

export async function handleLoginCode(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  try {
    const { data: botUser } = await supabase
      .from("telegram_bot_users")
      .select("username, first_name")
      .eq("telegram_id", userId)
      .maybeSingle();

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    await supabase.from("telegram_login_codes").insert({
      code,
      telegram_id: userId,
      username: botUser?.username || null,
      first_name: botUser?.first_name || null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    const websiteUrl = "https://cheapest-premiums.in";

    const text = lang === "bn"
      ? `🔐 <b>ওয়েবসাইট লগইন</b>\n\n📋 আপনার লগইন কোড:\n<code>${code}</code>\n(ট্যাপ করলে কপি হবে)\n\n⏰ কোডটি ৫ মিনিট সক্রিয় থাকবে।\n\n📖 <b>কিভাবে লগইন করবেন:</b>\n1️⃣ নিচের লিংকে ক্লিক করুন\n2️⃣ "Telegram Login" অপশনে ক্লিক করুন\n3️⃣ উপরের কোডটি পেস্ট করুন\n4️⃣ Login বাটনে ক্লিক করুন\n\n✅ আপনার ওয়ালেট, অর্ডার সব অটোমেটিক সিঙ্ক হয়ে যাবে!\n\n⚠️ এই কোড কাউকে শেয়ার করবেন না।`
      : `🔐 <b>Website Login</b>\n\n📋 Your login code:\n<code>${code}</code>\n(Tap to copy)\n\n⏰ Code is active for 5 minutes.\n\n📖 <b>How to login:</b>\n1️⃣ Click the link below\n2️⃣ Click "Telegram Login" option\n3️⃣ Paste the code above\n4️⃣ Click the Login button\n\n✅ Your wallet, orders will auto-sync!\n\n⚠️ Do not share this code with anyone.`;

    await sendMessage(token, chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "Open Website" : "Open Website", url: websiteUrl }],
          [{ text: t("back_main", lang), callback_data: "back_main" }],
        ],
      },
    });
  } catch (e) {
    console.error("Login code error:", e);
    const text = lang === "bn"
      ? `❌ কোড তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।`
      : `❌ Failed to generate code. Please try again.`;
    await sendMessage(token, chatId, text);
  }
}

export async function handleWalletDeposit(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const { handleDepositStart } = await import("../payment/deposit-handlers.ts");
  await handleDepositStart(token, supabase, chatId, userId, lang);
}

export async function handleWalletWithdraw(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  const wallet = await getWallet(supabase, userId);
  const balance = wallet?.balance || 0;

  if (balance < 50) {
    const text = lang === "bn"
      ? `❌ আপনার ব্যালেন্স অপর্যাপ্ত। কমপক্ষে ₹50 প্রয়োজন।\n\n💵 বর্তমান ব্যালেন্স: <b>₹${balance}</b>`
      : `❌ Insufficient balance. Minimum ₹50 required.\n\n💵 Current Balance: <b>₹${balance}</b>`;
    await sendMessage(token, chatId, text, {
      reply_markup: { inline_keyboard: [[{ text: t("back", lang), callback_data: "my_wallet" }]] },
    });
    return;
  }

  const { setConversationState } = await import("../db-helpers.ts");
  await setConversationState(supabase, userId, "withdraw_choose_method", {});

  const text = lang === "bn"
    ? `➖ <b>ওয়ালেট উইথড্র</b>\n\n💵 বর্তমান ব্যালেন্স: <b>₹${balance}</b>\n\n💳 পেমেন্ট পদ্ধতি বেছে নিন:`
    : `➖ <b>Wallet Withdrawal</b>\n\n💵 Current Balance: <b>₹${balance}</b>\n\n💳 Choose payment method:`;

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📱 UPI", callback_data: "withdraw_upi" },
          { text: "💎 Binance", callback_data: "withdraw_binance" },
        ],
        [{ text: t("back", lang), callback_data: "my_wallet" }],
      ],
    },
  });
}