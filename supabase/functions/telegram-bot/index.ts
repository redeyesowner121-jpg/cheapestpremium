import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_ID = 6898461453;

function isAdmin(userId: number): boolean {
  return userId === SUPER_ADMIN_ID;
}

const TELEGRAM_API = (token: string) =>
  `https://api.telegram.org/bot${token}`;

// In-memory conversation state for /add_product multi-step flow
const conversationState = new Map<number, { step: string; data: Record<string, any> }>();

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  opts?: { reply_markup?: any; parse_mode?: string }
) {
  const res = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode || "HTML",
      ...(opts?.reply_markup && { reply_markup: opts.reply_markup }),
    }),
  });
  return res.json();
}

async function sendPhoto(
  token: string,
  chatId: number,
  photoUrl: string,
  caption: string,
  replyMarkup?: any
) {
  await fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup }),
    }),
  });
}

async function forwardMessage(token: string, chatId: number, fromChatId: number, messageId: number) {
  await fetch(`${TELEGRAM_API(token)}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    }),
  });
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "",
    }),
  });
}

async function getSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  data?.forEach((s: any) => (settings[s.key] = s.value));
  return settings;
}

// Upsert user into telegram_bot_users
async function upsertTelegramUser(supabase: any, user: any) {
  await supabase.from("telegram_bot_users").upsert(
    {
      telegram_id: user.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      last_active: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );
}

// Check if user is banned
async function isBanned(supabase: any, telegramId: number): Promise<boolean> {
  const { data } = await supabase
    .from("telegram_bot_users")
    .select("is_banned")
    .eq("telegram_id", telegramId)
    .single();
  return data?.is_banned === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!BOT_TOKEN) {
    return new Response("Bot token not configured", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const update = await req.json();

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const telegramUser = callbackQuery.from;
      const userId = telegramUser.id;

      // Check ban
      if (await isBanned(supabase, userId)) {
        await answerCallbackQuery(BOT_TOKEN, callbackQuery.id);
        return jsonOk();
      }

      await upsertTelegramUser(supabase, telegramUser);
      await answerCallbackQuery(BOT_TOKEN, callbackQuery.id);

      // Admin action buttons
      if (data.startsWith("admin_confirm_")) {
        if (!isAdmin(userId)) return jsonOk();
        const orderId = data.replace("admin_confirm_", "");
        await handleAdminAction(BOT_TOKEN, supabase, orderId, "confirmed", chatId);
      } else if (data.startsWith("admin_reject_")) {
        if (!isAdmin(userId)) return jsonOk();
        const orderId = data.replace("admin_reject_", "");
        await handleAdminAction(BOT_TOKEN, supabase, orderId, "rejected", chatId);
      } else if (data.startsWith("admin_ship_")) {
        if (!isAdmin(userId)) return jsonOk();
        const orderId = data.replace("admin_ship_", "");
        await handleAdminAction(BOT_TOKEN, supabase, orderId, "shipped", chatId);
      } else if (data === "view_products") {
        await handleViewProducts(BOT_TOKEN, supabase, chatId);
      } else if (data === "refer_earn") {
        await handleReferEarn(BOT_TOKEN, supabase, chatId);
      } else if (data === "my_wallet") {
        await handleMyWallet(BOT_TOKEN, supabase, chatId, telegramUser);
      } else if (data === "support") {
        await handleSupport(BOT_TOKEN, supabase, chatId);
      } else if (data === "get_offers") {
        await handleGetOffers(BOT_TOKEN, supabase, chatId);
      } else if (data.startsWith("cat_")) {
        const category = decodeURIComponent(data.replace("cat_", ""));
        await handleCategoryProducts(BOT_TOKEN, supabase, chatId, category);
      } else if (data.startsWith("product_")) {
        const productId = data.replace("product_", "");
        await handleProductDetail(BOT_TOKEN, supabase, chatId, productId);
      } else if (data.startsWith("buy_")) {
        const productId = data.replace("buy_", "");
        await handleBuyProduct(BOT_TOKEN, supabase, chatId, productId, telegramUser);
      } else if (data === "back_main") {
        await handleStart(BOT_TOKEN, supabase, chatId);
      } else if (data === "back_products") {
        await handleViewProducts(BOT_TOKEN, supabase, chatId);
      }

      return jsonOk();
    }

    // Handle text messages
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const telegramUser = msg.from;
      const userId = telegramUser.id;
      const text = msg.text || "";

      // Check ban (silently ignore)
      if (await isBanned(supabase, userId)) {
        return jsonOk();
      }

      // Upsert user
      await upsertTelegramUser(supabase, telegramUser);

      // Check if in conversation state (add_product flow or broadcast)
      if (conversationState.has(userId)) {
        await handleConversationStep(BOT_TOKEN, supabase, chatId, userId, msg);
        return jsonOk();
      }

      // Commands
      if (text.startsWith("/")) {
        const parts = text.split(" ");
        const command = parts[0].toLowerCase().split("@")[0]; // handle @botname

        switch (command) {
          case "/start":
            await handleStart(BOT_TOKEN, supabase, chatId);
            break;
          case "/products":
          case "/categories":
            await handleViewProducts(BOT_TOKEN, supabase, chatId);
            break;
          case "/help":
            await sendMessage(BOT_TOKEN, chatId,
              `📖 <b>Commands:</b>\n\n` +
              `/start - Main menu\n` +
              `/products - View products\n` +
              `/help - Show this help`
            );
            break;
          // Admin commands
          case "/admin":
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            await handleAdminMenu(BOT_TOKEN, supabase, chatId);
            break;
          case "/broadcast":
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            await handleBroadcastStart(BOT_TOKEN, chatId, userId);
            break;
          case "/report":
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            await handleReport(BOT_TOKEN, supabase, chatId);
            break;
          case "/add_product":
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            await handleAddProductStart(BOT_TOKEN, chatId, userId);
            break;
          case "/edit_price": {
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            const args = text.substring("/edit_price".length).trim();
            await handleEditPrice(BOT_TOKEN, supabase, chatId, args);
            break;
          }
          case "/out_stock": {
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            const productName = text.substring("/out_stock".length).trim();
            await handleOutStock(BOT_TOKEN, supabase, chatId, productName);
            break;
          }
          case "/users":
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            await handleUsersCommand(BOT_TOKEN, supabase, chatId);
            break;
          case "/history": {
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            const tgId = parts[1] ? parseInt(parts[1]) : 0;
            await handleHistoryCommand(BOT_TOKEN, supabase, chatId, tgId);
            break;
          }
          case "/ban": {
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            const banId = parts[1] ? parseInt(parts[1]) : 0;
            await handleBanCommand(BOT_TOKEN, supabase, chatId, banId, true);
            break;
          }
          case "/unban": {
            if (!isAdmin(userId)) { await sendAccessDenied(BOT_TOKEN, chatId); break; }
            const unbanId = parts[1] ? parseInt(parts[1]) : 0;
            await handleBanCommand(BOT_TOKEN, supabase, chatId, unbanId, false);
            break;
          }
          default:
            // Unknown command from non-admin, ignore
            break;
        }
        return jsonOk();
      }

      // Non-command message from non-admin user → forward to admin
      if (!isAdmin(userId)) {
        await forwardUserMessageToAdmin(BOT_TOKEN, supabase, msg, telegramUser);
      }

      return jsonOk();
    }

    return jsonOk();
  } catch (error) {
    console.error("Telegram bot error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonOk() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendAccessDenied(token: string, chatId: number) {
  await sendMessage(token, chatId, "🚫 <b>Access Denied.</b> You are not authorized.");
}

// ===== ADMIN ACTION HANDLER (Confirm/Reject/Ship) =====

async function handleAdminAction(
  token: string,
  supabase: any,
  orderId: string,
  newStatus: string,
  adminChatId: number
) {
  const { data: order } = await supabase
    .from("telegram_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) {
    await sendMessage(token, adminChatId, "❌ Order not found.");
    return;
  }

  // Update order status
  await supabase
    .from("telegram_orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  // Send message to customer
  const customerMessages: Record<string, string> = {
    confirmed: "✅ <b>Payment Verified!</b>\n\nYour payment has been verified. Order confirmed! Your product will be delivered shortly. ⚡",
    rejected: "❌ <b>Payment Not Verified</b>\n\nYour payment could not be verified. Please contact support if you believe this is an error.",
    shipped: "📦 <b>Order Shipped!</b>\n\nYour product has been dispatched! It will reach you soon. Thank you for your purchase! 🎉",
  };

  await sendMessage(token, order.telegram_user_id, customerMessages[newStatus] || "Order updated.");

  // Notify admin
  const statusEmoji: Record<string, string> = { confirmed: "✅", rejected: "❌", shipped: "📦" };
  await sendMessage(token, adminChatId,
    `${statusEmoji[newStatus] || "📋"} Order <b>${orderId.slice(0, 8)}</b> marked as <b>${newStatus.toUpperCase()}</b>.`
  );
}

// ===== FORWARD USER MESSAGE TO ADMIN =====

async function forwardUserMessageToAdmin(
  token: string,
  supabase: any,
  msg: any,
  telegramUser: any
) {
  const userId = telegramUser.id;
  const username = telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name || "Unknown";

  // Forward the original message to admin
  await forwardMessage(token, SUPER_ADMIN_ID, msg.chat.id, msg.message_id);

  // Create telegram order record
  const { data: order } = await supabase
    .from("telegram_orders")
    .insert({
      telegram_user_id: userId,
      username: username,
      product_name: msg.text || (msg.photo ? "Screenshot/Photo" : "Message"),
      amount: 0,
      status: "pending",
      screenshot_file_id: msg.photo ? msg.photo[msg.photo.length - 1]?.file_id : null,
    })
    .select("id")
    .single();

  const orderId = order?.id || "unknown";

  // Send admin info header with action buttons
  await sendMessage(token, SUPER_ADMIN_ID,
    `📩 <b>New message from customer</b>\n\n` +
    `👤 From: <b>${username}</b>\n` +
    `🆔 ID: <code>${userId}</code>\n` +
    `📋 Order: <code>${orderId.slice(0, 8)}</code>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm Order", callback_data: `admin_confirm_${orderId}` },
            { text: "❌ Reject/Fake", callback_data: `admin_reject_${orderId}` },
          ],
          [
            { text: "📦 Shipped", callback_data: `admin_ship_${orderId}` },
          ],
        ],
      },
    }
  );
}

// ===== ADMIN MENU =====

async function handleAdminMenu(token: string, supabase: any, chatId: number) {
  const { count: userCount } = await supabase
    .from("telegram_bot_users")
    .select("*", { count: "exact", head: true });

  const { count: orderCount } = await supabase
    .from("telegram_orders")
    .select("*", { count: "exact", head: true });

  await sendMessage(token, chatId,
    `🔐 <b>Admin Control Panel</b>\n\n` +
    `👥 Total Bot Users: <b>${userCount || 0}</b>\n` +
    `📦 Total Orders: <b>${orderCount || 0}</b>\n\n` +
    `<b>Available Commands:</b>\n` +
    `/broadcast - Send message to all users\n` +
    `/report - Sales & analytics report\n` +
    `/add_product - Add new product\n` +
    `/edit_price [name] [price] - Update price\n` +
    `/out_stock [name] - Mark out of stock\n` +
    `/users - View user stats\n` +
    `/history [telegram_id] - User order history\n` +
    `/ban [telegram_id] - Ban a user\n` +
    `/unban [telegram_id] - Unban a user`
  );
}

// ===== BROADCAST =====

async function handleBroadcastStart(token: string, chatId: number, userId: number) {
  conversationState.set(userId, { step: "broadcast_message", data: {} });
  await sendMessage(token, chatId,
    "📢 <b>Broadcast Mode</b>\n\nSend me the message (text or photo with caption) you want to broadcast to all users.\n\nSend /cancel to cancel."
  );
}

async function executeBroadcast(token: string, supabase: any, adminChatId: number, msg: any) {
  const { data: users } = await supabase
    .from("telegram_bot_users")
    .select("telegram_id")
    .eq("is_banned", false);

  if (!users?.length) {
    await sendMessage(token, adminChatId, "No users to broadcast to.");
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      if (user.telegram_id === SUPER_ADMIN_ID) { sent++; continue; }

      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        await sendPhoto(token, user.telegram_id, photo.file_id, msg.caption || "");
      } else if (msg.text) {
        await sendMessage(token, user.telegram_id, msg.text);
      }
      sent++;
    } catch {
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }

  await sendMessage(token, adminChatId,
    `📢 <b>Broadcast Complete!</b>\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}`
  );
}

// ===== REPORT =====

async function handleReport(token: string, supabase: any, chatId: number) {
  const { count: totalUsers } = await supabase
    .from("telegram_bot_users")
    .select("*", { count: "exact", head: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayOrders, count: todayOrderCount } = await supabase
    .from("telegram_orders")
    .select("*", { count: "exact" })
    .gte("created_at", today.toISOString());

  const { data: confirmedToday } = await supabase
    .from("telegram_orders")
    .select("amount")
    .eq("status", "confirmed")
    .gte("created_at", today.toISOString());

  const todayRevenue = confirmedToday?.reduce((sum: number, o: any) => sum + (o.amount || 0), 0) || 0;

  const { count: allTimeOrders } = await supabase
    .from("telegram_orders")
    .select("*", { count: "exact", head: true });

  const { data: allConfirmed } = await supabase
    .from("telegram_orders")
    .select("amount")
    .eq("status", "confirmed");

  const allTimeRevenue = allConfirmed?.reduce((sum: number, o: any) => sum + (o.amount || 0), 0) || 0;

  await sendMessage(token, chatId,
    `📊 <b>Sales Report</b>\n\n` +
    `👥 Total Registered Users: <b>${totalUsers || 0}</b>\n\n` +
    `📅 <b>Today:</b>\n` +
    `• Orders: ${todayOrderCount || 0}\n` +
    `• Confirmed Revenue: ₹${todayRevenue}\n\n` +
    `📈 <b>All Time:</b>\n` +
    `• Total Orders: ${allTimeOrders || 0}\n` +
    `• Confirmed Revenue: ₹${allTimeRevenue}`
  );
}

// ===== ADD PRODUCT FLOW =====

async function handleAddProductStart(token: string, chatId: number, userId: number) {
  conversationState.set(userId, { step: "add_photo", data: {} });
  await sendMessage(token, chatId,
    "📸 <b>Add New Product (Step 1/4)</b>\n\nSend the product photo.\n\nSend /cancel to cancel."
  );
}

async function handleConversationStep(token: string, supabase: any, chatId: number, userId: number, msg: any) {
  const state = conversationState.get(userId)!;
  const text = msg.text || "";

  // Cancel
  if (text === "/cancel") {
    conversationState.delete(userId);
    await sendMessage(token, chatId, "❌ Cancelled.");
    return;
  }

  // Broadcast flow
  if (state.step === "broadcast_message") {
    conversationState.delete(userId);
    await executeBroadcast(token, supabase, chatId, msg);
    return;
  }

  // Add product flow
  switch (state.step) {
    case "add_photo": {
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        // Get file URL
        const fileRes = await fetch(`${TELEGRAM_API(token)}/getFile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: photo.file_id }),
        });
        const fileData = await fileRes.json();
        const filePath = fileData.result?.file_path;
        const imageUrl = filePath ? `https://api.telegram.org/file/bot${token}/${filePath}` : "";
        
        state.data.image_url = imageUrl;
        state.data.file_id = photo.file_id;
        state.step = "add_name";
        await sendMessage(token, chatId, "✅ Photo received!\n\n📝 <b>Step 2/4:</b> Enter the product name.");
      } else {
        await sendMessage(token, chatId, "⚠️ Please send a photo.");
      }
      break;
    }
    case "add_name": {
      state.data.name = text;
      state.step = "add_price";
      await sendMessage(token, chatId, `✅ Name: <b>${text}</b>\n\n💰 <b>Step 3/4:</b> Enter the price (number only).`);
      break;
    }
    case "add_price": {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        await sendMessage(token, chatId, "⚠️ Please enter a valid price (positive number).");
        break;
      }
      state.data.price = price;
      state.step = "add_category";
      await sendMessage(token, chatId, `✅ Price: ₹${price}\n\n📂 <b>Step 4/4:</b> Enter the category name.`);
      break;
    }
    case "add_category": {
      state.data.category = text;
      conversationState.delete(userId);

      // Generate slug
      const slug = state.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      // Save product
      const { data: product, error } = await supabase.from("products").insert({
        name: state.data.name,
        price: state.data.price,
        category: text,
        slug: slug + "-" + Date.now(),
        image_url: state.data.image_url || null,
        is_active: true,
      }).select("id").single();

      if (error) {
        await sendMessage(token, chatId, `❌ Failed to add product: ${error.message}`);
      } else {
        await sendMessage(token, chatId,
          `✅ <b>Product Added!</b>\n\n` +
          `📦 Name: ${state.data.name}\n` +
          `💰 Price: ₹${state.data.price}\n` +
          `📂 Category: ${text}\n` +
          `🆔 ID: <code>${product.id}</code>`
        );
      }
      break;
    }
  }
}

// ===== EDIT PRICE =====

async function handleEditPrice(token: string, supabase: any, chatId: number, args: string) {
  // Format: /edit_price ProductName NewPrice
  const lastSpaceIdx = args.lastIndexOf(" ");
  if (lastSpaceIdx === -1) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Product Name 199</code>");
    return;
  }

  const productName = args.substring(0, lastSpaceIdx).trim();
  const newPrice = parseFloat(args.substring(lastSpaceIdx + 1));

  if (!productName || isNaN(newPrice) || newPrice <= 0) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/edit_price Product Name 199</code>");
    return;
  }

  const { data, error } = await supabase
    .from("products")
    .update({ price: newPrice, updated_at: new Date().toISOString() })
    .ilike("name", `%${productName}%`)
    .select("id, name, price");

  if (error || !data?.length) {
    await sendMessage(token, chatId, `❌ Product "${productName}" not found.`);
  } else {
    await sendMessage(token, chatId,
      `✅ Price updated!\n\n📦 ${data[0].name}\n💰 New Price: ₹${newPrice}`
    );
  }
}

// ===== OUT OF STOCK =====

async function handleOutStock(token: string, supabase: any, chatId: number, productName: string) {
  if (!productName) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/out_stock Product Name</code>");
    return;
  }

  const { data, error } = await supabase
    .from("products")
    .update({ stock: 0, is_active: false, updated_at: new Date().toISOString() })
    .ilike("name", `%${productName}%`)
    .select("id, name");

  if (error || !data?.length) {
    await sendMessage(token, chatId, `❌ Product "${productName}" not found.`);
  } else {
    await sendMessage(token, chatId,
      `✅ Marked as Out of Stock!\n\n📦 ${data[0].name}\n❌ Stock: 0 | Inactive`
    );
  }
}

// ===== USERS COMMAND =====

async function handleUsersCommand(token: string, supabase: any, chatId: number) {
  const { count: totalUsers } = await supabase
    .from("telegram_bot_users")
    .select("*", { count: "exact", head: true });

  const { data: recentUsers } = await supabase
    .from("telegram_bot_users")
    .select("telegram_id, username, first_name, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  let text = `👥 <b>Bot Users</b>\n\nTotal: <b>${totalUsers || 0}</b>\n\n<b>Recent signups:</b>\n`;

  recentUsers?.forEach((u: any) => {
    const name = u.username ? `@${u.username}` : u.first_name || "Unknown";
    const date = new Date(u.created_at).toLocaleDateString();
    text += `• ${name} (${u.telegram_id}) - ${date}\n`;
  });

  await sendMessage(token, chatId, text);
}

// ===== HISTORY COMMAND =====

async function handleHistoryCommand(token: string, supabase: any, chatId: number, telegramId: number) {
  if (!telegramId) {
    await sendMessage(token, chatId, "⚠️ Usage: <code>/history 123456789</code>");
    return;
  }

  const { data: orders } = await supabase
    .from("telegram_orders")
    .select("*")
    .eq("telegram_user_id", telegramId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!orders?.length) {
    await sendMessage(token, chatId, `No orders found for user ${telegramId}.`);
    return;
  }

  let text = `📜 <b>Order History for ${telegramId}</b>\n\n`;
  orders.forEach((o: any, i: number) => {
    const status = { pending: "⏳", confirmed: "✅", rejected: "❌", shipped: "📦" }[o.status] || "📋";
    const date = new Date(o.created_at).toLocaleDateString();
    text += `${i + 1}. ${status} ${o.product_name || "N/A"} - ₹${o.amount} (${date})\n`;
  });

  await sendMessage(token, chatId, text);
}

// ===== BAN/UNBAN =====

async function handleBanCommand(token: string, supabase: any, chatId: number, telegramId: number, ban: boolean) {
  if (!telegramId) {
    await sendMessage(token, chatId, `⚠️ Usage: <code>/${ban ? "ban" : "unban"} 123456789</code>`);
    return;
  }

  const { error } = await supabase
    .from("telegram_bot_users")
    .update({ is_banned: ban })
    .eq("telegram_id", telegramId);

  if (error) {
    await sendMessage(token, chatId, `❌ User ${telegramId} not found.`);
  } else {
    await sendMessage(token, chatId,
      ban
        ? `🚫 User <code>${telegramId}</code> has been <b>BANNED</b>.`
        : `✅ User <code>${telegramId}</code> has been <b>UNBANNED</b>.`
    );
  }
}

// ===== EXISTING HANDLERS (preserved) =====

async function handleStart(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  const welcomeText = `<b>${appName}</b>\n\nWhat we offer:\n- Premium subscriptions\n- Instant delivery\n- 24/7 support\n- Secure payments (UPI)\n\nSelect an option below to get started:`;

  await sendMessage(token, chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍️ View Products", callback_data: "view_products" }],
        [
          { text: "🎁 Refer & Earn", callback_data: "refer_earn" },
          { text: "💰 My Wallet", callback_data: "my_wallet" },
        ],
        [
          { text: "⭐ Reviews ↗", url: appUrl },
          { text: "📞 Support ↗", callback_data: "support" },
        ],
        [{ text: "🔥 Get Offers ↗", callback_data: "get_offers" }],
      ],
    },
  });
}

async function handleViewProducts(token: string, supabase: any, chatId: number) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category")
    .eq("is_active", true)
    .order("sold_count", { ascending: false });

  if (!products?.length) {
    await sendMessage(token, chatId, "😔 No products available right now.", {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back_main" }]],
      },
    });
    return;
  }

  const settings = await getSettings(supabase);
  const appName = settings.app_name || "RKR Premium Store";

  let text = `<b>${appName} – Product Catalog</b>\n\nChoose from our premium digital products:\n\n<i>All products come with instant delivery and 24/7 support</i>`;

  const productButtons: any[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    const row: any[] = [
      { text: products[i].name, callback_data: `product_${products[i].id}` },
    ];
    if (products[i + 1]) {
      row.push({ text: products[i + 1].name, callback_data: `product_${products[i + 1].id}` });
    }
    productButtons.push(row);
  }

  productButtons.push([
    { text: "🎁 Refer & Earn", callback_data: "refer_earn" },
    { text: "💰 My Wallet", callback_data: "my_wallet" },
  ]);
  productButtons.push([
    { text: "⭐ Reviews ↗", url: settings.app_url || "https://cheapest-premiums.lovable.app" },
    { text: "📞 Support ↗", callback_data: "support" },
  ]);
  productButtons.push([{ text: "🔥 Get Offers ↗", callback_data: "get_offers" }]);

  await sendMessage(token, chatId, text, {
    reply_markup: { inline_keyboard: productButtons },
  });
}

async function handleCategoryProducts(token: string, supabase: any, chatId: number, category: string) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, original_price, image_url, stock, description")
    .eq("is_active", true)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!products?.length) {
    await sendMessage(token, chatId, `No products found in <b>${category}</b>.`, {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Back to Products", callback_data: "view_products" }]],
      },
    });
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  for (const p of products) {
    const priceText = p.original_price && p.original_price > p.price
      ? `<s>${currency}${p.original_price}</s> ${currency}${p.price}`
      : `${currency}${p.price}`;
    const stockText = p.stock !== null && p.stock <= 0 ? "\n❌ Out of Stock" : "";
    const caption = `<b>${p.name}</b>\n💰 ${priceText}${stockText}`;
    const buttons: any[][] = [];
    if (p.stock === null || p.stock > 0) {
      buttons.push([
        { text: "📋 Details", callback_data: `product_${p.id}` },
        { text: "🛒 Buy Now", callback_data: `buy_${p.id}` },
      ]);
    } else {
      buttons.push([{ text: "📋 Details", callback_data: `product_${p.id}` }]);
    }
    if (p.image_url) {
      await sendPhoto(token, chatId, p.image_url, caption, { inline_keyboard: buttons });
    } else {
      await sendMessage(token, chatId, caption, { reply_markup: { inline_keyboard: buttons } });
    }
  }

  await sendMessage(token, chatId, "⬇️", {
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Back to Products", callback_data: "view_products" }]],
    },
  });
}

async function handleProductDetail(token: string, supabase: any, chatId: number, productId: string) {
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (!product) {
    await sendMessage(token, chatId, "Product not found.");
    return;
  }

  const { data: variations } = await supabase
    .from("product_variations")
    .select("id, name, price, original_price")
    .eq("product_id", productId)
    .eq("is_active", true);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  const priceText = product.original_price && product.original_price > product.price
    ? `<s>${currency}${product.original_price}</s> ${currency}${product.price}`
    : `${currency}${product.price}`;

  let text = `<b>${product.name}</b>\n\n`;
  if (product.description) text += `${product.description}\n\n`;
  text += `💰 Price: ${priceText}\n`;
  text += `⭐ Rating: ${product.rating || "N/A"}\n`;
  text += `📦 Sold: ${product.sold_count || 0}\n`;
  if (product.stock !== null) {
    text += `📊 Stock: ${product.stock > 0 ? product.stock : "Out of Stock"}\n`;
  }
  if (variations?.length) {
    text += `\n<b>📋 Variations:</b>\n`;
    variations.forEach((v: any) => {
      const vPrice = v.original_price && v.original_price > v.price
        ? `<s>${currency}${v.original_price}</s> ${currency}${v.price}`
        : `${currency}${v.price}`;
      text += `• ${v.name}: ${vPrice}\n`;
    });
  }

  const buttons: any[][] = [];
  if (product.stock === null || product.stock > 0) {
    buttons.push([{ text: "🛒 Buy Now", callback_data: `buy_${productId}` }]);
  }
  buttons.push([{ text: "⬅️ Back to Products", callback_data: "view_products" }]);

  if (product.image_url) {
    await sendPhoto(token, chatId, product.image_url, text, { inline_keyboard: buttons });
  } else {
    await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
  }
}

async function handleBuyProduct(token: string, supabase: any, chatId: number, productId: string, telegramUser: any) {
  const { data: product } = await supabase
    .from("products")
    .select("name, price, stock")
    .eq("id", productId)
    .single();

  if (!product) {
    await sendMessage(token, chatId, "❌ Product not found.");
    return;
  }
  if (product.stock !== null && product.stock <= 0) {
    await sendMessage(token, chatId, "❌ Sorry, this product is out of stock.");
    return;
  }

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const whatsapp = settings.contact_whatsapp || "+918900684167";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";
  const binanceId = settings.binance_id || "";
  const paymentLink = settings.payment_link || "";

  const userName = telegramUser?.first_name || "User";
  const whatsappMsg = encodeURIComponent(
    `Hi! I want to buy "${product.name}" (${currency}${product.price}) from Telegram.\nName: ${userName}\nTelegram ID: ${telegramUser?.id || "N/A"}`
  );

  let paymentText = `🛒 <b>Order: ${product.name}</b>\n\n💰 Price: <b>${currency}${product.price}</b>\n\n`;
  paymentText += `<b>💳 Payment Methods:</b>\n\n`;
  paymentText += `📱 <b>UPI Payment:</b>\n`;
  if (paymentLink) paymentText += `🔗 Payment Link: ${paymentLink}\n`;
  paymentText += `\n`;
  if (binanceId) {
    paymentText += `🪙 <b>Binance Pay:</b>\nBinance ID: <code>${binanceId}</code>\n\n`;
  }
  paymentText += `<b>📝 How to order:</b>\n`;
  paymentText += `1️⃣ Pay using any method above\n`;
  paymentText += `2️⃣ Send payment screenshot here or on WhatsApp\n`;
  paymentText += `3️⃣ Get instant delivery! ⚡\n`;

  const buttons: any[][] = [];
  if (paymentLink) buttons.push([{ text: "💳 Pay Now (UPI)", url: paymentLink }]);
  buttons.push([{ text: "🌐 Buy on Website", url: `${appUrl}/products` }]);
  buttons.push([{ text: "💬 WhatsApp Order", url: `https://wa.me/${whatsapp.replace("+", "")}?text=${whatsappMsg}` }]);
  buttons.push([{ text: "⬅️ Back to Products", callback_data: "view_products" }]);

  await sendMessage(token, chatId, paymentText, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleReferEarn(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";
  const referralBonus = settings.referral_bonus || "10";
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  await sendMessage(token, chatId,
    `🎁 <b>Refer & Earn!</b>\n\nRefer your friends and earn <b>${currency}${referralBonus}</b> for each referral!\n\n` +
    `1️⃣ Sign up on our website\n2️⃣ Get your referral code\n3️⃣ Share with friends\n4️⃣ Earn wallet balance! 💰`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 Sign Up & Get Referral Code", url: `${appUrl}/auth` }],
          [{ text: "⬅️ Back", callback_data: "back_main" }],
        ],
      },
    }
  );
}

async function handleMyWallet(token: string, supabase: any, chatId: number, telegramUser: any) {
  const settings = await getSettings(supabase);
  const appUrl = settings.app_url || "https://cheapest-premiums.lovable.app";

  await sendMessage(token, chatId,
    `💰 <b>My Wallet</b>\n\nView your wallet balance, deposit, and manage transactions on our website.\n\n✅ Deposit via UPI\n✅ International payments via Binance\n✅ Instant top-up`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Open Wallet", url: `${appUrl}/wallet` }],
          [{ text: "⬅️ Back", callback_data: "back_main" }],
        ],
      },
    }
  );
}

async function handleSupport(token: string, supabase: any, chatId: number) {
  const settings = await getSettings(supabase);
  const whatsapp = settings.contact_whatsapp || "+918900684167";
  const email = settings.contact_email || "";

  let supportText = `📞 <b>Customer Support</b>\n\nWe're here to help you 24/7!\n\n📱 WhatsApp: ${whatsapp}\n`;
  if (email) supportText += `📧 Email: ${email}\n`;

  await sendMessage(token, chatId, supportText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💬 Chat on WhatsApp", url: `https://wa.me/${whatsapp.replace("+", "")}` }],
        [{ text: "⬅️ Back", callback_data: "back_main" }],
      ],
    },
  });
}

async function handleGetOffers(token: string, supabase: any, chatId: number) {
  const { data: flashSales } = await supabase
    .from("flash_sales")
    .select("*, products(name, price, image_url)")
    .eq("is_active", true)
    .gt("end_time", new Date().toISOString())
    .limit(5);

  const { data: coupons } = await supabase
    .from("coupons")
    .select("code, description, discount_type, discount_value")
    .eq("is_active", true)
    .limit(5);

  const settings = await getSettings(supabase);
  const currency = settings.currency_symbol || "₹";

  let text = `🔥 <b>Current Offers & Deals</b>\n\n`;
  if (flashSales?.length) {
    text += `⚡ <b>Flash Sales:</b>\n`;
    flashSales.forEach((sale: any) => {
      text += `• ${sale.products?.name || "Product"}: <b>${currency}${sale.sale_price}</b> (was ${currency}${sale.products?.price})\n`;
    });
    text += `\n`;
  }
  if (coupons?.length) {
    text += `🎟️ <b>Coupon Codes:</b>\n`;
    coupons.forEach((c: any) => {
      const discount = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `${currency}${c.discount_value} OFF`;
      text += `• <code>${c.code}</code> - ${discount}\n`;
      if (c.description) text += `  ${c.description}\n`;
    });
    text += `\n`;
  }
  if (!flashSales?.length && !coupons?.length) {
    text += `No special offers right now. Check back later! 🔜`;
  }

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍️ View Products", callback_data: "view_products" }],
        [{ text: "⬅️ Back", callback_data: "back_main" }],
      ],
    },
  });
}
