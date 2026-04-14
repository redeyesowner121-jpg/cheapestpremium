// ===== AI TRAINING SYSTEM =====

import { sendMessage } from "../telegram-api.ts";
import { setConversationState } from "../db-helpers.ts";

// Training categories with emojis and descriptions
const TRAINING_CATEGORIES = [
  { key: "faq", emoji: "📋", label: "FAQ", labelBn: "FAQ", desc: "Frequently Asked Questions", descBn: "সচরাচর জিজ্ঞাসিত প্রশ্নোত্তর" },
  { key: "qna", emoji: "❓", label: "Q&A", labelBn: "প্রশ্নোত্তর", desc: "Custom Question & Answer", descBn: "কাস্টম প্রশ্ন ও উত্তর" },
  { key: "rules", emoji: "📜", label: "Rules & Policies", labelBn: "নিয়ম ও পলিসি", desc: "Store rules, refund/return policies", descBn: "স্টোরের নিয়ম, রিফান্ড/রিটার্ন পলিসি" },
  { key: "greeting", emoji: "👋", label: "Greetings", labelBn: "অভিবাদন", desc: "Custom greeting responses", descBn: "কাস্টম স্বাগতম উত্তর" },
  { key: "troubleshoot", emoji: "🔧", label: "Troubleshoot", labelBn: "সমস্যা সমাধান", desc: "Problem-solving guides", descBn: "সমস্যার সমাধান গাইড" },
  { key: "product_tips", emoji: "📦", label: "Product Tips", labelBn: "প্রোডাক্ট টিপস", desc: "Extra product usage info", descBn: "প্রোডাক্ট ব্যবহারের অতিরিক্ত তথ্য" },
  { key: "custom", emoji: "✏️", label: "Custom Training", labelBn: "কাস্টম ট্রেনিং", desc: "Any custom knowledge", descBn: "যেকোনো কাস্টম জ্ঞান" },
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
    style: "primary",
  }]);
  
  if ((pendingCount || 0) > 0) {
    buttons.push([{ text: `⏳ Pending Approval (${pendingCount})`, callback_data: "aitrain_pending", style: "danger" }]);
  }
  buttons.push([{ text: "📊 View All Knowledge", callback_data: "aitrain_view", style: "success" }]);
  buttons.push([{ text: "🗑️ Delete Knowledge", callback_data: "aitrain_delete", style: "danger" }]);
  buttons.push([{ text: "⬅️ Back to Admin", callback_data: "adm_back" }]);

  await sendMessage(token, chatId,
    `🧠 <b>AI Training Center</b>\n\n` +
    `📚 মোট তথ্য: <b>${totalCount || 0}</b>\n` +
    `✅ অ্যাপ্রুভড: <b>${approvedCount || 0}</b>\n` +
    `⏳ পেন্ডিং: <b>${pendingCount || 0}</b>\n\n` +
    `নিচের ক্যাটেগরি সিলেক্ট করে AI কে নতুন তথ্য শেখান।\n` +
    `প্রতিটি ক্যাটেগরিতে প্রশ্ন এবং উত্তর দিন — AI পরবর্তীতে ইউজারদের এই উত্তর দেবে।`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ===== START TRAINING FOR A CATEGORY =====
export async function startTrainingCategory(token: string, supabase: any, chatId: number, userId: number, category: string) {
  const cat = TRAINING_CATEGORIES.find(c => c.key === category);
  if (!cat) return;

  // Show category-specific examples
  const examples: Record<string, string> = {
    faq: "উদাহরণ:\n❓ প্রশ্ন: ডেলিভারি কতক্ষণ লাগে?\n✅ উত্তর: সাধারণত ৫-১০ মিনিটে ডেলিভারি হয়।",
    qna: "উদাহরণ:\n❓ প্রশ্ন: Netflix কি শেয়ারড?\n✅ উত্তর: হ্যাঁ, Netflix স্ক্রিন শেয়ারড।",
    rules: "উদাহরণ:\n❓ প্রশ্ন: রিফান্ড পলিসি কী?\n✅ উত্তর: সকল বিক্রয় চূড়ান্ত। কোনো রিফান্ড নেই।",
    greeting: "উদাহরণ:\n❓ প্রশ্ন: হ্যালো/Hi/আসসালামু\n✅ উত্তর: স্বাগতম! আমরা সস্তায় প্রিমিয়াম সাবস্ক্রিপশন দিই।",
    troubleshoot: "উদাহরণ:\n❓ প্রশ্ন: অ্যাকাউন্ট লগইন হচ্ছে না\n✅ উত্তর: পাসওয়ার্ড কপি-পেস্ট করুন, ম্যানুয়ালি টাইপ করবেন না।",
    product_tips: "উদাহরণ:\n❓ প্রশ্ন: Spotify কীভাবে ব্যবহার করব?\n✅ উত্তর: লগইন করে Profile > Account দেখুন।",
    custom: "উদাহরণ:\n❓ প্রশ্ন: (যেকোনো প্রশ্ন)\n✅ উত্তর: (আপনার উত্তর)",
  };

  await setConversationState(supabase, userId, "ai_training_question", { category });
  
  await sendMessage(token, chatId,
    `${cat.emoji} <b>${cat.label} — AI Training</b>\n\n` +
    `📝 ${cat.descBn}\n\n` +
    `${examples[category] || ""}\n\n` +
    `এখন <b>প্রশ্নটি</b> টাইপ করুন যেটা ইউজাররা জিজ্ঞেস করতে পারে:\n\n` +
    `/cancel করলে বাতিল হবে।`
  );
}

// ===== HANDLE TRAINING QUESTION INPUT =====
export async function handleTrainingQuestion(token: string, supabase: any, chatId: number, userId: number, question: string, category: string) {
  await setConversationState(supabase, userId, "ai_training_answer", { category, question });
  
  await sendMessage(token, chatId,
    `✅ <b>প্রশ্ন সেট হয়েছে!</b>\n\n` +
    `❓ <b>প্রশ্ন:</b> ${question}\n\n` +
    `এখন এই প্রশ্নের <b>উত্তর</b> টাইপ করুন:\n\n` +
    `/cancel করলে বাতিল হবে।`
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
    await sendMessage(token, chatId, `❌ সংরক্ষণ ব্যর্থ।`);
    return;
  }

  const cat = TRAINING_CATEGORIES.find(c => c.key === category);

  await sendMessage(token, chatId,
    `⏳ <b>পেন্ডিং অ্যাপ্রুভালে যোগ হয়েছে!</b>\n\n` +
    `${cat?.emoji || "🧠"} ক্যাটেগরি: <b>${cat?.label || category}</b>\n` +
    `❓ প্রশ্ন: <b>${question}</b>\n` +
    `✅ উত্তর: <b>${answer}</b>\n\n` +
    `🧠 অ্যাপ্রুভ করলে AI এই উত্তর ব্যবহার করবে।`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve Now", callback_data: `knowledge_approve_${inserted.id}`, style: "success" },
            { text: "❌ Reject", callback_data: `knowledge_reject_${inserted.id}`, style: "danger" },
          ],
          [{ text: `${cat?.emoji || "📋"} আরো ${cat?.label || ""} যোগ করুন`, callback_data: `aitrain_${category}`, style: "primary" }],
          [{ text: "🧠 AI Training Menu", callback_data: "adm_ai_training", style: "primary" }],
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
      "✅ <b>কোনো পেন্ডিং নলেজ নেই!</b>\n\nসব কিছু অ্যাপ্রুভড।",
      { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training", style: "primary" }]] } }
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
      { text: `✅ #${i + 1} Approve`, callback_data: `knowledge_approve_${k.id}`, style: "success" },
      { text: `❌ #${i + 1} Reject`, callback_data: `knowledge_reject_${k.id}`, style: "danger" },
    ]);
  });

  buttons.push([{ text: "🧠 AI Training", callback_data: "adm_ai_training", style: "primary" }]);
  buttons.push([{ text: "⬅️ Back", callback_data: "adm_back" }]);

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
      "📭 <b>কোনো ট্রেনিং ডেটা নেই।</b>\n\nAI Training Menu থেকে নতুন তথ্য যোগ করুন।",
      { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training", style: "primary" }]] } }
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
  if (page > 0) navButtons.push({ text: "⬅️ Previous", callback_data: `aitrain_view_${page - 1}`, style: "primary" });
  if (page + 1 < totalPages) navButtons.push({ text: "Next ➡️", callback_data: `aitrain_view_${page + 1}`, style: "primary" });

  const buttons: any[][] = [];
  if (navButtons.length) buttons.push(navButtons);
  buttons.push([{ text: "🧠 AI Training", callback_data: "adm_ai_training", style: "primary" }]);
  buttons.push([{ text: "⬅️ Back to Admin", callback_data: "adm_back" }]);

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
    await sendMessage(token, chatId, "📭 কোনো ট্রেনিং ডেটা নেই।");
    return;
  }

  const buttons = data.map((k: any) => [{
    text: `🗑️ ${k.question.slice(0, 40)}`,
    callback_data: `aitrain_del_${k.id.slice(0, 32)}`,
    style: "danger",
  }]);
  buttons.push([{ text: "⬅️ Back", callback_data: "adm_ai_training" }]);

  await sendMessage(token, chatId,
    `🗑️ <b>Delete Knowledge Entry</b>\n\nকোন এন্ট্রি মুছতে চান সেটি সিলেক্ট করুন:`,
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
    await sendMessage(token, chatId, "❌ এন্ট্রি পাওয়া যায়নি।");
    return;
  }

  const entry = entries[0];
  await supabase.from("telegram_ai_knowledge").delete().eq("id", entry.id);

  await sendMessage(token, chatId,
    `✅ <b>মুছে ফেলা হয়েছে!</b>\n\n❓ ${entry.question}`,
    { reply_markup: { inline_keyboard: [[{ text: "🧠 AI Training", callback_data: "adm_ai_training", style: "primary" }]] } }
  );
}
