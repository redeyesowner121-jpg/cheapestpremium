export type Msg = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string | null;
  timestamp?: number;
  wordCount?: number;
  responseTime?: number;
};

export const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export const SUGGESTIONS = [
  { icon: "🔥", text: "Best deals right now?" },
  { icon: "📦", text: "Show me all products" },
  { icon: "💰", text: "Cheapest premium apps?" },
  { icon: "🎟️", text: "Any active coupons?" },
  { icon: "⚡", text: "Flash sale products?" },
  { icon: "🆚", text: "Compare Netflix vs Disney+" },
];

export const formatTime = (ts?: number) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
};
