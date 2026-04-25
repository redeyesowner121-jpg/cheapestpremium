import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

const BASE_URL = "https://cheapest-premiums.in";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at, category, image_url, name")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const categories = new Set<string>();
  products?.forEach((p) => p.category && categories.add(p.category));

  const staticPages = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/products", changefreq: "daily", priority: "0.9" },
    { loc: "/terms", changefreq: "monthly", priority: "0.3" },
  ];

  const today = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  for (const page of staticPages) {
    xml += `
  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  if (products) {
    for (const product of products) {
      const lastmod = product.updated_at
        ? new Date(product.updated_at).toISOString().split("T")[0]
        : today;
      xml += `
  <url>
    <loc>${BASE_URL}/product/${encodeURIComponent(product.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;
      if (product.image_url) {
        xml += `
    <image:image>
      <image:loc>${escapeXml(product.image_url)}</image:loc>
      <image:title>${escapeXml(product.name || "")}</image:title>
    </image:image>`;
      }
      xml += `
  </url>`;
    }
  }

  for (const category of categories) {
    xml += `
  <url>
    <loc>${BASE_URL}/products?category=${encodeURIComponent(category)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return new Response(xml, { headers: corsHeaders });
});
