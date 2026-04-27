import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export interface Message {
  id: string;
  message: string;
  user_id: string;
  is_admin: boolean;
  created_at: string;
  image_url?: string;
  reply_to_id?: string | null;
}

export function useAdminChat() {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChatUsers = useCallback(async () => {
    setLoading(true);
    const { data: messagesData } = await supabase
      .from('chat_messages')
      .select('user_id, message, created_at, is_admin')
      .order('created_at', { ascending: false });

    if (messagesData) {
      const userMap = new Map<string, { lastMessage: string; lastTime: string; unread: number }>();
      messagesData.forEach(msg => {
        if (!userMap.has(msg.user_id)) {
          userMap.set(msg.user_id, {
            lastMessage: msg.message,
            lastTime: msg.created_at,
            unread: msg.is_admin ? 0 : 1,
          });
        } else if (!msg.is_admin) {
          const cur = userMap.get(msg.user_id)!;
          userMap.set(msg.user_id, { ...cur, unread: cur.unread + 1 });
        }
      });

      const userIds = Array.from(userMap.keys());
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        if (profiles) {
          const users: ChatUser[] = profiles.map(p => ({
            id: p.id, name: p.name, email: p.email,
            lastMessage: userMap.get(p.id)?.lastMessage,
            lastMessageTime: userMap.get(p.id)?.lastTime,
            unreadCount: userMap.get(p.id)?.unread || 0,
          }));
          users.sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
          setChatUsers(users);
        }
      }
    }
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  useEffect(() => {
    loadChatUsers();
    const channel = supabase
      .channel('admin-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadChatUsers();
        if (selectedUser) loadMessages(selectedUser.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, loadChatUsers, loadMessages]);

  const sendMessage = async (text: string, replyToId: string | null) => {
    if (!text.trim() || !selectedUser) return false;
    const insertData: any = { user_id: selectedUser.id, message: text.trim(), is_admin: true };
    if (replyToId) insertData.reply_to_id = replyToId;
    const { error } = await supabase.from('chat_messages').insert(insertData);
    if (error) { toast.error('Failed to send message'); return false; }
    await supabase.from('notifications').insert({
      user_id: selectedUser.id,
      title: 'New Message from Admin',
      message: text.trim().substring(0, 100),
      type: 'chat',
    });
    loadMessages(selectedUser.id);
    loadChatUsers();
    toast.success('Message sent!');
    return true;
  };

  const selectUser = (u: ChatUser) => { setSelectedUser(u); loadMessages(u.id); };

  return { chatUsers, selectedUser, setSelectedUser, messages, loading, sendMessage, selectUser };
}
