import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const BOT_TOKEN = Deno.env.get("GIVEAWAY_BOT_TOKEN");

  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "GIVEAWAY_BOT_TOKEN not set" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const msg = body.message || body.callback_query?.message;
    const callbackQuery = body.callback_query;

    if (!msg && !callbackQuery) return new Response("OK", { headers: corsHeaders });

    const chatId = callbackQuery ? callbackQuery.message.chat.id : msg.chat.id;
    const userId = callbackQuery ? callbackQuery.from.id : msg.from.id;
    const text = msg?.text || "";
    const firstName = (callbackQuery?.from || msg?.from)?.first_name || "User";
    const username = (callbackQuery?.from || msg?.from)?.username || null;

    // Helper functions
    const sendMsg = async (chat: number, t: string, opts: any = {}) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: t, parse_mode: "HTML", ...opts }),
      });
    };

    const answerCallback = async (cbId: string, t = "") => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId, text: t }),
      });
    };

    const editMsg = async (chat: number, msgId: number, t: string, opts: any = {}) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, message_id: msgId, text: t, parse_mode: "HTML", ...opts }),
      });
    };

    // Get or create user points
    const getPoints = async (tgId: number) => {
      const { data } = await supabase.from("giveaway_points").select("*").eq("telegram_id", tgId).single();
      if (data) return data;
      const { data: newData } = await supabase.from("giveaway_points").insert({ telegram_id: tgId }).select().single();
      return newData;
    };

    // Get setting
    const getSetting = async (key: string) => {
      const { data } = await supabase.from("giveaway_settings").select("value").eq("key", key).single();
      return data?.value;
    };

    // ===== CALLBACK QUERIES =====
    if (callbackQuery) {
      const cbData = callbackQuery.data;
      await answerCallback(callbackQuery.id);

      if (cbData === "gw_products") {
        const { data: products } = await supabase
          .from("giveaway_products")
          .select("*, product:products(name, image_url), variation:product_variations(name)")
          .eq("is_active", true);

        if (!products || products.length === 0) {
          await editMsg(chatId, callbackQuery.message.message_id,
            "😔 <b>No giveaway products available right now.</b>\n\nCheck back later!", {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
          });
          return new Response("OK", { headers: corsHeaders });
        }

        let productText = "🎁 <b>Available Giveaway Products:</b>\n\n";
        const buttons: any[][] = [];
        for (const p of products) {
          const name = (p as any).product?.name || "Unknown";
          const varName = (p as any).variation?.name ? ` (${(p as any).variation.name})` : "";
          const stockText = p.stock !== null ? `📦 ${p.stock} left` : "📦 Unlimited";
          productText += `🏷️ <b>${name}${varName}</b>\n   🎯 ${p.points_required} points | ${stockText}\n\n`;
          buttons.push([{ text: `🎁 ${name}${varName} (${p.points_required} pts)`, callback_data: `gw_redeem_${p.id}` }]);
        }
        buttons.push([{ text: "🔙 Back", callback_data: "gw_main" }]);

        await editMsg(chatId, callbackQuery.message.message_id, productText, {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      else if (cbData?.startsWith("gw_redeem_")) {
        const productId = cbData.replace("gw_redeem_", "");
        const [userPoints, product] = await Promise.all([
          getPoints(userId),
          supabase.from("giveaway_products")
            .select("*, product:products(name), variation:product_variations(name)")
            .eq("id", productId).single().then(r => r.data),
        ]);

        if (!product || !product.is_active) {
          await editMsg(chatId, callbackQuery.message.message_id, "❌ This product is no longer available.");
          return new Response("OK", { headers: corsHeaders });
        }

        if (product.stock !== null && product.stock <= 0) {
          await editMsg(chatId, callbackQuery.message.message_id, "❌ This product is out of stock!");
          return new Response("OK", { headers: corsHeaders });
        }

        const pts = userPoints?.points || 0;
        if (pts < product.points_required) {
          const needed = product.points_required - pts;
          await editMsg(chatId, callbackQuery.message.message_id,
            `❌ <b>Not enough points!</b>\n\n🎯 Required: ${product.points_required} pts\n💰 Your points: ${pts} pts\n📌 Need ${needed} more points\n\n👥 Refer more friends to earn points!`, {
            reply_markup: { inline_keyboard: [[{ text: "📎 Get Referral Link", callback_data: "gw_referral" }, { text: "🔙 Back", callback_data: "gw_products" }]] }
          });
          return new Response("OK", { headers: corsHeaders });
        }

        const name = (product as any).product?.name || "Unknown";
        const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";
        await editMsg(chatId, callbackQuery.message.message_id,
          `🎁 <b>Confirm Redeem?</b>\n\n🏷️ ${name}${varName}\n🎯 Cost: ${product.points_required} pts\n💰 Your balance: ${pts} pts\n\nAfter redeem: ${pts - product.points_required} pts`, {
          reply_markup: { inline_keyboard: [
            [{ text: "✅ Confirm", callback_data: `gw_confirm_${productId}` }],
            [{ text: "❌ Cancel", callback_data: "gw_products" }],
          ]}
        });
      }

      else if (cbData?.startsWith("gw_confirm_")) {
        const productId = cbData.replace("gw_confirm_", "");
        const [userPoints, product] = await Promise.all([
          getPoints(userId),
          supabase.from("giveaway_products")
            .select("*, product:products(name), variation:product_variations(name)")
            .eq("id", productId).single().then(r => r.data),
        ]);

        if (!product || !product.is_active) {
          await editMsg(chatId, callbackQuery.message.message_id, "❌ Product no longer available.");
          return new Response("OK", { headers: corsHeaders });
        }

        const pts = userPoints?.points || 0;
        if (pts < product.points_required) {
          await editMsg(chatId, callbackQuery.message.message_id, "❌ Not enough points!");
          return new Response("OK", { headers: corsHeaders });
        }

        // Deduct points
        await supabase.from("giveaway_points")
          .update({ points: pts - product.points_required, updated_at: new Date().toISOString() })
          .eq("telegram_id", userId);

        // Reduce stock
        if (product.stock !== null) {
          await supabase.from("giveaway_products")
            .update({ stock: product.stock - 1, updated_at: new Date().toISOString() })
            .eq("id", productId);
        }

        // Create redemption request
        await supabase.from("giveaway_redemptions").insert({
          telegram_id: userId,
          giveaway_product_id: productId,
          points_spent: product.points_required,
          status: "pending",
        });

        const name = (product as any).product?.name || "Unknown";
        const varName = (product as any).variation?.name ? ` (${(product as any).variation.name})` : "";
        await editMsg(chatId, callbackQuery.message.message_id,
          `✅ <b>Redemption Request Submitted!</b>\n\n🏷️ ${name}${varName}\n🎯 Points spent: ${product.points_required}\n💰 Remaining: ${pts - product.points_required} pts\n\n⏳ Admin will review and deliver your product soon!`, {
          reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "gw_main" }]] }
        });

        // Notify admins
        const { data: admins } = await supabase.from("telegram_bot_admins").select("telegram_id");
        const MAIN_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const notifyToken = MAIN_BOT_TOKEN || BOT_TOKEN;
        for (const admin of (admins || [])) {
          try {
            await fetch(`https://api.telegram.org/bot${notifyToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: admin.telegram_id,
                text: `🎁 <b>New Giveaway Redemption!</b>\n\n👤 ${firstName} ${username ? `(@${username})` : ""}\n🆔 <code>${userId}</code>\n🏷️ ${name}${varName}\n🎯 ${product.points_required} pts\n\n📱 Check Admin Panel → Giveaway Bot → Redemptions`,
                parse_mode: "HTML",
              }),
            });
          } catch {}
        }
      }

      else if (cbData === "gw_referral") {
        const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
        const botUsername = botInfo.result?.username || "giveaway_bot";
        const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
        const points = await getPoints(userId);

        await editMsg(chatId, callbackQuery.message.message_id,
          `📎 <b>Your Referral Link:</b>\n\n<code>${refLink}</code>\n\n👆 ক্লিক করে কপি করো এবং বন্ধুদের শেয়ার করো!\n\n💰 <b>Your Points:</b> ${points?.points || 0}\n👥 <b>Total Referrals:</b> ${points?.total_referrals || 0}\n\n🎯 প্রতি রেফারে পয়েন্ট পাবে!`, {
          reply_markup: { inline_keyboard: [
            [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join this giveaway bot and win free products!")}` }],
            [{ text: "🔙 Back", callback_data: "gw_main" }],
          ]}
        });
      }

      else if (cbData === "gw_points") {
        const points = await getPoints(userId);
        await editMsg(chatId, callbackQuery.message.message_id,
          `💰 <b>Your Points</b>\n\n🎯 Points: <b>${points?.points || 0}</b>\n👥 Total Referrals: <b>${points?.total_referrals || 0}</b>\n\n📎 Share your referral link to earn more!`, {
          reply_markup: { inline_keyboard: [
            [{ text: "📎 Referral Link", callback_data: "gw_referral" }],
            [{ text: "🔙 Back", callback_data: "gw_main" }],
          ]}
        });
      }

      else if (cbData === "gw_main") {
        await editMsg(chatId, callbackQuery.message.message_id,
          `🎁 <b>Giveaway Bot</b>\n\nWelcome, <b>${firstName}</b>!\n\n👥 Refer friends → Earn points → Win products!\n\nSelect an option:`, {
          reply_markup: { inline_keyboard: [
            [{ text: "🎁 Products", callback_data: "gw_products" }, { text: "💰 My Points", callback_data: "gw_points" }],
            [{ text: "📎 Referral Link", callback_data: "gw_referral" }],
            [{ text: "📜 My Redemptions", callback_data: "gw_history" }],
          ]}
        });
      }

      else if (cbData === "gw_history") {
        const { data: redeems } = await supabase
          .from("giveaway_redemptions")
          .select("*, giveaway_product:giveaway_products(product:products(name))")
          .eq("telegram_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        let histText = "📜 <b>Your Redemptions:</b>\n\n";
        if (!redeems || redeems.length === 0) {
          histText += "No redemptions yet. Start earning points!";
        } else {
          for (const r of redeems) {
            const name = (r as any).giveaway_product?.product?.name || "Unknown";
            const statusIcon = r.status === "approved" ? "✅" : r.status === "rejected" ? "❌" : "⏳";
            histText += `${statusIcon} <b>${name}</b> — ${r.points_spent} pts (${r.status})\n`;
          }
        }

        await editMsg(chatId, callbackQuery.message.message_id, histText, {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "gw_main" }]] }
        });
      }

      return new Response("OK", { headers: corsHeaders });
    }

    // ===== TEXT COMMANDS =====
    if (text.startsWith("/start")) {
      const args = text.split(" ")[1] || "";

      // Handle referral
      if (args.startsWith("ref_")) {
        const referrerId = parseInt(args.replace("ref_", ""));
        if (referrerId && referrerId !== userId) {
          // Check if already referred
          const { data: existing } = await supabase
            .from("giveaway_referrals")
            .select("id")
            .eq("referred_telegram_id", userId)
            .single();

          if (!existing) {
            const ppr = parseInt(await getSetting("points_per_referral") || "2");

            // Record referral
            await supabase.from("giveaway_referrals").insert({
              referrer_telegram_id: referrerId,
              referred_telegram_id: userId,
              points_awarded: ppr,
            });

            // Award points
            const referrerPoints = await getPoints(referrerId);
            await supabase.from("giveaway_points")
              .update({
                points: (referrerPoints?.points || 0) + ppr,
                total_referrals: (referrerPoints?.total_referrals || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("telegram_id", referrerId);

            // Notify referrer
            try {
              await sendMsg(referrerId,
                `🎉 <b>New Referral!</b>\n\n👤 <b>${firstName}</b> joined through your link!\n🎯 +${ppr} points added!\n\nKeep referring to earn more!`
              );
            } catch {}
          }
        }
      }

      // Ensure user has points record
      await getPoints(userId);

      await sendMsg(chatId,
        `🎁 <b>Giveaway Bot</b>\n\nWelcome, <b>${firstName}</b>!\n\n👥 Refer friends → Earn points → Win products!\n\nSelect an option:`, {
        reply_markup: { inline_keyboard: [
          [{ text: "🎁 Products", callback_data: "gw_products" }, { text: "💰 My Points", callback_data: "gw_points" }],
          [{ text: "📎 Referral Link", callback_data: "gw_referral" }],
          [{ text: "📜 My Redemptions", callback_data: "gw_history" }],
        ]}
      });
    }

    else if (text === "/points" || text === "/balance") {
      const points = await getPoints(userId);
      await sendMsg(chatId,
        `💰 <b>Your Points:</b> ${points?.points || 0}\n👥 <b>Total Referrals:</b> ${points?.total_referrals || 0}`, {
        reply_markup: { inline_keyboard: [[{ text: "📎 Referral Link", callback_data: "gw_referral" }]] }
      });
    }

    else if (text === "/refer" || text === "/referral") {
      const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
      const botUsername = botInfo.result?.username || "giveaway_bot";
      const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
      await sendMsg(chatId,
        `📎 <b>Your Referral Link:</b>\n\n<code>${refLink}</code>\n\n👆 ক্লিক করে কপি করো!`, {
        reply_markup: { inline_keyboard: [
          [{ text: "📤 Share", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("🎁 Join and win free products!")}` }],
        ]}
      });
    }

    else if (text === "/menu" || text === "/help") {
      await sendMsg(chatId,
        `🎁 <b>Giveaway Bot</b>\n\nSelect an option:`, {
        reply_markup: { inline_keyboard: [
          [{ text: "🎁 Products", callback_data: "gw_products" }, { text: "💰 My Points", callback_data: "gw_points" }],
          [{ text: "📎 Referral Link", callback_data: "gw_referral" }],
          [{ text: "📜 My Redemptions", callback_data: "gw_history" }],
        ]}
      });
    }

    return new Response("OK", { headers: corsHeaders });
  } catch (err) {
    console.error("Giveaway bot error:", err);
    return new Response("OK", { headers: corsHeaders });
  }
});
