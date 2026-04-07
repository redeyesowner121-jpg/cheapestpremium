import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({ products: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get all product names for context
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, price, image_url, original_price, reseller_price, sold_count, rating, seo_tags, description")
      .eq("is_active", true);

    if (!allProducts || allProducts.length === 0) {
      return new Response(JSON.stringify({ products: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productList = allProducts.map((p) => p.name).join(", ");

    // Step 2: Use AI to find matching products
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are a product search assistant. The user may search in Bengali (Bangla script), Banglish (Bengali written in English letters), or English. Your job is to find matching products from the catalog.

IMPORTANT RULES:
- Bengali/Banglish transliteration: "লোভাবলে" or "lovable" or "lobable" should all match "Lovable"
- "নেটফ্লিক্স" or "netflix" or "netfliks" should match "Netflix"  
- "স্পটিফাই" or "spotify" or "spotifai" should match "Spotify"
- Fuzzy matching: minor typos or phonetic spellings should still match
- Match against product names AND seo_tags
- Return ONLY the exact product names that match, comma-separated
- If nothing matches, return "NONE"
- Do NOT explain, just return the matching product names exactly as they appear in the catalog`,
            },
            {
              role: "user",
              content: `Product catalog: ${productList}\n\nSearch query: "${query}"\n\nReturn matching product names:`,
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Fallback to basic search
      const basicResults = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.seo_tags && p.seo_tags.toLowerCase().includes(query.toLowerCase()))
      );
      return new Response(JSON.stringify({ products: basicResults.slice(0, 8) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiResult = aiData.choices?.[0]?.message?.content?.trim() || "NONE";

    if (aiResult === "NONE") {
      // Try basic fallback search anyway
      const basicResults = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.seo_tags && p.seo_tags.toLowerCase().includes(query.toLowerCase()))
      );
      return new Response(JSON.stringify({ products: basicResults.slice(0, 8) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse AI result and find matching products
    const matchedNames = aiResult.split(",").map((n: string) => n.trim().toLowerCase());
    const matchedProducts = allProducts.filter((p) =>
      matchedNames.some(
        (name: string) =>
          p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase())
      )
    );

    // Also include basic text matches as fallback
    const basicMatches = allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.seo_tags && p.seo_tags.toLowerCase().includes(query.toLowerCase()))
    );

    // Merge and deduplicate
    const seen = new Set<string>();
    const merged = [...matchedProducts, ...basicMatches].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return new Response(JSON.stringify({ products: merged.slice(0, 8) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
