import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from './types';

export function useChatMessages(user: any, isAdmin: boolean, isTempAdmin: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as ChatMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadMessages();
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` },
        (payload) => { setMessages(prev => [...prev, payload.new as ChatMessage]); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (error) return null;
    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const sendMessage = async (text: string, file: File | null, replyToId: string | null) => {
    if ((!text.trim() && !file) || !user) return false;
    let imageUrl: string | null = null;
    if (file) {
      imageUrl = await uploadImage(file);
      if (!imageUrl) { toast.error('Failed to upload image'); return false; }
    }
    const insertData: any = {
      user_id: user.id,
      message: text.trim() || (file ? '📷 Photo' : ''),
      is_admin: isAdmin || isTempAdmin,
      image_url: imageUrl,
    };
    if (replyToId) insertData.reply_to_id = replyToId;
    const { error } = await supabase.from('chat_messages').insert(insertData);
    if (error) { toast.error('Failed to send message'); return false; }
    loadMessages();
    return true;
  };

  return { messages, loading, sendMessage };
}
