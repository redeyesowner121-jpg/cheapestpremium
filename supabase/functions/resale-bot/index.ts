// ===== RESALE BOT - Dedicated bot for resale link purchases =====
// This bot ONLY handles resale link purchases. No product browsing, no original prices.
//
// Refactored: helpers moved to ./telegram-api.ts, ./db-helpers.ts, ./upi-helpers.ts, ./payment-flow.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTelegramBotTokens } from "../_shared/telegram-token-resolver.ts";
import { sendMessage, answerCallbackQuery } from "./telegram-api.ts";
import {
  getConversationState, deleteConversationState, upsertUser, getUserLang,
} from "./db-helpers.ts";
import { showPaymentInfo, handleResaleWalletPay, handleResaleScreenshot } from "./payment-flow.ts";

const MAIN_BOT_USERNAME = "Air1_Premium_bot";
const RESALE_BOT_USERNAME = "AIR1XOTT_bot";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { mainBotToken, resaleBotToken } = await resolveTelegramBotTokens({
    configuredMainToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
    configuredResaleToken: Deno.env.get("RESALE_BOT_TOKEN"),
    expectedMainUsername: MAIN_BOT_USERNAME,
    expectedResaleUsername: RESALE_BOT_USERNAME,
  });

  const RESALE_BOT_TOKEN = resaleBotToken;
  const MAIN_BOT_TOKEN = mainBotToken || resaleBotToken;

  if (!RESALE_BOT_TOKEN || !MAIN_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "Bot tokens not configured" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const update = await req.json();
    const msg = update.message;
    const callbackQuery = update.callback_query;

    // ===== CALLBACK QUERY (wallet pay confirm) =====
    if (callbackQuery) {
      const cbData = callbackQuery.data;
      const chatId = callbackQuery.message?.chat?.id;
      const userId = callbackQuery.from?.id;
      await answerCallbackQuery(RESALE_BOT_TOKEN, callbackQuery.id);

      if (cbData === "resale_walletpay_confirm" && chatId && userId) {
        const state = await getConversationState(supabase, userId);
        if (state?.step === "resale_wallet_pay_confirm") {
          const lang = await getUserLang(supabase, userId);
          await handleResaleWalletPay(RESALE_BOT_TOKEN, MAIN_BOT_TOKEN, supabase, chatId, userId, state.data, lang);
        }
      }
      return new Response("OK", { headers: corsHeaders });
    }

    if (!msg) return new Response("OK", { headers: corsHeaders });

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text?.trim() || "";

    if (!userId) return new Response("OK", { headers: corsHeaders });

    await upsertUser(supabase, msg.from);
    const lang = await getUserLang(supabase, userId);

    // ===== /start with resale code =====
    if (text.startsWith("/start")) {
      await deleteConversationState(supabase, userId);

      const parts = text.split(" ");
      if (parts.length > 1 && parts[1].startsWith("buy_")) {
        const linkCode = parts[1].replace("buy_", "");

        let link: any = null;
        const { data: tgLink } = await supabase.from("telegram_resale_links").select("*").eq("link_code", linkCode).eq("is_active", true).single();
        if (tgLink) {
          link = tgLink;
        } else {
          const { data: webLink } = await supabase.from("resale_links").select("*").eq("link_code", linkCode).eq("is_active", true).single();
          if (webLink) {
            link = { ...webLink, reseller_telegram_id: null };
          }
        }

        if (!link) {
          await sendMessage(RESALE_BOT_TOKEN, chatId,
            lang === "bn" ? "❌ লিংক পাওয়া যায়নি বা মেয়াদ শেষ।" : "❌ Link not found or expired."
          );
          return new Response("OK", { headers: corsHeaders });
        }

        const { data: product } = await supabase.from("products").select("name").eq("id", link.product_id).single();
        let productName = product?.name || "Product";
        if (link.variation_id) {
          const { data: variation } = await supabase.from("product_variations").select("name").eq("id", link.variation_id).single();
          if (variation) productName += ` - ${variation.name}`;
        }

        const resaleLinkData = {
          resale_link_id: link.id,
          reseller_telegram_id: link.reseller_telegram_id || link.reseller_id || null,
          reseller_profit: link.custom_price - link.reseller_price,
        };

        await showPaymentInfo(RESALE_BOT_TOKEN, supabase, chatId, msg.from, productName, link.custom_price, link.product_id, link.variation_id, lang, resaleLinkData);

        const table = tgLink ? "telegram_resale_links" : "resale_links";
        await supabase.from(table).update({ uses: link.uses + 1 }).eq("id", link.id);

        return new Response("OK", { headers: corsHeaders });
      }

      await sendMessage(RESALE_BOT_TOKEN, chatId,
        lang === "bn"
          ? "🛍️ <b>রিসেল পার্চেজ বট</b>\n\nএই বটটি শুধুমাত্র রিসেল লিংকের মাধ্যমে পণ্য কেনার জন্য।\n\nঅনুগ্রহ করে একটি বৈধ রিসেল লিংক ব্যবহার করুন।"
          : "🛍️ <b>Resale Purchase Bot</b>\n\nThis bot is for purchasing products via resale links only.\n\nPlease use a valid resale link to proceed."
      );
      return new Response("OK", { headers: corsHeaders });
    }

    // ===== Check conversation state for screenshots =====
    const state = await getConversationState(supabase, userId);

    if (state?.step === "resale_awaiting_screenshot" && msg.photo) {
      await handleResaleScreenshot(RESALE_BOT_TOKEN, MAIN_BOT_TOKEN, supabase, chatId, userId, msg, state.data, lang);
      return new Response("OK", { headers: corsHeaders });
    }

    if (state?.step === "resale_awaiting_screenshot" && !msg.photo) {
      await sendMessage(RESALE_BOT_TOKEN, chatId,
        lang === "bn" ? "📸 অনুগ্রহ করে পেমেন্ট স্ক্রিনশট পাঠান (ছবি)।" : "📸 Please send the payment screenshot (photo)."
      );
      return new Response("OK", { headers: corsHeaders });
    }

    await sendMessage(RESALE_BOT_TOKEN, chatId,
      lang === "bn"
        ? "🛍️ এই বটটি শুধুমাত্র রিসেল লিংকের মাধ্যমে পণ্য কেনার জন্য।\n\nঅনুগ্রহ করে একটি বৈধ রিসেল লিংক ব্যবহার করুন।"
        : "🛍️ This bot is for purchasing via resale links only.\n\nPlease use a valid resale link to proceed."
    );

    return new Response("OK", { headers: corsHeaders });
  } catch (error) {
    console.error("Resale bot error:", error);
    return new Response("OK", { headers: corsHeaders });
  }
});
