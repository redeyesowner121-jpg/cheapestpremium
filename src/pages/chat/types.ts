export interface ChatMessage {
  id: string;
  message: string;
  user_id: string;
  is_admin: boolean;
  created_at: string;
  image_url?: string;
  reply_to_id?: string | null;
}

export const formatChatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
