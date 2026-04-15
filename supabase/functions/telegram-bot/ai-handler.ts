// ===== AI QUERY HANDLER (Streaming + Cross-Platform) =====

import { t } from "./constants.ts";
import { sendMessage, sendMessageWithId, editMessageText, sendChatAction } from "./telegram-api.ts";
import { setConversationState, notifyAllAdmins } from "./db-helpers.ts";
import { parseSSEStream, splitMessage } from "./ai/stream-utils.ts";
import { buildAIContext, buildSystemPrompt } from "./ai/prompt-builder.ts";

export async function handleAIQuery(token: string, supabase: any, chatId: number, userId: number, question: string, lang: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    await sendMessage(token, chatId, lang === "bn" ? "AI সাময়িকভাবে অনুপলব্ধ।" : "AI is temporarily unavailable.");
    return;
  }

  const ctx = await buildAIContext(supabase, userId);
  const systemPrompt = buildSystemPrompt(ctx);

  try {
    await sendChatAction(token, chatId, "typing");
    const thinkingMsgId = await sendMessageWithId(token, chatId, lang === "bn" ? "🤖 চিন্তা করছি..." : "🤖 Thinking...");

    const { data: historyRows } = await supabase
      .from("telegram_ai_messages").select("role, content")
      .eq("telegram_id", userId).order("created_at", { ascending: false }).limit(10);

    const historyMessages = (historyRows || []).reverse().map((m: any) => ({ role: m.role as string, content: m.content as string }));

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: question },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, stream: true }),
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);

    let fullAnswer = "";
    const typingInterval = setInterval(() => { sendChatAction(token, chatId, "typing"); }, 4000);

    try {
      for await (const chunk of parseSSEStream(response)) { fullAnswer += chunk; }
    } finally { clearInterval(typingInterval); }

    const answer = fullAnswer.trim();

    if (thinkingMsgId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: thinkingMsgId }),
        });
      } catch {}
    }

    await supabase.from("telegram_ai_messages").insert([
      { telegram_id: userId, role: "user", content: question },
      ...(answer ? [{ telegram_id: userId, role: "assistant", content: answer }] : []),
    ]);

    // Clean old messages (keep last 20)
    const { data: oldMessages } = await supabase
      .from("telegram_ai_messages").select("id").eq("telegram_id", userId)
      .order("created_at", { ascending: false }).range(20, 1000);
    if (oldMessages?.length) {
      await supabase.from("telegram_ai_messages").delete().in("id", oldMessages.map((m: any) => m.id));
    }

    const shouldForward = !answer || answer.startsWith("[FORWARD_TO_ADMIN]");

    if (shouldForward) {
      const cleanAnswer = answer?.replace("[FORWARD_TO_ADMIN]", "").trim();
      await setConversationState(supabase, userId, "awaiting_admin_answer", { originalQuestion: question, questionLang: lang });

      await notifyAllAdmins(token, supabase,
        `🤖❓ <b>AI couldn't answer</b>\n\n👤 User: <code>${userId}</code>\n💬 Question: <b>${question}</b>\n\n📝 Reply to teach AI this answer. Click "Answer" below:`,
        { reply_markup: { inline_keyboard: [
          [{ text: "📝 Answer & Teach AI", callback_data: `ai_teach_${userId}` }],
          [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
        ]}}
      );

      const forwardMsg = cleanAnswer || (lang === "bn"
        ? "🤔 আমি এই প্রশ্নের উত্তর দিতে পারছি না। আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হচ্ছে। শীঘ্রই উত্তর পাবেন! ⏳"
        : "🤔 I'm not sure about this. Your question has been forwarded to admin. You'll get a reply soon! ⏳");

      await sendMessage(token, chatId, forwardMsg, {
        reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] }
      });
    } else {
      const messageParts = splitMessage(answer);
      const actionButtons = {
        inline_keyboard: [
          [{ text: lang === "bn" ? "প্রোডাক্ট দেখুন" : "View Products", callback_data: "view_products" }],
          [{ text: lang === "bn" ? "অ্যাডমিনকে জিজ্ঞাসা করুন" : "Ask Admin", callback_data: "forward_to_admin" }],
          [{ text: t("back_main", lang), callback_data: "back_main" }],
        ],
      };

      for (let i = 0; i < messageParts.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 400));
        const isFirst = i === 0;
        const isLast = i === messageParts.length - 1;
        const text = isFirst ? `🤖 ${messageParts[i]}` : messageParts[i];
        await sendMessage(token, chatId, text, isLast ? { reply_markup: actionButtons } : undefined);
      }
    }
  } catch (error) {
    console.error("AI query error:", error);
    await notifyAllAdmins(token, supabase,
      `🤖❌ <b>AI Error - Question forwarded</b>\n\n👤 User: <code>${userId}</code>\n💬 Question: <b>${question}</b>`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📝 Answer & Teach AI", callback_data: `ai_teach_${userId}` }],
        [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
      ]}}
    );
    await sendMessage(token, chatId,
      lang === "bn"
        ? "🤔 আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন! ⏳"
        : "🤔 Your question has been forwarded to admin. You'll get a reply soon! ⏳",
      { reply_markup: { inline_keyboard: [[{ text: t("back_main", lang), callback_data: "back_main" }]] } }
    );
  }
}
