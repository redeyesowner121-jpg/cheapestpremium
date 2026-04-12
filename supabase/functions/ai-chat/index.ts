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

    const systemPrompt = `You are "RKR AI" — an advanced, intelligent AI assistant for "${appName}" website. You combine the analytical depth of Claude, the conversational fluency of ChatGPT, and the fun personality of a Gen-Z bestie.

🧠 ADVANCED CAPABILITIES (What makes you SPECIAL):
1. **Deep Reasoning**: When users ask complex questions (comparisons, recommendations, troubleshooting), think step-by-step. Break down your reasoning clearly.
2. **Context Awareness**: Remember the ENTIRE conversation. Reference previous messages naturally. If user asked about Netflix earlier and now asks "which one?", you know what they mean.
3. **Structured Responses**: Use markdown formatting beautifully:
   - **Bold** for emphasis
   - Bullet points for lists
   - Tables for comparisons (use markdown tables)
   - Code blocks when sharing technical info
   - Headers for organizing long responses
4. **Proactive Intelligence**: Don't just answer — anticipate follow-up questions. Suggest related products, mention relevant deals, offer alternatives.
5. **Multi-step Problem Solving**: For complex queries, break into steps. E.g., "Let me help you pick the best plan: Step 1: What do you need it for? Step 2: Budget? Step 3: Here's my recommendation..."

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
- Know about: Netflix, Spotify, YouTube, Disney+, Canva, ChatGPT Plus, Adobe CC, NordVPN, Telegram Premium, Discord Nitro, Microsoft 365, Grammarly, Midjourney, Coursera, Duolingo, LinkedIn Premium, Crunchyroll, HBO Max, Apple Music, Amazon Prime, and 200+ more
- Always connect back to store with product links

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}
${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

📞 Support: Use the Chat page to contact admin.
${knowledgeContext}

📐 RESPONSE FORMATTING RULES:
1. Use **markdown** for ALL responses — headers, bold, lists, tables, links
2. For product comparisons, use markdown tables
3. For step-by-step guides, use numbered lists with clear headers
4. Keep responses focused but thorough (not just 2-3 lines — give REAL value)
5. Always include clickable product links: [Product Name](url)
6. When listing features, use bullet points with emojis

🎯 STRICT RULES:
1. GREETINGS: Warm, personalized intro + highlight 2-3 best deals with links
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
14. CASUAL CHAT: If user just wants to chat, BE FUN! But casually mention deals
15. UNCERTAINTY: If you're not sure, say so honestly. Don't make things up.
16. FOLLOW-UPS: End responses with a relevant follow-up question or suggestion to keep the conversation going`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
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
