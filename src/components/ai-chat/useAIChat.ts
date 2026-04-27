import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Msg } from './types';
import { useVoiceInput, useImageUpload } from './useChatInput';
import { useStreamChat } from './useStreamChat';

export const useAIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id ?? null;
  const { isListening, toggleVoice } = useVoiceInput(setInput);
  const { uploadingImage, pendingImage, setPendingImage, fileInputRef, handleImageSelect } = useImageUpload(userId);

  useEffect(() => {
    setHistoryLoaded(false);
    setMessages([]);
  }, [userId]);

  useEffect(() => {
    if (!userId || historyLoaded) return;
    (async () => {
      const { data } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content, image_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data && data.length > 0) {
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          image_url: m.image_url,
          timestamp: new Date(m.created_at).getTime(),
        })));
      }
      setHistoryLoaded(true);
    })();
  }, [userId, historyLoaded]);

  const saveToDb = useCallback(async (msg: Msg) => {
    if (!userId) return;
    const { data } = await supabase
      .from('ai_chat_messages')
      .insert({ user_id: userId, role: msg.role, content: msg.content, image_url: msg.image_url || null })
      .select('id').single();
    return data?.id;
  }, [userId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  const { streamChat, handleStop } = useStreamChat({ setMessages, setLoading, setFollowUps, saveToDb });

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if ((!msg && !pendingImage) || loading) return;
    const userMsg: Msg = { role: 'user', content: msg || (pendingImage ? '📷 Image' : ''), image_url: pendingImage, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setPendingImage(null);
    setFollowUps([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    const savedId = await saveToDb(userMsg);
    if (savedId) {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'user' ? { ...m, id: savedId } : m));
    }
    streamChat(updated);
  }, [input, loading, messages, streamChat, pendingImage, saveToDb, setPendingImage]);

  const handleRetry = useCallback(() => {
    if (loading) return;
    setMessages(prev => {
      const withoutLast = prev.slice(0, -1);
      streamChat(withoutLast);
      return withoutLast;
    });
  }, [loading, streamChat]);

  const handleClearChat = useCallback(async () => {
    setMessages([]);
    setFollowUps([]);
    if (userId) await supabase.from('ai_chat_messages').delete().eq('user_id', userId);
    toast.success('Chat cleared');
  }, [userId]);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied!');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
    return -1;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    if (!searchTerm) return messages;
    return messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [messages, searchTerm]);

  const totalWords = useMemo(() => {
    return messages.filter(m => m.role === 'assistant').reduce((sum, m) => sum + (m.wordCount || 0), 0);
  }, [messages]);

  return {
    messages, input, setInput, loading, isListening, followUps,
    uploadingImage, pendingImage, setPendingImage, searchTerm, setSearchTerm,
    searchMode, setSearchMode, showScrollDown, userId,
    scrollRef, inputRef, searchInputRef, fileInputRef,
    scrollToBottom, handleScroll, toggleVoice, handleImageSelect,
    handleSend, handleRetry, handleStop, handleClearChat, handleCopy, handleKeyDown,
    lastAssistantIdx, filteredMessages, totalWords,
  };
};
