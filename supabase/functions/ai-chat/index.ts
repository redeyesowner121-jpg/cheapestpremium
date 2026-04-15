import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to get user's telegram history for cross-platform context
    let telegramHistory: { role: string; content: string }[] = [];
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.email) {
          // Check if user logged in via Telegram (email format: tg_XXXXX@telegram.user)
          const tgMatch = user.email.match(/^tg_(\d+)@telegram\.user$/);
          if (tgMatch) {
            const telegramId = parseInt(tgMatch[1]);
            const { data: tgMessages } = await supabase
              .from("telegram_ai_messages")
              .select("role, content")
              .eq("telegram_id", telegramId)
              .order("created_at", { ascending: false })
              .limit(6);
            if (tgMessages?.length) {
              telegramHistory = tgMessages.reverse().map((m: any) => ({
                role: m.role,
                content: m.content,
              }));
            }
          }
        }
      } catch { /* ignore auth errors */ }
    }

    // Fetch all context in parallel
    const [productsRes, categoriesRes, flashSalesRes, couponsRes, knowledgeRes, settingsRes] = await Promise.all([
      supabase.from("products").select("name, price, original_price, category, description, stock, slug, is_active").eq("is_active", true).limit(100),
      supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("flash_sales").select("sale_price, products(name, price, slug)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
      supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
      supabase.from("telegram_ai_knowledge").select("question, answer").eq("status", "approved").order("created_at", { ascending: false }).limit(50),
      supabase.from("app_settings").select("key, value").in("key", ["app_name"]),
    ]);

    const products = productsRes.data || [];
    const { data: allVariations } = await supabase.from("product_variations").select("name, price, original_price, product_id, is_active, products(name, slug)").eq("is_active", true);

    const BASE_URL = "https://cheapest-premiums.in";

    const productCatalog = products.map((p: any) => {
      const vars = (allVariations || []).filter((v: any) => v.products?.name === p.name);
      const link = `${BASE_URL}/products/${p.slug}`;
      let info = `📦 ${p.name} — ₹${p.price} 🔗 ${link}`;
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
      `⚡ ${s.products?.name || "Product"}: ₹${s.sale_price} (was ₹${s.products?.price}) 🔗 ${BASE_URL}/products/${s.products?.slug}`
    ).join("\n") || "No active flash sales";

    const couponInfo = (couponsRes.data || []).map((c: any) => {
      const disc = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`;
      return `🎟️ ${c.code}: ${disc}${c.description ? ` - ${c.description}` : ""}`;
    }).join("\n") || "No active coupons";

    const knowledgeContext = (knowledgeRes.data || []).length > 0
      ? `\n\n📚 LEARNED KNOWLEDGE (admin-verified — USE THESE FIRST if relevant):\n${knowledgeRes.data!.map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n")}`
      : "";

    const appName = settingsRes.data?.find((s: any) => s.key === "app_name")?.value || "RKR Premium Store";

    // Build cross-platform context note
    const crossPlatformNote = telegramHistory.length > 0
      ? `\n\n🔗 CROSS-PLATFORM CONTEXT: This user also chats with you on Telegram bot. Here's their recent bot conversation for context:\n${telegramHistory.map(m => `${m.role === "user" ? "User" : "You"}: ${m.content}`).join("\n")}\n\nUse this context naturally — don't mention "Telegram bot" explicitly.`
      : "";

    const systemPrompt = `You are "RKR AI" — an advanced, intelligent AI assistant for "${appName}" website. You combine the analytical depth of Claude, the conversational fluency of ChatGPT, and the fun personality of a Gen-Z bestie.

⚡ EFFICIENCY RULES (CRITICAL — FOLLOW STRICTLY):
1. **BE CONCISE**: Answer in the MINIMUM words needed. No filler, no padding, no repeating yourself.
2. **ONE MESSAGE**: Complete your answer in a SINGLE response. Don't ask unnecessary follow-ups.
3. **DIRECT ANSWERS**: If user asks "price of X?", answer "₹XX" with link. Don't write a paragraph.
4. **NO OVER-EXPLAINING**: User asks simple question → give simple answer. Only elaborate if asked.
5. **SPLIT LONG RESPONSES**: If your answer has multiple distinct sections (like listing 5+ products), use clear headers and compact formatting.
6. **GREETINGS**: Keep greetings to 1 line max. Don't list deals unless asked.

🗣️ PERSONALITY & TONE:
- You're the friend who texts at 3am about crazy deals 😂
- DEFAULT LANGUAGE IS ENGLISH. Always reply in English unless the user writes in Bengali or Hindi.
- If user writes in Bengali → reply in Bengali/Banglish
- If user writes in Hindi → reply in Hindi/Hinglish
- If user writes in English → reply in English ONLY
- In English: Use "bro", "dude", "boss", "king", "fam"
- In Bengali: Use "তুই/তুমি" (NEVER আপনি), "ভাই", "রে", "মামা", "ব্রো"
- Be HYPED about good deals but HONEST about limitations
- Use emojis naturally, not excessively
- Be funny but HELPFUL first

🧠 EXPERT KNOWLEDGE — PREMIUM APP SPECIALIST:
You are an ENCYCLOPEDIA of premium apps. For ANY app:
- List ALL premium features with detailed explanations
- Compare Free vs Premium in a clear table format
- Explain activation/setup step-by-step
- Always connect back to store with product links

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}
${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

📞 Support: Use the Chat page to contact admin.
${knowledgeContext}
${crossPlatformNote}

📐 RESPONSE FORMATTING RULES:
1. Use **markdown** for ALL responses — headers, bold, lists, tables, links
2. For product comparisons, use markdown tables
3. For step-by-step guides, use numbered lists with clear headers
4. **CRITICAL - PRODUCT LINKS**: ALWAYS use markdown links with the EXACT product URL from the catalog. Format: [Product Name](https://cheapest-premiums.in/products/slug). NEVER write plain URLs.
5. When listing features, use bullet points with emojis
6. When listing multiple products, each product MUST have its own clickable link
7. **MULTI-PRODUCT LISTS**: When listing multiple products, put EACH product in its own section with a blank line between them. Include name, price, key feature, and link. NEVER combine multiple products into one paragraph.

🎯 STRICT RULES:
1. GREETINGS: Short warm intro (1 line). Only mention deals if asked.
2. PRODUCT QUERIES: EXACT price, variations, stock, discount + ALWAYS include product link
3. COMPARISONS: Use markdown tables for side-by-side comparisons
4. PRICE/BUDGET: Recommend within range with reasoning
5. STOCK: If out = say clearly + suggest alternatives from same category
6. OFFERS: Proactively mention flash sales/coupons when relevant
7. RETURNS: "No-Return Policy. All sales are final." (say casually)
8. LANGUAGE: Match user's language. Default English.
9. KNOWLEDGE BASE: Use LEARNED KNOWLEDGE answers FIRST if relevant
10. Never make up product info not in catalog
11. Order status → Orders page or Chat page
12. UPSELL: Suggest complementary products naturally
13. NO external links — only product links from catalog
14. UNCERTAINTY: If you're not sure, say so honestly.`;

    // Merge cross-platform history before client messages
    const finalMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
