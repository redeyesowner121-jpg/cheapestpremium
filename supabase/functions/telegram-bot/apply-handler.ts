// ===== RESELLER / WHOLESALER APPLICATION HANDLER =====
// /apply command flow: choose type → upload proof photo → enter description → submitted to admins

import { sendMessage, sendPhoto } from "./telegram-api.ts";
import { setConversationState, deleteConversationState, getAllAdminIds } from "./db-helpers.ts";

const MOTHERBOT_URL = "https://t.me/Botmother_selling_bot";

export async function handleApplyCommand(token: string, supabase: any, chatId: number, userId: number, lang: string) {
  // Check existing pending application
  const { data: pending } = await supabase
    .from("reseller_applications")
    .select("id, application_type, status, created_at")
    .eq("telegram_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (pending) {
    const typeLabel = pending.application_type === "wholesaler" ? "Wholesaler" : "Reseller";
    await sendMessage(token, chatId, lang === "bn"
      ? `⏳ তোমার একটি <b>${typeLabel}</b> এপ্লিকেশন এখনো রিভিউতে আছে। অ্যাডমিনের সিদ্ধান্তের জন্য অপেক্ষা করো।`
      : `⏳ You already have a pending <b>${typeLabel}</b> application under review. Please wait for admin's decision.`
    );
    return;
  }

  const text = lang === "bn"
    ? "🤝 <b>Become a Partner</b>\n\nতুমি কোন পার্টনারশিপের জন্য আবেদন করতে চাও?\n\n• <b>Reseller</b> — ৳৫০০+ মাসিক সেলস\n• <b>Wholesaler</b> — ৳১০০০+ মাসিক সেলস + Mother Bot access"
    : "🤝 <b>Become a Partner</b>\n\nWhich partnership are you applying for?\n\n• <b>Reseller</b> — ₹500+ monthly sales\n• <b>Wholesaler</b> — ₹1000+ monthly sales + Mother Bot access";

  await sendMessage(token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Apply for Reseller (₹500+)", callback_data: "apply_type_reseller" }],
        [{ text: "🏭 Apply for Wholesaler (₹1k+)", callback_data: "apply_type_wholesaler" }],
        [{ text: lang === "bn" ? "❌ বাতিল" : "❌ Cancel", callback_data: "back_main" }],
      ],
    },
  });
}

export async function handleApplyTypeChoice(token: string, supabase: any, chatId: number, userId: number, applicationType: "reseller" | "wholesaler", lang: string) {
  await setConversationState(supabase, userId, "apply_awaiting_proof", { applicationType });

  const typeLabel = applicationType === "wholesaler" ? "Wholesaler (₹1k+)" : "Reseller (₹500+)";
  await sendMessage(token, chatId, lang === "bn"
    ? `📸 <b>${typeLabel} এপ্লিকেশন</b>\n\nএখন তোমার প্রুফ আপলোড করো — একটি ছবি (screenshot/payment proof/business proof) পাঠাও।\n\n⚠️ বাতিল করতে /cancel লেখো।`
    : `📸 <b>${typeLabel} Application</b>\n\nPlease upload your proof — send <b>one photo</b> (screenshot / payment proof / business proof).\n\n⚠️ Send /cancel to abort.`
  );
}

export async function handleApplyProofPhoto(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { data: any }) {
  if (!msg.photo) {
    await sendMessage(token, chatId, "📸 Please send a photo as proof. Send /cancel to abort.");
    return;
  }
  const fileId = msg.photo[msg.photo.length - 1]?.file_id;
  if (!fileId) {
    await sendMessage(token, chatId, "❌ Could not read the photo. Try again.");
    return;
  }

  await setConversationState(supabase, userId, "apply_awaiting_description", {
    ...state.data,
    proofFileId: fileId,
  });

  await sendMessage(token, chatId,
    "✍️ <b>Step 2 of 2</b>\n\nNow write a short description:\n• Your business / channel name\n• Estimated monthly sales\n• Why you want this partnership\n\n(Min 20 characters. Send /cancel to abort.)"
  );
}

export async function handleApplyDescription(token: string, supabase: any, chatId: number, userId: number, msg: any, state: { data: any }) {
  const text = (msg.text || "").trim();
  if (text.length < 20) {
    await sendMessage(token, chatId, `⚠️ Description too short (min 20 characters). You wrote ${text.length}. Try again or /cancel.`);
    return;
  }
  if (text.length > 1000) {
    await sendMessage(token, chatId, "⚠️ Description too long (max 1000 characters). Please shorten it.");
    return;
  }

  const applicationType: "reseller" | "wholesaler" = state.data.applicationType;
  const proofFileId: string = state.data.proofFileId;

  // Get user info
  const { data: tgUser } = await supabase.from("telegram_bot_users").select("username, first_name").eq("telegram_id", userId).maybeSingle();

  // Insert application
  const { data: app, error } = await supabase.from("reseller_applications").insert({
    telegram_id: userId,
    username: tgUser?.username || null,
    first_name: tgUser?.first_name || null,
    application_type: applicationType,
    proof_telegram_file_id: proofFileId,
    description: text,
    status: "pending",
  }).select("id").single();

  if (error || !app) {
    console.error("apply: insert failed", error);
    await sendMessage(token, chatId, "❌ Failed to submit application. Please try again later.");
    await deleteConversationState(supabase, userId);
    return;
  }

  await deleteConversationState(supabase, userId);

  await sendMessage(token, chatId,
    `✅ <b>Application Submitted!</b>\n\nYour <b>${applicationType === "wholesaler" ? "Wholesaler" : "Reseller"}</b> application has been sent to the admin team. You'll get a notification once it's reviewed.\n\n📋 Application ID: <code>${app.id.slice(0, 8)}</code>`
  );

  // Notify admins with proof photo + approve/reject buttons
  const userTag = tgUser?.username ? `@${tgUser.username}` : (tgUser?.first_name || `User`);
  const typeBadge = applicationType === "wholesaler" ? "🏭 WHOLESALER (₹1k+)" : "🛒 RESELLER (₹500+)";
  const caption =
    `🆕 <b>New Partnership Application</b>\n\n` +
    `Type: ${typeBadge}\n` +
    `User: ${userTag}\n` +
    `ID: <code>${userId}</code>\n` +
    `App ID: <code>${app.id.slice(0, 8)}</code>\n\n` +
    `📝 <b>Description:</b>\n${text}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `apply_approve_${app.id}` },
        { text: "❌ Reject", callback_data: `apply_reject_${app.id}` },
      ],
    ],
  };

  // Forward proof photo + caption to all admins
  const adminIds = await getAllAdminIds(supabase);
  for (const adminId of adminIds) {
    try {
      await sendPhoto(token, adminId, proofFileId, caption, replyMarkup);
    } catch (e) {
      console.error("apply: notify admin failed", e);
    }
  }
}

export async function handleApplyApprove(token: string, supabase: any, chatId: number, adminUserId: number, appId: string, messageId?: number) {
  const { data: app, error } = await supabase
    .from("reseller_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();

  if (error || !app) {
    await sendMessage(token, chatId, "❌ Application not found.");
    return;
  }
  if (app.status !== "pending") {
    await sendMessage(token, chatId, `ℹ️ Already ${app.status}.`);
    return;
  }

  // Mark approved
  await supabase.from("reseller_applications").update({
    status: "approved",
    reviewed_at: new Date().toISOString(),
    admin_note: `Approved by admin ${adminUserId}`,
  }).eq("id", appId);

  if (app.application_type === "reseller") {
    // Activate reseller status
    await supabase.from("telegram_wallets").upsert({
      telegram_id: app.telegram_id,
      is_reseller: true,
    }, { onConflict: "telegram_id" });

    // Sync to website profile if linked
    await supabase.from("profiles").update({ is_reseller: true }).eq("telegram_id", app.telegram_id);

    try {
      await sendMessage(token, app.telegram_id,
        `🎉 <b>Reseller Application Approved!</b>\n\n` +
        `You are now a <b>Reseller</b>! 🛒\n\n` +
        `✨ Open the Resale Bot to start earning:\n👉 https://t.me/AIR1XOTT_bot\n\n` +
        `Use /start in the resale bot to begin.`,
        { reply_markup: { inline_keyboard: [[{ text: "🚀 Open Resale Bot", url: "https://t.me/AIR1XOTT_bot" }]] } }
      );
    } catch { /* user blocked bot */ }
  } else {
    // Wholesaler — share Mother Bot link
    try {
      await sendMessage(token, app.telegram_id,
        `🎉 <b>Wholesaler Application Approved!</b>\n\n` +
        `Welcome to the wholesaler tier! 🏭\n\n` +
        `✨ You now have access to <b>Mother Bot</b> — create your own selling bot:\n👉 ${MOTHERBOT_URL}\n\n` +
        `Tap the button below to get started.`,
        { reply_markup: { inline_keyboard: [[{ text: "🤖 Open Mother Bot", url: MOTHERBOT_URL }]] } }
      );
    } catch { /* user blocked bot */ }
  }

  await sendMessage(token, chatId,
    `✅ Application <code>${appId.slice(0, 8)}</code> APPROVED.\n` +
    `Type: ${app.application_type}\nUser: <code>${app.telegram_id}</code>`
  );
}

export async function handleApplyReject(token: string, supabase: any, chatId: number, adminUserId: number, appId: string) {
  const { data: app } = await supabase
    .from("reseller_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();

  if (!app) { await sendMessage(token, chatId, "❌ Application not found."); return; }
  if (app.status !== "pending") { await sendMessage(token, chatId, `ℹ️ Already ${app.status}.`); return; }

  await supabase.from("reseller_applications").update({
    status: "rejected",
    reviewed_at: new Date().toISOString(),
    admin_note: `Rejected by admin ${adminUserId}`,
  }).eq("id", appId);

  try {
    await sendMessage(token, app.telegram_id,
      `❌ <b>Application Rejected</b>\n\n` +
      `Your ${app.application_type} application was not approved at this time.\n\n` +
      `You can apply again later with stronger proof. Use /apply to retry.`
    );
  } catch { /* user blocked bot */ }

  await sendMessage(token, chatId,
    `❌ Application <code>${appId.slice(0, 8)}</code> REJECTED.\n` +
    `User <code>${app.telegram_id}</code> notified.`
  );
}
