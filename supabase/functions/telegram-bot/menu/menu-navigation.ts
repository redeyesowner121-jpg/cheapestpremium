// ===== MENU NAVIGATION (Language, Join, Main Menu, Support) =====

import { T, t, BOT_USERNAME } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getSettings, ensureWallet, getRequiredChannels } from "../db-helpers.ts";

export async function showLanguageSelection(token: string, chatId: number) {
  await sendMessage(token, chatId, T.choose_lang.en, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: "lang_en" },
          { text: "🇧🇩 বাংলা", callback_data: "lang_bn" },
        ],
      ],
    },
  });
}

export async function showJoinChannels(token: string, supabase: any, chatId: number, lang: string) {
  const channels = await getRequiredChannels(supabase);
  const buttons: any[][] = channels.map((ch: string) => {
    const name = ch.startsWith("@") ? ch : `@${ch}`;
    return [{ text: `📢 Join ${name}`, url: `https://t.me/${name.replace("@", "")}` }];
  });
  buttons.push([{ text: "✅ I've Joined - Verify", callback_data: "verify_join" }]);

  await sendMessage(token, chatId, t("join_channels", lang), {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function showMainMenu(token: string, supabase: any, chatId: number, lang: string) {
  const settings = await getSettings(supabase);
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  await sendMessage(token, chatId, t("welcome", lang), {
    reply_markup: {
      inline_keyboard: [
        [{ text: t("view_products", lang), callback_data: "view_products" }],
        [
          { text: t("my_orders", lang), callback_data: "my_orders" },
          { text: t("my_wallet", lang), callback_data: "my_wallet" },
        ],
        [
          { text: t("refer_earn", lang), callback_data: "refer_earn" },
        ],
        [
          { text: `⭐ ${lang === "bn" ? "রিভিউ" : "Reviews"} ↗`, url: "https://t.me/RKRxProofs" },
          { text: t("support", lang), callback_data: "support" },
        ],
        [{ text: t("get_offers", lang), callback_data: "get_offers" }],
      ],
    },
  });
}

export async function handleSupport(token: string, supabase: any, chatId: number, lang: string) {
  const supportNumber = "+201556690444";

  await sendMessage(token, chatId,
    lang === "bn"
      ? `📞 <b>সাপোর্ট</b>\n\nযেকোনো সমস্যায় নিচের মাধ্যমে যোগাযোগ করুন:\n\n📱 WhatsApp: ${supportNumber}\n📱 Telegram: ${supportNumber}\n\nঅথবা নিচের বাটনে ক্লিক করুন:`
      : `📞 <b>Support</b>\n\nContact us for any issues:\n\n📱 WhatsApp: ${supportNumber}\n📱 Telegram: ${supportNumber}\n\nOr click a button below:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 WhatsApp", url: `https://wa.me/${supportNumber.replace("+", "")}` }],
          [{ text: "📱 Telegram", url: `https://t.me/${supportNumber}` }],
          [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin" }],
          [{ text: t("back_main", lang), callback_data: "back_main" }],
        ],
      },
    }
  );
}

export async function forwardUserMessageToAdmin(token: string, supabase: any, msg: any, telegramUser: any, lang: string) {
  const { forwardToAllAdmins, notifyAllAdmins } = await import("../db-helpers.ts");
  const username = telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name || "Unknown";

  await forwardToAllAdmins(token, supabase, msg.chat.id, msg.message_id);
  await notifyAllAdmins(token, supabase,
    `📸 <b>Photo from</b> ${username} (<code>${telegramUser.id}</code>)`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 Chat", callback_data: `admin_chat_${telegramUser.id}` }],
        ],
      },
    }
  );

  await sendMessage(token, msg.chat.id,
    lang === "bn"
      ? "✅ আপনার মেসেজ অ্যাডমিনের কাছে ফরোয়ার্ড করা হয়েছে।"
      : "✅ Your message has been forwarded to admin."
  );
}
