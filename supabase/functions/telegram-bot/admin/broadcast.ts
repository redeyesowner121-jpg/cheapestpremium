// ===== CROSS-BOT BROADCAST (Main + Resale + Giveaway + every Child bot, excluding Mother bot) =====

import { sendMessage } from "../telegram-api.ts";

export async function executeBroadcast(token: string, supabase: any, adminChatId: number, msg: any) {
  const mainToken = token;
  const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
  const giveawayToken = Deno.env.get("GIVEAWAY_BOT_TOKEN");

  // ---- Extract content from the source message ----
  const photoFileId: string | undefined = Array.isArray(msg.photo) && msg.photo.length
    ? msg.photo[msg.photo.length - 1].file_id : undefined;
  const videoFileId: string | undefined = msg.video?.file_id;
  const documentFileId: string | undefined = msg.document?.file_id;
  const animationFileId: string | undefined = msg.animation?.file_id;
  const caption: string | undefined = msg.caption;
  const captionEntities = msg.caption_entities;
  const text: string | undefined = msg.text;
  const entities = msg.entities;

  if (!photoFileId && !videoFileId && !documentFileId && !animationFileId && !text) {
    await sendMessage(token, adminChatId, "❌ Unsupported message type for broadcast. Send text, photo, video, animation, or document.");
    return;
  }

  // ---- Gather targets ----
  const seen = new Set<string>();
  const allTargets: { telegram_id: number; botToken: string; source: string }[] = [];
  const counts: Record<string, number> = { main: 0, resale: 0, giveaway: 0, child: 0 };

  const addTarget = (tid: number, botToken: string | undefined, source: string) => {
    if (!botToken || !tid) return;
    const key = `${botToken}:${tid}`;
    if (seen.has(key)) return;
    seen.add(key);
    allTargets.push({ telegram_id: tid, botToken, source });
    counts[source] = (counts[source] || 0) + 1;
  };

  // 1. Main bot users
  try {
    const { data: mainUsers } = await supabase
      .from("telegram_bot_users").select("telegram_id").eq("is_banned", false);
    (mainUsers || []).forEach((u: any) => addTarget(u.telegram_id, mainToken, "main"));
  } catch (e) { console.error("[broadcast] main users error:", e); }

  // 2. Resale bot users
  if (resaleToken) {
    try {
      const { data: rUsers } = await supabase
        .from("resale_bot_users").select("telegram_id").eq("is_banned", false);
      (rUsers || []).forEach((u: any) => addTarget(u.telegram_id, resaleToken, "resale"));
    } catch { /* table may not exist; ignore */ }
  }

  // 3. Giveaway bot users
  if (giveawayToken) {
    try {
      const { data: gUsers } = await supabase
        .from("giveaway_points").select("telegram_id");
      (gUsers || []).forEach((u: any) => addTarget(u.telegram_id, giveawayToken, "giveaway"));
    } catch (e) { console.error("[broadcast] giveaway users error:", e); }
  }

  // 4. Every active Child bot (mother bot intentionally excluded)
  try {
    const { data: childBots } = await supabase
      .from("child_bots").select("id, bot_token").eq("is_active", true);
    if (childBots?.length) {
      for (const cb of childBots) {
        const { data: cbUsers } = await supabase
          .from("child_bot_users").select("telegram_id").eq("child_bot_id", cb.id);
        (cbUsers || []).forEach((u: any) => addTarget(u.telegram_id, cb.bot_token, "child"));
      }
    }
  } catch (e) { console.error("[broadcast] child users error:", e); }

  if (!allTargets.length) { await sendMessage(token, adminChatId, "No users to broadcast to."); return; }

  await sendMessage(token, adminChatId,
    `📢 <b>Broadcasting to ${allTargets.length} chats…</b>\n\n` +
    `• Main: ${counts.main}\n• Resale: ${counts.resale}\n• Giveaway: ${counts.giveaway}\n• Child bots: ${counts.child}\n\n` +
    `<i>(Mother bot excluded)</i>`
  );

  // ---- File ids are bot-scoped: download once from main bot and re-upload per child/resale/giveaway ----
  let mediaBuffer: Uint8Array | null = null;
  let mediaFilename = "file";
  const mediaFileId = photoFileId || videoFileId || animationFileId || documentFileId;

  async function ensureMediaBuffer(): Promise<Uint8Array | null> {
    if (mediaBuffer || !mediaFileId) return mediaBuffer;
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${mainToken}/getFile`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: mediaFileId }),
      });
      const fileJson = await fileRes.json();
      if (!fileJson.ok) { console.error("[broadcast] getFile failed:", fileJson); return null; }
      const filePath = fileJson.result.file_path;
      mediaFilename = filePath.split("/").pop() || "file";
      const dl = await fetch(`https://api.telegram.org/file/bot${mainToken}/${filePath}`);
      if (!dl.ok) { console.error("[broadcast] download failed:", dl.status); return null; }
      mediaBuffer = new Uint8Array(await dl.arrayBuffer());
      return mediaBuffer;
    } catch (e) {
      console.error("[broadcast] ensureMediaBuffer error:", e);
      return null;
    }
  }

  async function sendOne(t: { telegram_id: number; botToken: string; source: string }): Promise<"sent" | "blocked" | "failed"> {
    const isMain = t.botToken === mainToken;
    try {
      // Text-only message
      if (!mediaFileId && text) {
        const r = await fetch(`https://api.telegram.org/bot${t.botToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: t.telegram_id, text, entities }),
        });
        const j = await r.json();
        if (j.ok) return "sent";
        if (/blocked|deactivated|chat not found|user is deactivated/i.test(j.description || "")) return "blocked";
        return "failed";
      }

      // For the MAIN bot reuse the file_id
      if (isMain && mediaFileId) {
        let method = "sendMessage", body: any = {};
        if (photoFileId) { method = "sendPhoto"; body = { chat_id: t.telegram_id, photo: photoFileId, caption, caption_entities: captionEntities }; }
        else if (videoFileId) { method = "sendVideo"; body = { chat_id: t.telegram_id, video: videoFileId, caption, caption_entities: captionEntities }; }
        else if (animationFileId) { method = "sendAnimation"; body = { chat_id: t.telegram_id, animation: animationFileId, caption, caption_entities: captionEntities }; }
        else if (documentFileId) { method = "sendDocument"; body = { chat_id: t.telegram_id, document: documentFileId, caption, caption_entities: captionEntities }; }
        const r = await fetch(`https://api.telegram.org/bot${t.botToken}/${method}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const j = await r.json();
        if (j.ok) return "sent";
        if (/blocked|deactivated|chat not found/i.test(j.description || "")) return "blocked";
        return "failed";
      }

      // Other bots: must re-upload via multipart
      const buf = await ensureMediaBuffer();
      if (!buf) return "failed";
      const fd = new FormData();
      fd.append("chat_id", String(t.telegram_id));
      let method = "sendDocument", fileField = "document";
      if (photoFileId) { method = "sendPhoto"; fileField = "photo"; }
      else if (videoFileId) { method = "sendVideo"; fileField = "video"; }
      else if (animationFileId) { method = "sendAnimation"; fileField = "animation"; }
      const blob = new Blob([buf as BlobPart]);
      fd.append(fileField, blob, mediaFilename);
      if (caption) fd.append("caption", caption);
      if (captionEntities) fd.append("caption_entities", JSON.stringify(captionEntities));
      const r = await fetch(`https://api.telegram.org/bot${t.botToken}/${method}`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) return "sent";
      if (/blocked|deactivated|chat not found/i.test(j.description || "")) return "blocked";
      console.error("[broadcast] send failed:", t.source, j.description);
      return "failed";
    } catch (e) {
      console.error("[broadcast] sendOne exception:", e);
      return "failed";
    }
  }

  if (mediaFileId) await ensureMediaBuffer();

  let sent = 0, failed = 0, skipped = 0;
  const batchSize = 10;
  const delayBetweenBatches = 1000;

  for (let i = 0; i < allTargets.length; i += batchSize) {
    const batch = allTargets.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(sendOne));
    for (const r of results) {
      if (r === "sent") sent++;
      else if (r === "blocked") skipped++;
      else failed++;
    }
    if (i + batchSize < allTargets.length) await new Promise(r => setTimeout(r, delayBetweenBatches));
  }

  await sendMessage(token, adminChatId,
    `📢 <b>Broadcast Complete!</b>\n\n` +
    `📊 Main: ${counts.main} · Resale: ${counts.resale}\n` +
    `📊 Giveaway: ${counts.giveaway} · Child Bots: ${counts.child}\n\n` +
    `✅ Sent: ${sent}\n❌ Failed: ${failed}\n🚫 Blocked: ${skipped}\n📊 Total: ${allTargets.length}`
  );
}
