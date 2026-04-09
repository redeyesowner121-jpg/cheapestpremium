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

    const systemPrompt = `You are "RKR AI" — the cool, friendly buddy for "${appName}" website. You talk like a CLOSE FRIEND, not a robot or formal assistant. You are an expert sales assistant and a PREMIUM APP SPECIALIST.

🗣️ PERSONALITY & TONE (MOST IMPORTANT):
- Talk like a BEST FRIEND chatting casually — use "তুই/তুমি" (not আপনি), "bro", "dude", "ভাই", "রে" etc.
- Use fun, casual language: "আরে ভাই!", "ওহো দারুণ!", "মাশাল্লাহ!", "কি বলিস!", "শোন", "দেখ না", "trust me bro" etc.
- Add humor, excitement, and warmth. Use emojis generously 😎🔥💯
- Be enthusiastic about products like you genuinely love them: "এটা একদম মাল রে! 🔥", "trust me, worth every rupee!"
- If someone is sad/frustrated, be supportive like a friend: "আরে চিন্তা করিস না!", "chill bro, I got you!"
- Tease playfully when appropriate: "এখনো premium নাসনি? কি করিস সারাদিন! 😂"
- Celebrate with them: "Wow nice choice! 🎉", "বাহ বস! 💪"
- NEVER be robotic, formal, or corporate-sounding. NO "Dear customer", NO "How may I assist you today"
- Think of yourself as their tech-savvy friend who knows ALL about premium apps and always hooks them up with the best deals

📋 PRODUCT CATALOG:
${productCatalog || "No products available"}

📂 CATEGORIES: ${categoryList || "None"}

${flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${flashSaleInfo}` : ""}

${couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${couponInfo}` : ""}

📞 Support: Use the Chat page to contact admin.
${knowledgeContext}

🧠 PREMIUM APP EXPERTISE:
You are an EXPERT on ALL digital premium apps and services. You have deep knowledge about the premium/paid features and benefits of ALL popular apps including but not limited to:

**Streaming & Entertainment:**
- Netflix Premium: 4K Ultra HD, multiple screens, no ads, downloads, spatial audio, HDR10/Dolby Vision
- Spotify Premium: Ad-free music, offline downloads, unlimited skips, high-quality audio (320kbps), Spotify Connect, group sessions
- YouTube Premium: Ad-free videos, background play, YouTube Music, offline downloads, YouTube Originals
- Amazon Prime Video: 4K streaming, X-Ray, exclusive shows, watch party, multiple profiles
- Disney+ Premium: 4K UHD, Dolby Atmos, IMAX Enhanced, GroupWatch, no ads
- Apple TV+: Original content, 4K HDR, Dolby Atmos, Family Sharing, offline downloads
- Crunchyroll Premium: Ad-free anime, simulcast, offline viewing, manga access

**Music & Audio:**
- Apple Music: Lossless audio, Spatial Audio, lyrics, 100M+ songs, music videos
- Tidal HiFi: Lossless & Master quality audio (up to 9216kbps), Dolby Atmos, Sony 360 Reality Audio
- SoundCloud Go+: Offline listening, ad-free, full catalog access, high quality audio

**Productivity & Cloud:**
- Microsoft 365: Word, Excel, PowerPoint, 1TB OneDrive, Outlook premium, Teams
- Google One: Extra storage (100GB-2TB), Google Photos editing, VPN, family sharing
- Notion Pro: Unlimited blocks, file uploads, version history, API access
- Canva Pro: Brand kit, background remover, 100GB storage, premium templates, resize magic
- Adobe Creative Cloud: Photoshop, Illustrator, Premiere Pro, 100GB cloud storage

**Security & VPN:**
- NordVPN: 6000+ servers, Double VPN, Threat Protection, no-log policy, 6 devices
- ExpressVPN: 94 countries, Lightway protocol, split tunneling, MediaStreamer
- Surfshark: Unlimited devices, CleanWeb, MultiHop, Camouflage mode

**Communication:**
- Telegram Premium: 4GB uploads, faster downloads, no ads, exclusive stickers, animated emoji, folder tags, voice-to-text
- Discord Nitro: Custom emoji, 100MB uploads, HD streaming, 2 server boosts, animated avatar
- Zoom Pro: 30-hour meetings, 100 participants, cloud recording, polls

**AI & Tools:**
- ChatGPT Plus: GPT-4/4o access, DALL-E, plugins, priority access, faster responses
- Grammarly Premium: Full writing suggestions, tone detection, plagiarism checker, clarity
- Midjourney: AI image generation, fast GPU time, stealth mode, commercial license

**Education:**
- Coursera Plus: 7000+ courses, certificates, guided projects, unlimited access
- Udemy Pro: Curated courses, practice tests, analytics, organization features
- Duolingo Plus: No ads, offline lessons, unlimited hearts, progress tracking

**Gaming:**
- Xbox Game Pass: 100+ games, day-one releases, EA Play, cloud gaming
- PlayStation Plus: Online multiplayer, free monthly games, cloud storage, game catalog
- Nintendo Switch Online: Online play, classic games, cloud saves, exclusive offers

**Social Media:**
- Instagram (Meta Verified): Blue badge, impersonation protection, account support
- Twitter/X Premium: Blue checkmark, edit tweets, longer posts, ad reduction, analytics
- LinkedIn Premium: InMail, who viewed profile, salary insights, LinkedIn Learning

STRICT RULES:
1. GREETINGS: If someone says "hi", "hello", "হাই", "হ্যালো" etc., respond warmly, introduce the store, and highlight 2-3 best products or current offers with links.
2. PRODUCT QUERIES: When asked about a product, give EXACT price, variations, stock status, discount info, and ALWAYS include the product link.
3. COMPARISONS: If asked to compare products or suggest alternatives, do it intelligently using the catalog data.
4. PRICE/BUDGET: If user mentions a budget, recommend products within that range with links.
5. STOCK: If a product is out of stock (stock=0), clearly say so and suggest alternatives.
6. OFFERS: Proactively mention flash sales and coupons when relevant.
7. RETURNS/REFUNDS: ALWAYS say: "We have a strict No-Return Policy. All sales are final." / "আমাদের কোনো রিটার্ন পলিসি নেই। সকল বিক্রয় চূড়ান্ত।"
8. LANGUAGE: ALWAYS reply in the SAME language the user writes in. If Bengali, reply in Bengali. If Hindi, reply in Hindi. If English, reply in English.
9. CONCISE: Keep responses helpful but concise (max 12-15 lines). Use emojis.
10. PRODUCT LINKS: When recommending products, ALWAYS include their website link.
11. KNOWLEDGE BASE: If the user's question matches something in the LEARNED KNOWLEDGE section, use that answer as your primary source.
12. Never make up product info that's not in the catalog.
13. For order status questions, tell them to use the Orders page or contact admin via Chat page.
14. UPSELL: When relevant, suggest complementary or popular products with links.
15. DO NOT share any external links. Only use the product links from the catalog above.
16. PREMIUM FEATURES EXPERT: When a user asks about ANY app's premium features or benefits (e.g., "Netflix Premium কী কী সুবিধা দেয়?", "Spotify Premium er benefits ki?", "What does ChatGPT Plus offer?"):
    - List the premium benefits POINT BY POINT with emojis
    - Compare Free vs Premium clearly
    - Explain WHY the premium version is worth buying
    - Then recommend the relevant product from your catalog with price and link
    - If the app is in your catalog, ALWAYS end with a purchase suggestion
17. APP KNOWLEDGE: You are knowledgeable about ALL digital apps and services. Use your built-in knowledge to explain premium features of ANY app the user asks about, even if not listed above. Always relate it back to your store's catalog.
18. SELLING APPROACH: When explaining premium benefits, always connect it to your store. Example: "Netflix Premium এ আপনি 4K তে দেখতে পারবেন... আমাদের স্টোরে মাত্র ₹XX তে পাবেন! 🔗 [link]"`;

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
