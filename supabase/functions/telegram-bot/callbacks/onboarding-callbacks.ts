// ===== Onboarding & language selection callbacks =====
import { t } from "../constants.ts";
import { sendMessage } from "../telegram-api.ts";
import { setUserLang, ensureWallet, checkChannelMembership, setConversationState, notifyAllAdmins } from "../db-helpers.ts";
import { showJoinChannels, showMainMenu } from "../menu-handlers.ts";

export async function handleOnboardingCallbacks(
  BOT_TOKEN: string, supabase: any, chatId: number, userId: number, data: string, telegramUser: any, lang: string
): Promise<boolean> {
  if (data === "lang_en" || data === "lang_bn") {
    const selectedLang = data === "lang_en" ? "en" : "bn";
    await setUserLang(supabase, userId, selectedLang);
    await sendMessage(BOT_TOKEN, chatId, t("lang_saved", selectedLang));
    const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
    if (!joined) {
      await showJoinChannels(BOT_TOKEN, supabase, chatId, selectedLang);
    } else {
      await ensureWallet(supabase, userId);
      try {
        const { resolveProfileUserId } = await import("../../_shared/profile-id-resolver.ts");
        await resolveProfileUserId(supabase, userId);
      } catch (e) {
        console.error("Auto-create website profile failed:", e);
      }
      await showMainMenu(BOT_TOKEN, supabase, chatId, selectedLang);
    }
    return true;
  }

  if (data === "verify_join") {
    const joined = await checkChannelMembership(BOT_TOKEN, userId, supabase);
    if (!joined) {
      await sendMessage(BOT_TOKEN, chatId, t("not_joined", lang));
    } else {
      await sendMessage(BOT_TOKEN, chatId, t("verified", lang));
      await ensureWallet(supabase, userId);
      try {
        const { resolveProfileUserId } = await import("../../_shared/profile-id-resolver.ts");
        await resolveProfileUserId(supabase, userId);
      } catch (e) {
        console.error("Auto-create website profile failed:", e);
      }
      await showMainMenu(BOT_TOKEN, supabase, chatId, lang);
    }
    return true;
  }

  if (data === "forward_to_admin") {
    await setConversationState(supabase, userId, "chatting_with_admin", {});
    await notifyAllAdmins(BOT_TOKEN, supabase,
      `📩 User @${telegramUser.username || telegramUser.first_name} (${userId}) wants admin help.`,
      { reply_markup: { inline_keyboard: [[{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }]] } }
    );
    await sendMessage(BOT_TOKEN, chatId, lang === "bn"
      ? "✅ আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন।\n\n💬 এখন আপনি সরাসরি মেসেজ পাঠাতে পারেন। চ্যাট শেষ করতে /endchat লিখুন।"
      : "✅ Your question has been forwarded to admin. You'll get a reply soon.\n\n💬 You can now send messages directly. Type /endchat to end chat."
    );
    return true;
  }

  return false;
}
