// ===== AI QUERY HANDLER =====

import { t, BOT_USERNAME } from "./constants.ts";
import { sendMessage } from "./telegram-api.ts";
import { getSettings, getWallet } from "./db-helpers.ts";

export async function handleAIQuery(token: string, supabase: any, chatId: number, userId: number, question: string, lang: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    await sendMessage(token, chatId, lang === "bn" ? "AI সাময়িকভাবে অনুপলব্ধ।" : "AI is temporarily unavailable.");
    return;
  }

  // Fetch rich product context with variations
  const [productsRes, categoriesRes, flashSalesRes, couponsRes, walletRes] = await Promise.all([
    supabase.from("products").select("name, price, original_price, category, description, stock, reseller_price, is_active").eq("is_active", true).limit(100),
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
    supabase.from("flash_sales").select("sale_price, products(name, price)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
    supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
    supabase.from("telegram_wallets").select("balance, referral_code").eq("telegram_id", userId).single(),
  ]);

  // Fetch variations for all products
  const products = productsRes.data || [];
  const { data: allVariations } = await supabase.from("product_variations").select("name, price, original_price, reseller_price, product_id, is_active, products(name)").eq("is_active", true);

  // Build detailed product catalog
  const productCatalog = products.map((p: any) => {
    const vars = (allVariations || []).filter((v: any) => v.products?.name === p.name);
    let info = `📦 ${p.name} — ₹${p.price}`;
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

STRICT RULES:
1. GREETINGS: If someone says "hi", "hello", "হাই", "হ্যালো", "hey", "assalamualaikum", "কেমন আছেন" etc., respond warmly, introduce the store, and highlight 2-3 best products or current offers.
2. PRODUCT QUERIES: When asked about a product, give EXACT price, variations (if any), stock status, and discount info. Never guess prices.
3. COMPARISONS: If asked to compare products or suggest alternatives, do it intelligently using the catalog data.
4. PRICE/BUDGET: If user mentions a budget, recommend products within that range.
5. STOCK: If a product is out of stock (stock=0), clearly say so and suggest alternatives in the same category.
6. OFFERS: Proactively mention flash sales and coupons when relevant to the user's query.
7. WALLET: If user asks about wallet/balance, tell them their balance (₹${walletBalance}).
8. REFERRAL: If asked about referral/earning, explain the referral system and share their code if available.
9. RETURNS/REFUNDS: ALWAYS say: "We have a strict No-Return Policy. All sales are final." / "আমাদের কোনো রিটার্ন পলিসি নেই। সকল বিক্রয় চূড়ান্ত।"
10. LANGUAGE: Answer in ${lang === "bn" ? "Bengali" : "English"}.
11. CONCISE: Keep responses helpful but concise (max 8-10 lines). Use emojis.
12. BUYING: If user wants to buy, tell them to click "🛒 View Products" in the menu or type /products to browse and purchase.
13. DO NOT share any website/store links. Only mention products, prices, and the bot's commands.
14. UPSELL: When relevant, suggest complementary or popular products.
15. If you truly cannot answer or the question is unrelated, say you'll forward to admin.
16. Never make up product info that's not in the catalog.
17. For order status questions, tell them to contact admin via Support button.`;

  try {
    await sendMessage(token, chatId, lang === "bn" ? "🤖 চিন্তা করছি..." : "🤖 Thinking...");

    // Fetch last 10 messages for conversation history
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
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content || "";

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

    if (!answer || answer.toLowerCase().includes("forward") || answer.toLowerCase().includes("admin")) {
      await sendMessage(token, chatId, t("ai_forward", lang), {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin" }],
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      });
    } else {
      await sendMessage(token, chatId, `🤖 ${answer}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "bn" ? "🛒 প্রোডাক্ট দেখুন" : "🛒 View Products", callback_data: "view_products" }],
            [{ text: lang === "bn" ? "📩 অ্যাডমিনকে জিজ্ঞাসা করুন" : "📩 Ask Admin", callback_data: "forward_to_admin" }],
            [{ text: t("back_main", lang), callback_data: "back_main" }],
          ],
        },
      });
    }
  } catch (error) {
    console.error("AI query error:", error);
    await sendMessage(token, chatId, t("ai_forward", lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: lang === "bn" ? "📩 অ্যাডমিনকে পাঠান" : "📩 Forward to Admin", callback_data: "forward_to_admin" }],
        ],
      },
    });
  }
}
