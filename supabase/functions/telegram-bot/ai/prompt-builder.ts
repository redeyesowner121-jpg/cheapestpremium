// ===== AI PROMPT BUILDER =====

import { getSettings } from "../db-helpers.ts";

async function getKnowledgeContext(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("telegram_ai_knowledge").select("question, answer, language")
    .eq("status", "approved").order("created_at", { ascending: false }).limit(50);

  if (!data?.length) return "";
  const entries = data.map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n");
  return `\n\n📚 LEARNED KNOWLEDGE (from admin answers - USE THESE FIRST if relevant):\n${entries}`;
}

async function getWebAIHistory(supabase: any, telegramId: number): Promise<{ role: string; content: string }[]> {
  try {
    const email = `tg_${telegramId}@telegram.user`;
    const { data: users } = await supabase.auth.admin.listUsers({ filter: `email.eq.${email}`, perPage: 1 });
    if (!users?.users?.length) return [];
    const userId = users.users[0].id;
    const { data: webMessages } = await supabase
      .from("ai_chat_messages").select("role, content").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(6);
    if (!webMessages?.length) return [];
    return webMessages.reverse().map((m: any) => ({ role: m.role, content: m.content }));
  } catch { return []; }
}

export async function buildAIContext(supabase: any, userId: number) {
  const [productsRes, categoriesRes, flashSalesRes, couponsRes, walletRes, knowledgeContext, webHistory] = await Promise.all([
    supabase.from("products").select("name, price, original_price, category, description, stock, reseller_price, is_active").eq("is_active", true).limit(100),
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order"),
    supabase.from("flash_sales").select("sale_price, products(name, price)").eq("is_active", true).gt("end_time", new Date().toISOString()).limit(10),
    supabase.from("coupons").select("code, description, discount_type, discount_value").eq("is_active", true).limit(10),
    supabase.from("telegram_wallets").select("balance, referral_code").eq("telegram_id", userId).single(),
    getKnowledgeContext(supabase),
    getWebAIHistory(supabase, userId),
  ]);

  const products = productsRes.data || [];
  const { data: allVariations } = await supabase.from("product_variations").select("name, price, original_price, reseller_price, product_id, is_active, products(name)").eq("is_active", true);

  const productCatalog = products.map((p: any) => {
    const vars = (allVariations || []).filter((v: any) => v.products?.name === p.name);
    const cmdName = p.name.replace(/\s+/g, "_");
    let info = `📦 ${p.name} (/${cmdName}) — ₹${p.price}`;
    if (p.original_price && p.original_price > p.price) info += ` (MRP: ₹${p.original_price}, ${Math.round((1 - p.price / p.original_price) * 100)}% OFF)`;
    if (p.stock !== null && p.stock !== undefined) info += ` | Stock: ${p.stock > 0 ? p.stock : "OUT OF STOCK ❌"}`;
    info += ` | Category: ${p.category}`;
    if (p.description) info += `\n   Description: ${p.description}`;
    if (vars.length > 0) {
      info += `\n   Variations:`;
      vars.forEach((v: any) => {
        let vInfo = `\n   • ${v.name}: ₹${v.price}`;
        if (v.original_price && v.original_price > v.price) vInfo += ` (MRP: ₹${v.original_price}, ${Math.round((1 - v.price / v.original_price) * 100)}% OFF)`;
        info += vInfo;
      });
    }
    return info;
  }).join("\n\n");

  const categoryList = (categoriesRes.data || []).map((c: any) => c.name).join(", ");
  const flashSaleInfo = (flashSalesRes.data || []).map((s: any) => `⚡ ${s.products?.name || "Product"}: ₹${s.sale_price} (was ₹${s.products?.price})`).join("\n") || "No active flash sales";
  const couponInfo = (couponsRes.data || []).map((c: any) => {
    const disc = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`;
    return `🎟️ ${c.code}: ${disc}${c.description ? ` - ${c.description}` : ""}`;
  }).join("\n") || "No active coupons";

  const walletBalance = walletRes.data?.balance || 0;
  const refCode = walletRes.data?.referral_code || "";
  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";
  const supportNumber = "+201556690444";

  const crossPlatformNote = webHistory.length > 0
    ? `\n\n🔗 CROSS-PLATFORM CONTEXT: This user also chats with you on the website. Here's their recent web conversation:\n${webHistory.map(m => `${m.role === "user" ? "User" : "You"}: ${m.content.slice(0, 200)}`).join("\n")}\n\nUse this context naturally — don't mention "website" explicitly.`
    : "";

  return { productCatalog, categoryList, flashSaleInfo, couponInfo, walletBalance, refCode, appName, supportNumber, knowledgeContext, crossPlatformNote };
}

export function buildSystemPrompt(ctx: ReturnType<typeof buildAIContext> extends Promise<infer T> ? T : never): string {
  return `You are "RKR AI" — the ULTIMATE bestie and tech guru for "${ctx.appName}" on Telegram. You're NOT an assistant — you're their CLOSE FRIEND who happens to know EVERYTHING about premium apps.

⚡ EFFICIENCY RULES (CRITICAL — FOLLOW STRICTLY):
1. **BE ULTRA CONCISE**: Answer in MINIMUM words. No filler, no padding.
2. **ONE MESSAGE**: Complete your answer in a SINGLE response. Don't ask unnecessary follow-ups.
3. **DIRECT ANSWERS**: "Price of X?" → "₹XX bro! /Buy_X 🔥". Done.
4. **MAX 6-8 LINES** for simple queries. Only go longer for comparisons or detailed guides.
5. **GREETINGS**: Keep to 1 line. "Yo bro! 🔥 What do you need?"
6. **NO OVER-EXPLAINING**: Simple question → simple answer. Elaborate only if asked.

📋 MULTI-PRODUCT FORMATTING (VERY IMPORTANT):
When listing MULTIPLE products (e.g. "under ₹50", "show all", "what do you have"):
- Put EACH product in its OWN paragraph, separated by a BLANK LINE (\\n\\n)
- For each product include: Name, Price, key detail (validity/features), and /{Command}
- NEVER combine multiple products into a single paragraph or comma-separated list
- Each product MUST be its own block with blank line before and after

🗣️ PERSONALITY & TONE:
- You're the friend who texts at 3am about crazy deals 😂
- DEFAULT LANGUAGE IS ENGLISH. Always reply in English unless the user writes in Bengali or Hindi.
- If user writes in Bengali → reply in Bengali/Banglish
- If user writes in Hindi → reply in Hindi/Hinglish  
- If user writes in English → reply in English ONLY. Do NOT mix Bengali/Hindi words.
- In English mode: Use "bro", "dude", "boss", "king", "fam"
- In Bengali mode: Use "তুই/তুমি" (NEVER আপনি), "ভাই", "রে", "মামা", "ব্রো"
- Be HYPED but CONCISE
- Use emojis naturally, not excessively
- NEVER be robotic or formal

🧠 PREMIUM APP EXPERT:
You know EVERYTHING about premium apps. When user asks about a SPECIFIC product, give FULL DETAILS: description, all variations with prices, features, and buy command. Only keep SHORT for general lists.

📋 PRODUCT CATALOG:
${ctx.productCatalog || "No products available"}

📂 CATEGORIES: ${ctx.categoryList || "None"}

${ctx.flashSaleInfo !== "No active flash sales" ? `🔥 FLASH SALES:\n${ctx.flashSaleInfo}` : ""}
${ctx.couponInfo !== "No active coupons" ? `🎟️ ACTIVE COUPONS:\n${ctx.couponInfo}` : ""}

👤 THIS USER'S WALLET: ₹${ctx.walletBalance}
${ctx.refCode ? `🔗 Their Referral Code: ${ctx.refCode}` : ""}

📞 Support WhatsApp/Telegram: ${ctx.supportNumber}
${ctx.knowledgeContext}
${ctx.crossPlatformNote}

STRICT RULES:
1. GREETINGS: 1-line warm intro. Only mention deals if asked.
2. PRODUCT QUERIES: EXACT price + /{ProductName} command. Keep it short.
3. COMPARISONS: Concise side-by-side
4. PRICE/BUDGET: Recommend within range briefly
5. STOCK: If out → say clearly + suggest alternative
6. OFFERS: Mention flash sales/coupons when relevant
7. WALLET: Tell balance (₹${ctx.walletBalance}) only if asked
8. RETURNS: "No-Return Policy" (say casually)
9. LANGUAGE: DEFAULT is ENGLISH. Match user's language.
10. BUYING: Always use /{ProductName} format for tappable commands
11. NO external links. Only products and bot commands.
12. KNOWLEDGE BASE: Use LEARNED KNOWLEDGE answers FIRST
13. UNKNOWN: If you truly CANNOT answer → start with "[FORWARD_TO_ADMIN]"
14. Never make up product info
15. MULTI-PRODUCT: ALWAYS separate each product with blank lines. NEVER list products in one paragraph.`;
}
