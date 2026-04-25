// ===== MENU NAVIGATION (Language, Join, Main Menu, Support) =====

import { T, t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { getRequiredChannels, getSettings } from "../db-helpers.ts";
import { pe } from "../premium-emoji.ts";

export async function showLanguageSelection(token: string, chatId: number) {
  await sendMessage(token, chatId, `${pe("globe", "🌐")} <b>Choose Your Language / ভাষা নির্বাচন করুন</b>`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "English", callback_data: "lang_en", style: "primary" },
          { text: "বাংলা", callback_data: "lang_bn", style: "success" },
        ],
      ],
    },
  });
}

export async function showJoinChannels(token: string, supabase: any, chatId: number, lang: string) {
  const channels = await getRequiredChannels(supabase);
  const buttons: any[][] = channels.map((ch: string) => {
    const name = ch.startsWith("@") ? ch : `@${ch}`;
    return [{ text: `Join ${name}`, url: `https://t.me/${name.replace("@", "")}`, style: "primary" }];
  });
  buttons.push([{ text: lang === "bn" ? `${pe("check_green", "✅")} যাচাই করুন` : `${pe("check_green", "✅")} Verify`, callback_data: "verify_join", style: "success" }]);

  await sendMessage(token, chatId, t("join_channels", lang), {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function showMainMenu(token: string, supabase: any, chatId: number, lang: string) {
  const settings = await getSettings(supabase);
  const storeName = settings.app_name || "RKR Premium Store";

  const { isChildBotMode } = await import("../child-context.ts");
  const isChild = isChildBotMode();

  const welcomeText = lang === "bn"
    ? `${pe("shopping_bag", "🛍️")} <b>${storeName}-এ স্বাগতম!</b>\n\n${pe("sparkles", "✨")} সবচেয়ে কম দামে প্রিমিয়াম ডিজিটাল পণ্য\n${pe("lightning", "⚡")} তাৎক্ষণিক ডেলিভারি\n${pe("lock", "🔒")} নিরাপদ পেমেন্ট\n${pe("chat", "💬")} ২৪/৭ সাপোর্ট\n\nনিচে একটি অপশন বেছে নিন:`
    : `${pe("shopping_bag", "🛍️")} <b>Welcome to ${storeName}!</b>\n\n${pe("sparkles", "✨")} Premium digital products at the cheapest prices\n${pe("lightning", "⚡")} Instant delivery\n${pe("lock", "🔒")} Secure payments\n${pe("chat", "💬")} 24/7 Support\n\nChoose an option below:`;

  const buttons: any[][] = [
    [{ text: `🛍️ ${t("view_products", lang)}`, callback_data: "view_products", style: "primary" }],
    [
      { text: `📦 ${t("my_orders", lang)}`, callback_data: "my_orders", style: "success" },
      { text: `💰 ${t("my_wallet", lang)}`, callback_data: "my_wallet", style: "success" },
    ],
    [
      { text: `🎁 ${t("refer_earn", lang)}`, callback_data: "refer_earn", style: "primary" },
    ],
    [
      { text: lang === "bn" ? "⭐ রিভিউ" : "⭐ Reviews", callback_data: "show_reviews", style: "success" },
      { text: `📞 ${t("support", lang)}`, callback_data: "support", style: "danger" },
    ],
  ];

  if (!isChild) {
    buttons.push([
      { text: "🌐 Website Login", callback_data: "website_login", style: "primary" },
      { text: lang === "bn" ? "📧 ইমেইল" : "📧 Email", callback_data: "my_email", style: "primary" },
    ]);
  }

  if (isChild) {
    buttons.push([{ text: "🤖 Make My Own Bot", url: "https://t.me/Botmother_selling_bot" }]);
  }

  await sendMessage(token, chatId, welcomeText, {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function handleSupport(token: string, supabase: any, chatId: number, lang: string) {
  const settings = await getSettings(supabase);
  const supportNumber = settings.support_contact || "+201556690444";

  await sendMessage(token, chatId,
    lang === "bn"
      ? `${pe("phone", "📞")} <b>সাপোর্ট</b>\n\nযেকোনো সমস্যায় নিচের মাধ্যমে যোগাযোগ করুন:\n\n📱 WhatsApp: ${supportNumber}\n${pe("airplane", "✈️")} Telegram: ${supportNumber}\n\nঅথবা নিচের বাটনে ক্লিক করুন:`
      : `${pe("phone", "📞")} <b>Support</b>\n\nContact us for any issues:\n\n📱 WhatsApp: ${supportNumber}\n${pe("airplane", "✈️")} Telegram: ${supportNumber}\n\nOr click a button below:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 WhatsApp", url: `https://wa.me/${supportNumber.replace("+", "")}`, style: "success" }],
          [{ text: "✈️ Telegram", url: `https://t.me/${supportNumber}`, style: "primary" }],
          [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin", style: "danger" }],
          [{ text: `🔴 ⬅️ ${t("back_main", lang)}`, callback_data: "back_main", color: "red" }],
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
    `${pe("camera", "📸")} <b>Photo from</b> ${username} (<code>${telegramUser.id}</code>)`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 Chat", callback_data: `admin_chat_${telegramUser.id}`, style: "primary" }],
        ],
      },
    }
  );

  await sendMessage(token, msg.chat.id,
    lang === "bn"
      ? `${pe("check_green", "✅")} আপনার মেসেজ অ্যাডমিনের কাছে ফরোয়ার্ড করা হয়েছে।`
      : `${pe("check_green", "✅")} Your message has been forwarded to admin.`
  );
}
