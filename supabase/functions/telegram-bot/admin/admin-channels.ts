// ===== ADMIN CHANNEL MANAGEMENT =====

import { sendMessage } from "../telegram-api.ts";
import { getRequiredChannels, addRequiredChannel, removeRequiredChannel } from "../db-helpers.ts";

export async function handleListChannels(token: string, supabase: any, chatId: number) {
  const channels = await getRequiredChannels(supabase);
  if (!channels.length) {
    await sendMessage(token, chatId, "📢 <b>Required Channels</b>\n\nNo required channels configured. Users can use bot without joining any channel.");
    return;
  }
  let text = `📢 <b>Required Channels (${channels.length})</b>\n\n`;
  channels.forEach((c: string, i: number) => {
    text += `${i + 1}. ${c}\n`;
  });
  text += `\n<b>Commands:</b>\n/add_channel @channel\n/remove_channel @channel`;
  await sendMessage(token, chatId, text);
}

export async function handleAddChannel(token: string, supabase: any, chatId: number, channelName: string) {
  if (!channelName) { await sendMessage(token, chatId, "⚠️ Usage: <code>/add_channel @channel_name</code>"); return; }
  const updated = await addRequiredChannel(supabase, channelName);
  await sendMessage(token, chatId, `✅ Channel <b>${channelName}</b> added!\n\n📢 Current channels (${updated.length}):\n${updated.join("\n")}`);
}

export async function handleRemoveChannel(token: string, supabase: any, chatId: number, channelName: string) {
  if (!channelName) { await sendMessage(token, chatId, "⚠️ Usage: <code>/remove_channel @channel_name</code>"); return; }
  const updated = await removeRequiredChannel(supabase, channelName);
  await sendMessage(token, chatId, `✅ Channel <b>${channelName}</b> removed!\n\n📢 Current channels (${updated.length}):\n${updated.length ? updated.join("\n") : "None - users can use bot freely"}`);
}
