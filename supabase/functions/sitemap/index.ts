import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

const BASE_URL = "https://cheapest-premiums.in";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all active products
  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at, category")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  // Fetch all active categories
  const categories = new Set<string>();
  products?.forEach((p) => categories.add(p.category));

  // Static pages
  const staticPages = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/products", changefreq: "daily", priority: "0.9" },
    { loc: "/terms", changefreq: "monthly", priority: "0.3" },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Add static pages
  for (const page of staticPages) {
    xml += `
  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // Add product pages
  if (products) {
    for (const product of products) {
      const lastmod = product.updated_at
        ? new Date(product.updated_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      xml += `
  <url>
    <loc>${BASE_URL}/product/${encodeURIComponent(product.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }
  }

  // Add category pages
  for (const category of categories) {
    xml += `
  <url>
    <loc>${BASE_URL}/products?category=${encodeURIComponent(category)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return new Response(xml, { headers: corsHeaders });
});
