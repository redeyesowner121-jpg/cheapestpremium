// ===== AI QUERY HANDLER (Streaming) =====

import { t, BOT_USERNAME } from "./constants.ts";
import { sendMessage, sendMessageWithId, editMessageText } from "./telegram-api.ts";
import { getSettings, getWallet, setConversationState, notifyAllAdmins } from "./db-helpers.ts";

// Fetch knowledge base entries relevant to the question
async function getKnowledgeContext(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("telegram_ai_knowledge")
    .select("question, answer, language")
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

  const systemPrompt = `You are the smart, friendly AI assistant for "${appName}" — a Telegram-based digital premium products store. You are an expert sales assistant.

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
1. GREETINGS: If someone says "hi", "hello", "হাই", "হ্যালো", "hey", "assalamualaikum", "কেমন আছেন", "namaste", "namaskar" etc., respond warmly, introduce the store, and highlight 2-3 best products or current offers.
2. PRODUCT QUERIES: When asked about a product, give EXACT price, variations (if any), stock status, and discount info. Never guess prices.
3. COMPARISONS: If asked to compare products or suggest alternatives, do it intelligently using the catalog data.
4. PRICE/BUDGET: If user mentions a budget, recommend products within that range.
5. STOCK: If a product is out of stock (stock=0), clearly say so and suggest alternatives in the same category.
6. OFFERS: Proactively mention flash sales and coupons when relevant to the user's query.
7. WALLET: If user asks about wallet/balance, tell them their balance (₹${walletBalance}).
8. REFERRAL: If asked about referral/earning, explain the referral system and share their code if available.
9. RETURNS/REFUNDS: ALWAYS say: "We have a strict No-Return Policy. All sales are final." / "আমাদের কোনো রিটার্ন পলিসি নেই। সকল বিক্রয় চূড়ান্ত।"
10. LANGUAGE: ALWAYS reply in the SAME language the user writes in. If they write Bengali, reply in Bengali. If Hindi (in English script like "kya hai"), reply in Hindi (English script). If English, reply in English. Match their exact language style.
11. CONCISE: Keep responses helpful but concise (max 8-10 lines). Use emojis.
12. BUYING: When recommending products, ALWAYS mention them with /{ProductName} format (replace spaces with _). Example: "Netflix চাইলে /Netflix টাইপ করুন!" or "Try /Spotify for music!". This lets users tap the command to directly see the product.
13. DO NOT share any website/store links. Only mention products, prices, and the bot's commands.
14. UPSELL: When relevant, suggest complementary or popular products using /{name} format.
15. KNOWLEDGE BASE: If the user's question matches something in the LEARNED KNOWLEDGE section, use that answer as your primary source. These are admin-verified answers.
16. CONFIDENCE: If you truly CANNOT answer the question (not in catalog, not in knowledge base, unrelated to store), respond with EXACTLY this marker at the START of your message: "[FORWARD_TO_ADMIN]" followed by a polite message saying you'll forward to admin.
17. Never make up product info that's not in the catalog.
18. For order status questions, tell them to contact admin via Support button.`;

  try {
    // Send initial "thinking" message and get its ID for editing
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

    // Collect full response from stream
    let fullAnswer = "";
    for await (const chunk of parseSSEStream(response)) {
      fullAnswer += chunk;
    }
    const answer = fullAnswer.trim();

    // Progressive reveal: show ~3 lines per second for natural typing feel
    if (thinkingMsgId && answer) {
      const lines = answer.split("\n");
      const LINES_PER_TICK = 3;
      const TICK_MS = 1000;

      for (let i = LINES_PER_TICK; i < lines.length; i += LINES_PER_TICK) {
        const partial = lines.slice(0, i).join("\n");
        await editMessageText(token, chatId, thinkingMsgId, `🤖 ${partial}▍`);
        await new Promise(r => setTimeout(r, TICK_MS));
      }
    }

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
