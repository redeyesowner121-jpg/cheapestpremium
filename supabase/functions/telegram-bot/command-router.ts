// ===== COMMAND ROUTER =====
// Handles /command messages from Telegram users.

import { sendMessage } from "./telegram-api.ts";
import { t, RESALE_BOT_USERNAME } from "./constants.ts";
import {
  isAdminBot, checkChannelMembership, ensureWallet,
  getConversationState, setConversationState, notifyAllAdmins,
} from "./db-helpers.ts";
import {
  showLanguageSelection, showJoinChannels, showMainMenu,
  handleViewCategories, handleProductDetail,
  handleMyOrders, handleMyWallet, handleReferEarn, handleSupport,
  handleGetOffers, handleLoginCode,
  handleWalletDeposit, handleWalletWithdraw,
} from "./menu-handlers.ts";
import { handleResaleStart, handleStartWithRef } from "./resale-handlers.ts";
import { handleAdminMenu, handleAllUsers } from "./admin-handlers.ts";
import {
  handleGiveawayStart,
  showGiveawayMainMenu, showGiveawayReferralLink, showGiveawayStats,
  showGiveawayAdminMenu,
} from "./giveaway-handlers.ts";

type CmdCtx = {
  BOT_TOKEN: string;
  supabase: any;
  chatId: number;
  userId: number;
  telegramUser: any;
  text: string;
  parts: string[];
  command: string;
  lang: string;
  userData: any;
  isGiveaway: boolean;
  isChildMode: boolean;
};

export async function handleCommand(ctx: CmdCtx): Promise<void> {
  const {
    BOT_TOKEN, supabase, chatId, userId, telegramUser,
    parts, command, lang, userData, isGiveaway, isChildMode,
  } = ctx;

  switch (command) {
    case "/start": {
      const payload = parts[1] || "";

      if (isGiveaway) {
        await handleGiveawayStart(BOT_TOKEN, supabase, chatId, userId, telegramUser, payload, lang, userData);
        return;
      }

      // Child bot mode: skip resale redirect
      if (!isChildMode && payload.startsWith("ref_")) {
        await handleStartWithRef(BOT_TOKEN, supabase, userId, telegramUser, payload.replace("ref_", ""), lang);
      } else if (!isChildMode && payload.startsWith("buy_")) {
        const linkCode = payload.replace("buy_", "");
        const resaleUrl = `https://t.me/${RESALE_BOT_USERNAME}?start=buy_${linkCode}`;
        await sendMessage(BOT_TOKEN, chatId,
          lang === "bn"
            ? `🔒 এই রিসেল লিংক শুধুমাত্র রিসেলার বটে খোলে।\n\n👉 এখানে যান: <code>${resaleUrl}</code>`
            : `🔒 This resale link works only in the reseller bot.\n\n👉 Open here: <code>${resaleUrl}</code>`,
          { reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "🚀 রিসেলার বটে যান" : "🚀 Open Reseller Bot", url: resaleUrl }]] } }
        );
        return;
      } else if (payload.startsWith("ref_")) {
        await handleStartWithRef(BOT_TOKEN, supabase, userId, telegramUser, payload.replace("ref_", ""), lang);
      }

      if (!userData.language) { await showLanguageSelection(BOT_TOKEN, chatId); return; }

      // Don't interrupt active payment session
      const activeConvState = await getConversationState(supabase, userId);
      const paymentSteps = [
        "choose_payment_method", "wallet_pay_confirm", "binance_payment_pending",
        "binance_awaiting_screenshot", "razorpay_payment_pending", "choose_upi_method",
        "awaiting_quantity_choice", "awaiting_custom_quantity", "awaiting_screenshot",
        "deposit_binance_awaiting_screenshot", "deposit_razorpay_pending", "deposit_upi_pending",
        "deposit_enter_amount", "deposit_choose_method",
      ];
      if (activeConvState && paymentSteps.includes(activeConvState.step)) {
        await sendMessage(BOT_TOKEN, chatId,
          lang === "bn"
            ? "⚠️ তোমার একটি পেমেন্ট সেশন চলছে। বাতিল করতে /cancel পাঠাও।"
            : "⚠️ You have an active payment session. Send /cancel to abort it first."
        );
        return;
      }

      const [isUserAdmin, joined] = await Promise.all([
        isAdminBot(supabase, userId),
        checkChannelMembership(BOT_TOKEN, userId, supabase),
        ensureWallet(supabase, userId),
      ]);

      // Auto-create website account on /start
      try {
        const { resolveProfileUserId } = await import("../_shared/profile-id-resolver.ts");
        await resolveProfileUserId(supabase, userId);
      } catch (e) {
        console.error("Auto-create website profile on /start failed:", e);
      }

      if (!isUserAdmin && !joined) { await showJoinChannels(BOT_TOKEN, supabase, chatId, lang); return; }

      await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
      break;
    }
    case "/menu":
      if (isGiveaway) { await showGiveawayMainMenu(BOT_TOKEN, supabase, chatId, lang, userId); }
      else { await showMainMenu(BOT_TOKEN, supabase, chatId, lang); }
      break;
    case "/points":
    case "/balance":
      if (isGiveaway) {
        const gp = await supabase.from("giveaway_points").select("*").eq("telegram_id", userId).single();
        const pts = gp.data?.points || 0;
        const refs = gp.data?.total_referrals || 0;
        await sendMessage(BOT_TOKEN, chatId,
          `💰 <b>Points:</b> ${pts}\n👥 <b>Referrals:</b> ${refs}`, {
          reply_markup: { inline_keyboard: [[{ text: "📎 Referral Link", callback_data: "gw_referral" }]] }
        });
      }
      break;
    case "/products":
    case "/shop":
      await handleViewCategories(BOT_TOKEN, supabase, chatId, lang); break;
    case "/orders":
      await handleMyOrders(BOT_TOKEN, supabase, chatId, userId, lang); break;
    case "/wallet":
      await handleMyWallet(BOT_TOKEN, supabase, chatId, userId, lang); break;
    case "/deposit":
      await handleWalletDeposit(BOT_TOKEN, supabase, chatId, userId, lang); break;
    case "/withdraw":
      await handleWalletWithdraw(BOT_TOKEN, supabase, chatId, userId, lang); break;
    case "/support":
      await handleSupport(BOT_TOKEN, supabase, chatId, lang); break;
    case "/setemail":
    case "/email": {
      const { handleSetEmailCommand } = await import("./email-handler.ts");
      const inline = parts.slice(1).join(" ").trim();
      await handleSetEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang, inline);
      break;
    }
    case "/myemail": {
      const { handleMyEmailCommand } = await import("./email-handler.ts");
      await handleMyEmailCommand(BOT_TOKEN, supabase, chatId, userId, lang);
      break;
    }
    case "/help": {
      // Direct connect to admin (same flow as "Forward to Admin" button)
      await setConversationState(supabase, userId, "chatting_with_admin", {});
      const uname = telegramUser.username ? `@${telegramUser.username}` : (telegramUser.first_name || "User");
      await notifyAllAdmins(BOT_TOKEN, supabase,
        `📩 User ${uname} (<code>${userId}</code>) wants admin help.`,
        { reply_markup: { inline_keyboard: [[{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }]] } }
      );
      await sendMessage(BOT_TOKEN, chatId, lang === "bn"
        ? "✅ আপনি এখন সরাসরি অ্যাডমিনের সাথে চ্যাটে আছেন। আপনার মেসেজ লিখুন — শীঘ্রই উত্তর পাবেন।\n\n💬 চ্যাট শেষ করতে /endchat লিখুন।"
        : "✅ You are now directly connected to admin. Type your message — you'll get a reply soon.\n\n💬 Type /endchat to end the chat."
      );
      break;
    }
    case "/refer":
    case "/referral":
    case "/share":
      if (isGiveaway) { await showGiveawayReferralLink(BOT_TOKEN, supabase, chatId, userId, lang); }
      else { await handleReferEarn(BOT_TOKEN, supabase, chatId, userId, lang); }
      break;
    case "/offers":
      await handleGetOffers(BOT_TOKEN, supabase, chatId, lang); break;
    case "/login":
      if (isChildMode) {
        await sendMessage(BOT_TOKEN, chatId, "❌ This command is not available.");
      } else {
        await handleLoginCode(BOT_TOKEN, supabase, chatId, userId, lang);
      }
      break;
    case "/redeem": {
      if (isGiveaway) break;
      const { handleRedeemCommand } = await import("./redeem-handler.ts");
      const inlineCode = parts.slice(1).join(" ").trim();
      await handleRedeemCommand(BOT_TOKEN, supabase, chatId, userId, lang, inlineCode);
      break;
    }
    case "/apply": {
      if (isGiveaway || isChildMode) break;
      const { handleApplyCommand } = await import("./apply-handler.ts");
      await handleApplyCommand(BOT_TOKEN, supabase, chatId, userId, lang);
      break;
    }
    case "/send": {
      if (isGiveaway) break;
      const { handleSendCommand } = await import("./send-handler.ts");
      await handleSendCommand(BOT_TOKEN, supabase, chatId, userId, lang);
      break;
    }
    case "/escrow": {
      if (isGiveaway || isChildMode) break;
      await sendMessage(BOT_TOKEN, chatId,
        lang === "bn"
          ? `🔒 <b>Escrow বটে এভেইলেবল নয়</b>\n\nএস্ক্রো ডিল এখন শুধুমাত্র আমাদের ওয়েবসাইটে পাওয়া যাচ্ছে। নিচের বাটনে ক্লিক করে ওয়েবসাইটে লগইন করুন — আপনার সমস্ত ডাটা (ওয়ালেট ব্যালেন্স, অর্ডার, ইত্যাদি) স্বয়ংক্রিয়ভাবে সিঙ্ক হয়ে যাবে।`
          : `🔒 <b>Escrow not available in bot</b>\n\nEscrow deals are available only on our website. Tap the button below to log in — all your data (wallet balance, orders, etc.) will sync automatically.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "bn" ? "🌐 Website Login" : "🌐 Website Login", callback_data: "website_login", style: "primary" }],
            ],
          },
        }
      );
      break;
    }
    case "/users": {
      if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
      await handleAllUsers(BOT_TOKEN, supabase, chatId, 0); break;
    }
    case "/stats": {
      if (isGiveaway) {
        await showGiveawayStats(BOT_TOKEN, supabase, chatId, userId, lang);
      } else {
        const { data: wallet } = await supabase.from("telegram_wallets").select("balance, total_earned, is_reseller, referral_code").eq("telegram_id", userId).single();
        const { count: orderCount } = await supabase.from("telegram_orders").select("id", { count: "exact", head: true }).eq("telegram_user_id", userId);
        const { count: referralCount } = await supabase.from("telegram_wallets").select("id", { count: "exact", head: true }).eq("referred_by", userId);
        const bal = wallet?.balance || 0;
        const earned = wallet?.total_earned || 0;
        const refCode = wallet?.referral_code || "N/A";
        const isReseller = wallet?.is_reseller ? "✅" : "❌";
        const statsText = lang === "bn"
          ? `📊 <b>আপনার পরিসংখ্যান</b>\n\n💰 ব্যালেন্স: <b>₹${bal}</b>\n💵 মোট আয়: <b>₹${earned}</b>\n📦 মোট অর্ডার: <b>${orderCount || 0}</b>\n👥 রেফারেল: <b>${referralCount || 0}</b>\n🏷️ রেফারেল কোড: <code>${refCode}</code>\n🔄 রিসেলার: ${isReseller}`
          : `📊 <b>Your Stats</b>\n\n💰 Balance: <b>₹${bal}</b>\n💵 Total Earned: <b>₹${earned}</b>\n📦 Total Orders: <b>${orderCount || 0}</b>\n👥 Referrals: <b>${referralCount || 0}</b>\n🏷️ Referral Code: <code>${refCode}</code>\n🔄 Reseller: ${isReseller}`;
        await sendMessage(BOT_TOKEN, chatId, statsText, {
          reply_markup: { inline_keyboard: [[{ text: lang === "bn" ? "মূল মেনু" : "Main Menu", callback_data: "back_main" }]] }
        });
      }
      break;
    }
    case "/admin":
      if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
      if (isGiveaway) {
        await showGiveawayAdminMenu(BOT_TOKEN, supabase, chatId);
      } else {
        await handleAdminMenu(BOT_TOKEN, supabase, chatId, userId);
      }
      break;
    case "/chat": {
      if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
      const targetId = parseInt(parts[1]);
      if (!targetId) {
        await sendMessage(BOT_TOKEN, chatId, "⚠️ Usage: <code>/chat {user_id}</code>\n\nExample: <code>/chat 123456789</code>");
        break;
      }
      await setConversationState(supabase, userId, "admin_reply", { targetUserId: targetId });
      await sendMessage(BOT_TOKEN, chatId,
        `💬 <b>Chat Mode</b>\n\nYou are now chatting with user <code>${targetId}</code>.\n\nType your message or send a photo.\nSend /endchat to stop.`
      );
      break;
    }
    case "/broadcast":
      if (!await isAdminBot(supabase, userId)) { await sendMessage(BOT_TOKEN, chatId, t("access_denied", lang)); break; }
      await setConversationState(supabase, userId, "broadcast_message", {});
      await sendMessage(BOT_TOKEN, chatId, "📢 <b>Broadcast Mode</b>\n\nSend the message (text/photo) to broadcast.\nSend /cancel to cancel."); break;
    default: {
      const searchTerm = command.replace("/", "").trim();
      if (searchTerm.length >= 2) {
        const { data: matchedProducts } = await supabase
          .from("products")
          .select("id, name")
          .eq("is_active", true)
          .ilike("name", `%${searchTerm}%`)
          .limit(10);

        if (matchedProducts && matchedProducts.length === 1) {
          await handleProductDetail(BOT_TOKEN, supabase, chatId, matchedProducts[0].id, lang, userId);
        } else if (matchedProducts && matchedProducts.length > 1) {
          let searchText = lang === "bn"
            ? `🔍 <b>"${searchTerm}" এর জন্য ${matchedProducts.length}টি পণ্য পাওয়া গেছে:</b>\n\n`
            : `🔍 <b>Found ${matchedProducts.length} products for "${searchTerm}":</b>\n\n`;
          const buttons = matchedProducts.map((p: any) => [{ text: p.name, callback_data: `product_${p.id}` }]);
          buttons.push([{ text: `🔴 ${t("back_main", lang)}`, callback_data: isGiveaway ? "gw_main" : "back_main" }]);
          await sendMessage(BOT_TOKEN, chatId, searchText, { reply_markup: { inline_keyboard: buttons } });
        } else {
          await sendMessage(BOT_TOKEN, chatId,
            lang === "bn" ? `❌ "/${searchTerm}" নামে কোনো পণ্য পাওয়া যায়নি।` : `❌ No product found matching "/${searchTerm}".`
          );
        }
      }
      break;
    }
  }
}
