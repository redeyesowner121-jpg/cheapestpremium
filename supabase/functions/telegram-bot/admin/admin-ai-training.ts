// ===== AI TRAINING SYSTEM =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState } from "../db-helpers.ts";

// Training categories with emojis and descriptions
const TRAINING_CATEGORIES = [
  { key: "faq", emoji: "📋", label: "FAQ", desc: "Frequently Asked Questions" },
  { key: "qna", emoji: "❓", label: "Q&A", desc: "Custom Question & Answer" },
  { key: "rules", emoji: "📜", label: "Rules & Policies", desc: "Store rules, refund/return policies" },
  { key: "greeting", emoji: "👋", label: "Greetings", desc: "Custom greeting responses" },
  { key: "troubleshoot", emoji: "🔧", label: "Troubleshoot", desc: "Problem-solving guides" },
  { key: "product_tips", emoji: "📦", label: "Product Tips", desc: "Extra product usage info" },
  { key: "custom", emoji: "✏️", label: "Custom Training", desc: "Any custom knowledge" },
];

// ===== MAIN AI TRAINING MENU =====
export async function handleAITrainingMenu(token: string, supabase: any, chatId: number) {
  const [{ count: totalCount }, { count: pendingCount }, { count: approvedCount }] = await Promise.all([
    supabase.from("telegram_ai_knowledge").select("*", { count: "exact", head: true }),
    supabase.from("telegram_ai_knowledge").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("telegram_ai_knowledge").select("*", { count: "exact", head: true }).eq("status", "approved"),
  ]);

  const buttons = TRAINING_CATEGORIES.map(c => [{
    text: `${c.emoji} ${c.label}`,
    callback_data: `aitrain_${c.key}`,
   
  }]);
  
  if ((pendingCount || 0) > 0) {
    buttons.push([{ text: `⏳ Pending Approval (${pendingCount})`, callback_data: "aitrain_pending" }]);
  }
  buttons.push([{ text: "📊 View All Knowledge", callback_data: "aitrain_view" }]);
  buttons.push([{ text: "🗑️ Delete Knowledge", callback_data: "aitrain_delete" }]);
  buttons.push([{ text: "⬅️ Back to Admin", callback_data: "adm_back", color: "red" }]);

  await sendMessage(token, chatId,
    `🧠 <b>AI Training Center</b>\n\n` +
    `📚 Total Knowledge: <b>${totalCount || 0}</b>\n` +
    `✅ Approved: <b>${approvedCount || 0}</b>\n` +
    `⏳ Pending: <b>${pendingCount || 0}</b>\n\n` +
    `Select a category below to teach AI new knowledge.\n` +
    `Provide a question and answer for each category — AI will use these to respond to users.`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ===== START TRAINING FOR A CATEGORY =====
export async function startTrainingCategory(token: string, supabase: any, chatId: number, userId: number, category: string) {
  const cat = TRAINING_CATEGORIES.find(c => c.key === category);
  if (!cat) return;

  // Show category-specific examples
  const examples: Record<string, string> = {
    faq: "Example:\n❓ Q: How long does delivery take?\n✅ A: Usually 5-10 minutes.",
    qna: "Example:\n❓ Q: Is Netflix shared?\n✅ A: Yes, Netflix screen is shared.",
    rules: "Example:\n❓ Q: What is the refund policy?\n✅ A: All sales are final. No refunds.",
    greeting: "Example:\n❓ Q: Hello/Hi\n✅ A: Welcome! We offer premium subscriptions at cheap prices.",
    troubleshoot: "Example:\n❓ Q: Can't login to account\n✅ A: Copy-paste the password, don't type manually.",
    product_tips: "Example:\n❓ Q: How to use Spotify?\n✅ A: Login and go to Profile > Account.",
    custom: "Example:\n❓ Q: (Any question)\n✅ A: (Your answer)",
  };

  await setConversationState(supabase, userId, "ai_training_question", { category });
  
  await sendMessage(token, chatId,
    `${cat.emoji} <b>${cat.label} — AI Training</b>\n\n` +
    `📝 ${cat.desc}\n\n` +
    `${examples[category] || ""}\n\n` +
    `Now type the <b>question</b> that users might ask:\n\n` +
    `Type /cancel to abort.`
  );
}

// ===== HANDLE TRAINING QUESTION INPUT =====
export async function handleTrainingQuestion(token: string, supabase: any, chatId: number, userId: number, question: string, category: string) {
  await setConversationState(supabase, userId, "ai_training_answer", { category, question });
  
  await sendMessage(token, chatId,
    `✅ <b>Question set!</b>\n\n` +
    `❓ <b>Question:</b> ${question}\n\n` +
    `Now type the <b>answer</b> for this question:\n\n` +
    `Type /cancel to abort.`
  );
}

// ===== HANDLE TRAINING ANSWER INPUT =====
export async function handleTrainingAnswer(token: string, supabase: any, chatId: number, userId: number, answer: string, question: string, category: string) {
  // Save as PENDING — needs approval
  const { data: inserted } = await supabase.from("telegram_ai_knowledge").insert({
    question: `[${category.toUpperCase()}] ${question}`,
    answer,
    added_by: userId,
    language: "auto",
    status: "pending",
  }).select("id").single();

  if (!inserted) {
    await sendMessage(token, chatId, `❌ Failed to save.`);
    return;
  }

  const cat = TRAINING_CATEGORIES.find(c => c.key === category);

  await sendMessage(token, chatId,
    `⏳ <b>Added to pending approval!</b>\n\n` +
    `${cat?.emoji || "🧠"} Category: <b>${cat?.label || category}</b>\n` +
    `❓ Question: <b>${question}</b>\n` +
    `✅ Answer: <b>${answer}</b>\n\n` +
    `🧠 Once approved, AI will use this answer.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve Now", callback_data: `knowledge_approve_${inserted.id}` },
            { text: "❌ Reject", callback_data: `knowledge_reject_${inserted.id}` },
          ],
          [{ text: `${cat?.emoji || "📋"} Add more ${cat?.label || ""}`, callback_data: `aitrain_${category}` }],
          [{ text: "🧠 AI Training Menu", callback_data: "adm_ai_training" }],
        ],
      },
    }
  );
}

// ===== PENDING KNOWLEDGE QUEUE =====
export async function handlePendingKnowledge(token: string, supabase: any, chatId: number) {
  const { data } = await supabase
    .from("telegram_ai_knowledge")
    .select("id, question, answer, created_at, added_by")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data?.length) {
    await sendMessage(token, chatId,
      "✅ <b>No pending knowledge!</b>\n\nEverything is approved.",
      { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }]] } }
    );
    return;
  }

  let text = `⏳ <b>Pending Knowledge (${data.length})</b>\n\n`;
  const buttons: any[][] = [];

  data.forEach((k: any, i: number) => {
    const q = k.question.length > 50 ? k.question.slice(0, 47) + "..." : k.question;
    const a = k.answer.length > 60 ? k.answer.slice(0, 57) + "..." : k.answer;
    text += `<b>${i + 1}.</b> ❓ ${q}\n✅ ${a}\n\n`;
    buttons.push([
      { text: `✅ #${i + 1} Approve`, callback_data: `knowledge_approve_${k.id}` },
      { text: `❌ #${i + 1} Reject`, callback_data: `knowledge_reject_${k.id}` },
    ]);
  });

  buttons.push([{ text: "🧠 AI Training", callback_data: "adm_ai_training" }]);
  buttons.push([{ text: "⬅️ Back", callback_data: "adm_back", color: "red" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== VIEW ALL KNOWLEDGE =====
export async function handleViewKnowledge(token: string, supabase: any, chatId: number, page: number = 0) {
  const pageSize = 10;
  const { data, count } = await supabase
    .from("telegram_ai_knowledge")
    .select("id, question, answer, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (!data?.length) {
    await sendMessage(token, chatId,
      "📭 <b>No training data found.</b>\n\nAdd new knowledge from the AI Training Menu.",
      { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }]] } }
    );
    return;
  }

  const totalPages = Math.ceil((count || 0) / pageSize);
  let text = `📚 <b>AI Knowledge Base</b> (${count || 0} items)\nPage ${page + 1}/${totalPages}\n\n`;

  data.forEach((k: any, i: number) => {
    const q = k.question.length > 60 ? k.question.slice(0, 57) + "..." : k.question;
    const a = k.answer.length > 80 ? k.answer.slice(0, 77) + "..." : k.answer;
    text += `<b>${page * pageSize + i + 1}.</b> ❓ ${q}\n✅ ${a}\n\n`;
  });

  const navButtons: any[] = [];
  if (page > 0) navButtons.push({ text: "⬅️ Previous", callback_data: `aitrain_view_${page - 1}` });
  if (page + 1 < totalPages) navButtons.push({ text: "Next ➡️", callback_data: `aitrain_view_${page + 1}` });

  const buttons: any[][] = [];
  if (navButtons.length) buttons.push(navButtons);
  buttons.push([{ text: "🧠 AI Training", callback_data: "adm_ai_training" }]);
  buttons.push([{ text: "⬅️ Back to Admin", callback_data: "adm_back", color: "red" }]);

  await sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

// ===== DELETE KNOWLEDGE ENTRY =====
export async function startDeleteKnowledge(token: string, supabase: any, chatId: number, userId: number) {
  // Show recent entries for selection
  const { data } = await supabase
    .from("telegram_ai_knowledge")
    .select("id, question")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data?.length) {
    await sendMessage(token, chatId, "📭 No training data found.");
    return;
  }

  const buttons = data.map((k: any) => [{
    text: `🗑️ ${k.question.slice(0, 40)}`,
    callback_data: `aitrain_del_${k.id.slice(0, 32)}`,
   
  }]);
  buttons.push([{ text: "⬅️ Back", callback_data: "adm_ai_training", color: "red" }]);

  await sendMessage(token, chatId,
    `🗑️ <b>Delete Knowledge Entry</b>\n\nSelect the entry you want to delete:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

export async function executeDeleteKnowledge(token: string, supabase: any, chatId: number, entryId: string) {
  // Find entry with partial ID match
  const { data: entries } = await supabase
    .from("telegram_ai_knowledge")
    .select("id, question")
    .like("id", `${entryId}%`)
    .limit(1);

  if (!entries?.length) {
    await sendMessage(token, chatId, "❌ Entry not found.");
    return;
  }

  const entry = entries[0];
  await supabase.from("telegram_ai_knowledge").delete().eq("id", entry.id);

  await sendMessage(token, chatId,
    `✅ <b>Deleted!</b>\n\n❓ ${entry.question}`,
    { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training" }]] } }
  );
}
