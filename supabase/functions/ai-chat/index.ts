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

    // Fetch all context in parallel — same as bot AI
    const [productsRes, categoriesRes, flashSalesRes, couponsRes, knowledgeRes, settingsRes] = await Promise.all([
      supabase.from("products").select("name, price, original_price, category, description, stock, slug, is_active").eq("is_active", true).limit(100),
      supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("flash_sales").select("sale_price, products(name, price, slug)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
      supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
      supabase.from("telegram_ai_knowledge").select("question, answer").order("created_at", { ascending: false }).limit(50),
      supabase.from("app_settings").select("key, value").in("key", ["app_name"]),
    ]);

    // Fetch variations
    const products = productsRes.data || [];
    const { data: allVariations } = await supabase.from("product_variations").select("name, price, original_price, product_id, is_active, products(name, slug)").eq("is_active", true);

    const BASE_URL = "https://cheapest-premiums.lovable.app";

    // Build product catalog with website links
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

    const systemPrompt = `You are the smart, friendly AI assistant for "${appName}" — a digital premium products store website. You are an expert sales assistant.

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}

${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

📞 Support: Use the Chat page to contact admin.
${knowledgeContext}

STRICT RULES:
1. GREETINGS: If someone says "hi", "hello", "হাই", "হ্যালো" etc., respond warmly, introduce the store, and highlight 2-3 best products or current offers with links.
2. PRODUCT QUERIES: When asked about a product, give EXACT price, variations, stock status, discount info, and ALWAYS include the product link.
3. COMPARISONS: If asked to compare products or suggest alternatives, do it intelligently using the catalog data.
4. PRICE/BUDGET: If user mentions a budget, recommend products within that range with links.
5. STOCK: If a product is out of stock (stock=0), clearly say so and suggest alternatives.
6. OFFERS: Proactively mention flash sales and coupons when relevant.
7. RETURNS/REFUNDS: ALWAYS say: "We have a strict No-Return Policy. All sales are final." / "আমাদের কোনো রিটার্ন পলিসি নেই। সকল বিক্রয় চূড়ান্ত।"
8. LANGUAGE: ALWAYS reply in the SAME language the user writes in. If Bengali, reply in Bengali. If Hindi, reply in Hindi. If English, reply in English.
9. CONCISE: Keep responses helpful but concise (max 8-10 lines). Use emojis.
10. PRODUCT LINKS: When recommending products, ALWAYS include their website link. Example: "Netflix চাইলে এখানে দেখুন: ${BASE_URL}/products/netflix-xxx" or "Check out [Netflix](${BASE_URL}/products/netflix-xxx)!"
11. KNOWLEDGE BASE: If the user's question matches something in the LEARNED KNOWLEDGE section, use that answer as your primary source.
12. Never make up product info that's not in the catalog.
13. For order status questions, tell them to use the Orders page or contact admin via Chat page.
14. UPSELL: When relevant, suggest complementary or popular products with links.
15. DO NOT share any external links. Only use the product links from the catalog above.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
