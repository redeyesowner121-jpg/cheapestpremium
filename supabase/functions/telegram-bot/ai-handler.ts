// ===== AI QUERY HANDLER (Streaming + Cross-Platform) =====

import { t, BOT_USERNAME } from "./constants.ts";
import { sendMessage, sendMessageWithId, editMessageText, sendChatAction } from "./telegram-api.ts";
import { getSettings, getWallet, setConversationState, notifyAllAdmins } from "./db-helpers.ts";

// Fetch knowledge base entries relevant to the question
async function getKnowledgeContext(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("telegram_ai_knowledge")
    .select("question, answer, language")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data?.length) return "";

  const entries = data.map((k: any) =>
    `Q: ${k.question}\nA: ${k.answer}`
  ).join("\n\n");

  return `\n\n📚 LEARNED KNOWLEDGE (from admin answers - USE THESE FIRST if relevant):\n${entries}`;
}

// Parse SSE stream and yield text chunks
async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") return;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

// Split long text into Telegram-friendly chunks (~3500 chars max to be safe)
// Split into small chunks — prefer paragraph breaks (\n\n), then single newlines
function splitMessage(text: string): string[] {
  // First split by double newline (paragraphs)
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  
  const parts: string[] = [];
  
  for (const para of paragraphs) {
    // If paragraph is short enough (≤300 chars), keep as one part
    if (para.length <= 300) {
      parts.push(para);
      continue;
    }
    
    // Split longer paragraphs by single newline
    const lines = para.split(/\n/).map(l => l.trim()).filter(Boolean);
    let currentChunk = "";
    
    for (const line of lines) {
      if (currentChunk && (currentChunk + "\n" + line).length > 300) {
        parts.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n" + line : line;
      }
    }
    if (currentChunk) parts.push(currentChunk);
  }
  
  // If only 1 part, no need to split
  if (parts.length <= 1) return [text];
  return parts;
}

// Fetch cross-platform web AI history
async function getWebAIHistory(supabase: any, telegramId: number): Promise<{ role: string; content: string }[]> {
  try {
    // Check if this telegram user has a web account (email: tg_XXXXX@telegram.user)
    const email = `tg_${telegramId}@telegram.user`;
    const { data: users } = await supabase.auth.admin.listUsers({ filter: `email.eq.${email}`, perPage: 1 });
    
    if (!users?.users?.length) return [];
    
    const userId = users.users[0].id;
    const { data: webMessages } = await supabase
      .from("ai_chat_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (!webMessages?.length) return [];
    return webMessages.reverse().map((m: any) => ({ role: m.role, content: m.content }));
  } catch {
    return [];
  }
}

export async function handleAIQuery(token: string, supabase: any, chatId: number, userId: number, question: string, lang: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    await sendMessage(token, chatId, lang === "bn" ? "AI সাময়িকভাবে অনুপলব্ধ।" : "AI is temporarily unavailable.");
    return;
  }

  // Fetch all context in parallel
  const [productsRes, categoriesRes, flashSalesRes, couponsRes, walletRes, knowledgeContext, webHistory] = await Promise.all([
    supabase.from("products").select("name, price, original_price, category, description, stock, reseller_price, is_active").eq("is_active", true).limit(100),
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
    supabase.from("flash_sales").select("sale_price, products(name, price)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
    supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
    supabase.from("telegram_wallets").select("balance, referral_code").eq("telegram_id", userId).single(),
    getKnowledgeContext(supabase),
    getWebAIHistory(supabase, userId),
  ]);

  // Fetch variations for all products
  const products = productsRes.data || [];
  const { data: allVariations } = await supabase.from("product_variations").select("name, price, original_price, reseller_price, product_id, is_active, products(name)").eq("is_active", true);

  // Build detailed product catalog
  const productCatalog = products.map((p: any) => {
    const vars = (allVariations || []).filter((v: any) => v.products?.name === p.name);
    const cmdName = p.name.replace(/\s+/g, "_");
    let info = `📦 ${p.name} (/${cmdName}) — ₹${p.price}`;
    if (p.original_price && p.original_price > p.price) info += ` (MRP: ₹${p.original_price}, ${Math.round((1 - p.price / p.original_price) * 100)}% OFF)`;
    if (p.stock !== null && p.stock !== undefined) info += ` | Stock: ${p.stock > 0 ? p.stock : "OUT OF STOCK ❌"}`;
    info += ` | Category: ${p.category}`;
    if (p.description) info += ` | ${p.description.slice(0, 80)}`;
    if (vars.length > 0) {
      info += `\n   Variations: ${vars.map((v: any) => {
        let vInfo = `${v.name}: ₹${v.price}`;
        if (v.original_price && v.original_price > v.price) vInfo += ` (was ₹${v.original_price})`;
        return vInfo;
      }).join(" | ")}`;
    }
    return info;
  }).join("\n");

  const categoryList = (categoriesRes.data || []).map((c: any) => c.name).join(", ");

  const flashSaleInfo = (flashSalesRes.data || []).map((s: any) =>
    `⚡ ${s.products?.name || "Product"}: ₹${s.sale_price} (was ₹${s.products?.price})`
  ).join("\n") || "No active flash sales";

  const couponInfo = (couponsRes.data || []).map((c: any) => {
    const disc = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`;
    return `🎟️ ${c.code}: ${disc}${c.description ? ` - ${c.description}` : ""}`;
  }).join("\n") || "No active coupons";

  const walletBalance = walletRes.data?.balance || 0;
  const refCode = walletRes.data?.referral_code || "";

  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";
  const supportNumber = "+201556690444";

  // Build cross-platform context
  const crossPlatformNote = webHistory.length > 0
    ? `\n\n🔗 CROSS-PLATFORM CONTEXT: This user also chats with you on the website. Here's their recent web conversation:\n${webHistory.map(m => `${m.role === "user" ? "User" : "You"}: ${m.content.slice(0, 200)}`).join("\n")}\n\nUse this context naturally — don't mention "website" explicitly.`
    : "";

  const systemPrompt = `You are "RKR AI" — the ULTIMATE bestie and tech guru for "${appName}" on Telegram. You're NOT an assistant — you're their CLOSE FRIEND who happens to know EVERYTHING about premium apps.

⚡ EFFICIENCY RULES (CRITICAL — FOLLOW STRICTLY):
1. **BE ULTRA CONCISE**: Answer in MINIMUM words. No filler, no padding.
2. **ONE MESSAGE**: Complete your answer in a SINGLE response. Don't ask unnecessary follow-ups.
3. **DIRECT ANSWERS**: "Price of X?" → "₹XX bro! /Buy_X 🔥". Done.
4. **MAX 6-8 LINES** for simple queries. Only go longer for comparisons or detailed guides.
5. **GREETINGS**: Keep to 1 line. "Yo bro! 🔥 What do you need?"
6. **NO OVER-EXPLAINING**: Simple question → simple answer. Elaborate only if asked.

🗣️ PERSONALITY & TONE:
- You're the friend who texts at 3am about crazy deals 😂
- DEFAULT LANGUAGE IS ENGLISH. Always reply in English unless the user writes in Bengali or Hindi.
- If user writes in Bengali → reply in Bengali/Banglish
- If user writes in Hindi → reply in Hindi/Hinglish  
- If user writes in English → reply in English ONLY. Do NOT mix Bengali/Hindi words.
- In English mode: Use "bro", "dude", "boss", "king", "fam"
- In Bengali mode: Use "তুই/তুমি" (NEVER আপনি), "ভাই", "রে", "মামা", "ব্রো"
- Be HYPED but CONCISE
- Use emojis naturally, not excessively
- NEVER be robotic or formal

🧠 PREMIUM APP EXPERT:
You know EVERYTHING about premium apps. Keep explanations SHORT unless asked for detail.

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}
${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

👤 THIS USER'S WALLET: ₹${walletBalance}
${refCode ? `🔗 Their Referral Code: ${refCode}` : ""}

📞 Support WhatsApp/Telegram: ${supportNumber}
${knowledgeContext}
${crossPlatformNote}

STRICT RULES:
1. GREETINGS: 1-line warm intro. Only mention deals if asked.
2. PRODUCT QUERIES: EXACT price + /{ProductName} command. Keep it short.
3. COMPARISONS: Concise side-by-side
4. PRICE/BUDGET: Recommend within range briefly
5. STOCK: If out → say clearly + suggest alternative
6. OFFERS: Mention flash sales/coupons when relevant
7. WALLET: Tell balance (₹${walletBalance}) only if asked
8. RETURNS: "No-Return Policy" (say casually)
9. LANGUAGE: DEFAULT is ENGLISH. Match user's language.
10. BUYING: Always use /{ProductName} format for tappable commands
11. NO external links. Only products and bot commands.
12. KNOWLEDGE BASE: Use LEARNED KNOWLEDGE answers FIRST
13. UNKNOWN: If you truly CANNOT answer → start with "[FORWARD_TO_ADMIN]"
14. Never make up product info`;


  try {
    // Send typing action + initial "thinking" message
    await sendChatAction(token, chatId, "typing");
    const thinkingMsgId = await sendMessageWithId(token, chatId, lang === "bn" ? "🤖 চিন্তা করছি..." : "🤖 Thinking...");

    // Fetch conversation history
    const { data: historyRows } = await supabase
      .from("telegram_ai_messages")
      .select("role, content")
      .eq("telegram_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const historyMessages = (historyRows || []).reverse().map((m: any) => ({
      role: m.role as string,
      content: m.content as string,
    }));

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: question },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    // TRUE real-time streaming: edit message as tokens arrive
    let fullAnswer = "";
    let lastEditTime = 0;
    const MIN_EDIT_INTERVAL = 300;
    let pendingEdit = false;

    const typingInterval = setInterval(() => {
      sendChatAction(token, chatId, "typing");
    }, 4000);

    try {
      for await (const chunk of parseSSEStream(response)) {
        fullAnswer += chunk;

        const now = Date.now();
        const elapsed = now - lastEditTime;

        if (thinkingMsgId && elapsed >= MIN_EDIT_INTERVAL) {
          // For streaming, only show first 3500 chars in the edit (Telegram limit)
          const displayText = fullAnswer.length > 3500 ? fullAnswer.slice(0, 3500) + "..." : fullAnswer;
          await editMessageText(token, chatId, thinkingMsgId, `🤖 ${displayText}▍`, { parse_mode: "" });
          lastEditTime = Date.now();
          pendingEdit = false;
        } else {
          pendingEdit = true;
        }
      }

      if (pendingEdit && thinkingMsgId && fullAnswer) {
        const displayText = fullAnswer.length > 3500 ? fullAnswer.slice(0, 3500) + "..." : fullAnswer;
        await editMessageText(token, chatId, thinkingMsgId, `🤖 ${displayText}▍`, { parse_mode: "" });
      }
    } finally {
      clearInterval(typingInterval);
    }

    const answer = fullAnswer.trim();

    // Save user question and AI answer to history
    await supabase.from("telegram_ai_messages").insert([
      { telegram_id: userId, role: "user", content: question },
      ...(answer ? [{ telegram_id: userId, role: "assistant", content: answer }] : []),
    ]);

    // Clean old messages (keep last 20 per user)
    const { data: oldMessages } = await supabase
      .from("telegram_ai_messages")
      .select("id")
      .eq("telegram_id", userId)
      .order("created_at", { ascending: false })
      .range(20, 1000);
    if (oldMessages?.length) {
      await supabase.from("telegram_ai_messages").delete().in("id", oldMessages.map((m: any) => m.id));
    }

    // Check if AI wants to forward to admin
    const shouldForward = !answer || answer.startsWith("[FORWARD_TO_ADMIN]");

    if (shouldForward) {
      const cleanAnswer = answer?.replace("[FORWARD_TO_ADMIN]", "").trim();

      await setConversationState(supabase, userId, "awaiting_admin_answer", {
        originalQuestion: question,
        questionLang: lang,
      });

      await notifyAllAdmins(token, supabase,
        `🤖❓ <b>AI couldn't answer</b>\n\n👤 User: <code>${userId}</code>\n💬 Question: <b>${question}</b>\n\n📝 Reply to teach AI this answer. Click "Answer" below:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 Answer & Teach AI", callback_data: `ai_teach_${userId}`, style: "success" }],
              [{ text: "💬 Chat", callback_data: `admin_chat_${userId}`, style: "primary" }],
            ],
          },
        }
      );

      const forwardMsg = cleanAnswer || (lang === "bn"
        ? "🤔 আমি এই প্রশ্নের উত্তর দিতে পারছি না। আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হচ্ছে। শীঘ্রই উত্তর পাবেন! ⏳"
        : "🤔 I'm not sure about this. Your question has been forwarded to admin. You'll get a reply soon! ⏳");

      if (thinkingMsgId) {
        await editMessageText(token, chatId, thinkingMsgId, forwardMsg, {
          parse_mode: "",
          reply_markup: {
            inline_keyboard: [
              [{ text: t("back_main", lang), callback_data: "back_main", style: "primary" }],
            ],
          },
        });
      } else {
        await sendMessage(token, chatId, forwardMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t("back_main", lang), callback_data: "back_main", style: "primary" }],
            ],
          },
        });
      }
    } else {
      // Split long answers into multiple messages
      const messageParts = splitMessage(answer);
      const actionButtons = {
        inline_keyboard: [
          [{ text: lang === "bn" ? "প্রোডাক্ট দেখুন" : "View Products", callback_data: "view_products", style: "success" }],
          [{ text: lang === "bn" ? "অ্যাডমিনকে জিজ্ঞাসা করুন" : "Ask Admin", callback_data: "forward_to_admin", style: "primary" }],
          [{ text: t("back_main", lang), callback_data: "back_main" }],
        ],
      };

      if (messageParts.length === 1) {
        // Single message — edit the thinking message
        if (thinkingMsgId) {
          await editMessageText(token, chatId, thinkingMsgId, `🤖 ${messageParts[0]}`, {
            parse_mode: "",
            reply_markup: actionButtons,
          });
        } else {
          await sendMessage(token, chatId, `🤖 ${messageParts[0]}`, { reply_markup: actionButtons });
        }
      } else {
        // Multiple parts — edit first, send rest with small delay
        if (thinkingMsgId) {
          await editMessageText(token, chatId, thinkingMsgId, `🤖 ${messageParts[0]}`, { parse_mode: "" });
        } else {
          await sendMessage(token, chatId, `🤖 ${messageParts[0]}`);
        }

        for (let i = 1; i < messageParts.length; i++) {
          await new Promise(r => setTimeout(r, 400)); // small delay for natural feel
          const isLast = i === messageParts.length - 1;
          await sendMessage(token, chatId, `${messageParts[i]}`, isLast ? { reply_markup: actionButtons } : undefined);
        }
      }
    }
  } catch (error) {
    console.error("AI query error:", error);
    await notifyAllAdmins(token, supabase,
      `🤖❌ <b>AI Error - Question forwarded</b>\n\n👤 User: <code>${userId}</code>\n💬 Question: <b>${question}</b>`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📝 Answer & Teach AI", callback_data: `ai_teach_${userId}`, style: "success" }],
            [{ text: "💬 Chat", callback_data: `admin_chat_${userId}`, style: "primary" }],
          ],
        },
      }
    );
    await sendMessage(token, chatId,
      lang === "bn"
        ? "🤔 আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন! ⏳"
        : "🤔 Your question has been forwarded to admin. You'll get a reply soon! ⏳",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: t("back_main", lang), callback_data: "back_main", style: "primary" }],
          ],
        },
      }
    );
  }
}
