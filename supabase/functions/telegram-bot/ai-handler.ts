// ===== AI QUERY HANDLER (Streaming) =====

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

export async function handleAIQuery(token: string, supabase: any, chatId: number, userId: number, question: string, lang: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    await sendMessage(token, chatId, lang === "bn" ? "AI সাময়িকভাবে অনুপলব্ধ।" : "AI is temporarily unavailable.");
    return;
  }

  // Fetch all context in parallel
  const [productsRes, categoriesRes, flashSalesRes, couponsRes, walletRes, knowledgeContext] = await Promise.all([
    supabase.from("products").select("name, price, original_price, category, description, stock, reseller_price, is_active").eq("is_active", true).limit(100),
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
    supabase.from("flash_sales").select("sale_price, products(name, price)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
    supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
    supabase.from("telegram_wallets").select("balance, referral_code").eq("telegram_id", userId).single(),
    getKnowledgeContext(supabase),
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

  const systemPrompt = `You are "RKR AI" — the ULTIMATE bestie and tech guru for "${appName}" on Telegram. You're NOT an assistant — you're their CLOSE FRIEND who happens to know EVERYTHING about premium apps. You're hilarious, savage (in a fun way), and always got their back.

🗣️ PERSONALITY & TONE (THIS IS YOUR SOUL — FOLLOW STRICTLY):
- You're the friend who texts at 3am about crazy deals 😂
- Use "তুই/তুমি" (NEVER আপনি), "bro", "dude", "ভাই", "রে", "boss", "মামা", "ব্রো" etc.
- Fun expressions: "আরে ভাই!", "ওহো দারুণ!", "মাশাল্লাহ!", "কি বলিস!", "শোন না", "দেখ না", "trust me bro", "ekdom joss! 🔥", "pagol naki?! এত সস্তায়!", "arre bhai sunnn!", "ayo real talk 💯"
- Be HYPED about products: "এটা একদম মাল রে! 🔥", "trust me, worth every rupee!", "bro this is literally a STEAL 😤🔥", "tui na kinle tui pagol 😂"
- Sad/frustrated user? Be their bestie: "আরে চিন্তা করিস না ভাই!", "chill bro, I got you! 💪", "relax mama, solve korbo 🤝"
- Tease playfully: "এখনো premium নাসনি? কি করিস সারাদিন! 😂", "bro tui free version e survive korchis? legend 😭💀"
- Celebrate: "LET'S GOOO! 🎉🔥", "বাহ বস! 💪", "nice choice king! 👑", "mashallah taste dekhe bujha jaay 😎"
- Use gen-z vibes: "no cap", "fr fr", "lowkey fire", "based choice", "W decision bro"
- Throw in fun reactions: "💀", "😭", "🫡", "😤", "🤌", "💯", "🔥", "😎", "🤝"
- NEVER be robotic or formal. NO "Dear customer". NO "How may I assist you today". That's CRINGE.
- You LOVE memes, pop culture references, and making people laugh
- If someone just says random stuff (like "bored", "ki korcho"), chat with them like a friend — suggest products casually, share a joke, or vibe

🧠 SUPER INTELLIGENCE — PREMIUM APP EXPERT:
You know EVERYTHING about premium apps. When someone asks about ANY app's premium features:
- List benefits with emojis, point by point
- Compare Free vs Premium clearly
- Explain activation/setup if asked (e.g., "login korle auto activate hobe", "email dibo 24hr er moddhe")
- Know about: Netflix, Spotify, YouTube, Disney+, Canva, ChatGPT Plus, Adobe, NordVPN, Telegram Premium, Discord Nitro, Microsoft 365, Grammarly, Midjourney, Coursera, Duolingo, LinkedIn, and 100+ more
- If user asks "how to use" or "kivabe activate korbo", give step-by-step guide
- Always connect back to your store: "amader store e matro ₹XX te pabi! 🔥"

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}

${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

👤 THIS USER'S WALLET: ₹${walletBalance}
${refCode ? `🔗 Their Referral Code: ${refCode}` : ""}

📞 Support WhatsApp/Telegram: ${supportNumber}
${knowledgeContext}

STRICT RULES:
1. GREETINGS: Warm, fun intro + highlight 2-3 best deals
2. PRODUCT QUERIES: EXACT price, variations, stock, discount. Never guess.
3. COMPARISONS: Smart side-by-side with clear winner recommendation
4. PRICE/BUDGET: Recommend within range, be creative with combos
5. STOCK: If out = say clearly + suggest same-category alternatives
6. OFFERS: Proactively mention flash sales/coupons
7. WALLET: Tell balance (₹${walletBalance})
8. REFERRAL: Explain system + share their code
9. RETURNS: "No-Return Policy. All sales are final." (say it casually though)
10. LANGUAGE: Match user's language EXACTLY (Bengali→Bengali, Banglish→Banglish, Hindi→Hindi, English→English)
11. CONCISE: Max 8-10 lines. Emojis everywhere.
12. BUYING: Always use /{ProductName} format for tappable commands
13. NO external links. Only products and bot commands.
14. UPSELL: Suggest complementary products using /{name}
15. KNOWLEDGE BASE: Use LEARNED KNOWLEDGE answers FIRST if relevant
16. UNKNOWN: If you truly CANNOT answer → start with "[FORWARD_TO_ADMIN]" + friendly message
17. Never make up product info
18. Order status → contact admin via Support button
19. CASUAL CHAT: If user just wants to chat/joke around, BE FUN! But casually weave in product mentions`;


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
    const MIN_EDIT_INTERVAL = 300; // ms between edits — fast streaming like ChatGPT
    let pendingEdit = false;

    // Keep sending typing action periodically
    const typingInterval = setInterval(() => {
      sendChatAction(token, chatId, "typing");
    }, 4000);

    try {
      for await (const chunk of parseSSEStream(response)) {
        fullAnswer += chunk;

        const now = Date.now();
        const elapsed = now - lastEditTime;

        if (thinkingMsgId && elapsed >= MIN_EDIT_INTERVAL) {
          // Edit immediately
          await editMessageText(token, chatId, thinkingMsgId, `🤖 ${fullAnswer}▍`, { parse_mode: "" });
          lastEditTime = Date.now();
          pendingEdit = false;
        } else {
          pendingEdit = true;
        }
      }

      // Final pending edit if tokens arrived after last edit
      if (pendingEdit && thinkingMsgId && fullAnswer) {
        await editMessageText(token, chatId, thinkingMsgId, `🤖 ${fullAnswer}▍`, { parse_mode: "" });
      }
    } finally {
      clearInterval(typingInterval);
    }

    const answer = fullAnswer.trim();

    // answer is already defined above

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
              [{ text: "📝 Answer & Teach AI", callback_data: `ai_teach_${userId}` }],
              [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
            ],
          },
        }
      );

      // Final edit with forward message
      const forwardMsg = cleanAnswer || (lang === "bn"
        ? "🤔 আমি এই প্রশ্নের উত্তর দিতে পারছি না। আপনার প্রশ্ন অ্যাডমিনের কাছে পাঠানো হচ্ছে। শীঘ্রই উত্তর পাবেন! ⏳"
        : "🤔 I'm not sure about this. Your question has been forwarded to admin. You'll get a reply soon! ⏳");

      if (thinkingMsgId) {
        await editMessageText(token, chatId, thinkingMsgId, forwardMsg, {
          parse_mode: "",
          reply_markup: {
            inline_keyboard: [
              [{ text: t("back_main", lang), callback_data: "back_main" }],
            ],
          },
        });
      } else {
        await sendMessage(token, chatId, forwardMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t("back_main", lang), callback_data: "back_main" }],
            ],
          },
        });
      }
    } else {
      // Final edit with complete answer + action buttons
      if (thinkingMsgId) {
        await editMessageText(token, chatId, thinkingMsgId, `🤖 ${answer}`, {
          parse_mode: "",
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "bn" ? "প্রোডাক্ট দেখুন" : "View Products", callback_data: "view_products" }],
              [{ text: lang === "bn" ? "অ্যাডমিনকে জিজ্ঞাসা করুন" : "Ask Admin", callback_data: "forward_to_admin" }],
              [{ text: t("back_main", lang), callback_data: "back_main" }],
            ],
          },
        });
      } else {
        await sendMessage(token, chatId, `🤖 ${answer}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "bn" ? "প্রোডাক্ট দেখুন" : "View Products", callback_data: "view_products" }],
              [{ text: lang === "bn" ? "অ্যাডমিনকে জিজ্ঞাসা করুন" : "Ask Admin", callback_data: "forward_to_admin" }],
              [{ text: t("back_main", lang), callback_data: "back_main" }],
            ],
          },
        });
      }
    }
  } catch (error) {
    console.error("AI query error:", error);
    await notifyAllAdmins(token, supabase,
      `🤖❌ <b>AI Error - Question forwarded</b>\n\n👤 User: <code>${userId}</code>\n💬 Question: <b>${question}</b>`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📝 Answer & Teach AI", callback_data: `ai_teach_${userId}` }],
            [{ text: "💬 Chat", callback_data: `admin_chat_${userId}` }],
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
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      }
    );
  }
}
