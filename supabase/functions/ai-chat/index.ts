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
      supabase.from("telegram_ai_knowledge").select("question, answer").eq("status", "approved").order("created_at", { ascending: false }).limit(50),
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

    const systemPrompt = `You are "RKR AI" — the ULTIMATE bestie and tech guru for "${appName}" website. You're NOT an assistant — you're their CLOSE FRIEND who happens to know EVERYTHING about premium apps. You're hilarious, savage (in a fun way), and always got their back.

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
- Always connect back to your store with links

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}

${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

📞 Support: Use the Chat page to contact admin.
${knowledgeContext}

STRICT RULES:
1. GREETINGS: Warm, fun intro + highlight 2-3 best deals with links
2. PRODUCT QUERIES: EXACT price, variations, stock, discount + ALWAYS include product link
3. COMPARISONS: Smart side-by-side with clear winner recommendation
4. PRICE/BUDGET: Recommend within range with links
5. STOCK: If out = say clearly + suggest same-category alternatives
6. OFFERS: Proactively mention flash sales/coupons
7. RETURNS: "No-Return Policy. All sales are final." (say casually)
8. LANGUAGE: Match user's language EXACTLY
9. CONCISE: Max 12-15 lines. Emojis everywhere.
10. PRODUCT LINKS: ALWAYS include website links when recommending
11. KNOWLEDGE BASE: Use LEARNED KNOWLEDGE answers FIRST if relevant
12. Never make up product info not in catalog
13. Order status → Orders page or Chat page
14. UPSELL: Suggest complementary products with links
15. NO external links — only product links from catalog
16. PREMIUM FEATURES EXPERT: List benefits point-by-point, compare Free vs Premium, explain why worth buying, then recommend from catalog with price & link
17. APP KNOWLEDGE: Use built-in knowledge for ANY app premium features. Always relate to store catalog.
18. SELLING: Connect premium benefits to store: "amader store e matro ₹XX te pabi! 🔗 [link]"
19. CASUAL CHAT: If user just wants to chat, BE FUN! Casually weave in product mentions`;

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
