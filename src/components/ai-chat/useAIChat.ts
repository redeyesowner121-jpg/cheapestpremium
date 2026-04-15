import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Msg, CHAT_URL } from './types';

export const useAIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamStartTime = useRef<number>(0);

  const userId = user?.id ?? null;

  useEffect(() => {
    setHistoryLoaded(false);
    setMessages([]);
  }, [userId]);

  useEffect(() => {
    if (!userId || historyLoaded) return;
    const loadHistory = async () => {
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
    };
    loadHistory();
  }, [userId, historyLoaded]);

  const saveToDb = useCallback(async (msg: Msg) => {
    if (!userId) return;
    const { data } = await supabase
      .from('ai_chat_messages')
      .insert({ user_id: userId, role: msg.role, content: msg.content, image_url: msg.image_url || null })
      .select('id')
      .single();
    return data?.id;
  }, [userId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser');
      return;
    }
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('');
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only images allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB image size'); return; }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `ai-chat/${userId || 'anon'}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('chat-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      setPendingImage(urlData.publicUrl);
      toast.success('Image ready to send!');
    } catch (err) {
      toast.error('Failed to upload image');
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [userId]);

  const generateFollowUps = useCallback((content: string) => {
    const suggestions: string[] = [];
    const lc = content.toLowerCase();
    if (lc.includes('netflix')) suggestions.push('Compare Netflix plans');
    if (lc.includes('spotify')) suggestions.push('Tell me Spotify features');
    if (lc.includes('price') || content.includes('₹')) suggestions.push('Show cheapest option');
    if (lc.includes('coupon') || lc.includes('discount')) suggestions.push('Any other offers?');
    if (lc.includes('flash sale')) suggestions.push('Show flash sale details');
    if (suggestions.length === 0) suggestions.push('Give more details', 'Show similar products');
    return suggestions.slice(0, 3);
  }, []);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    setLoading(true);
    setFollowUps([]);
    abortRef.current = new AbortController();
    streamStartTime.current = Date.now();
    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.image_url ? `[User sent an image: ${m.image_url}]\n${m.content}` : m.content })) }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        toast.error(errData.error || 'AI is temporarily unavailable');
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const wc = assistantSoFar.split(/\s+/).filter(Boolean).length;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && !last.id) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar, wordCount: wc } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: Date.now(), wordCount: wc }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const wc = assistantSoFar.split(/\s+/).filter(Boolean).length;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && !last.id) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar, wordCount: wc } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: Date.now(), wordCount: wc }];
              });
            }
          } catch { /* ignore */ }
        }
      }

      const responseTime = Date.now() - streamStartTime.current;
      const splitWebMessage = (text: string): string[] => {
        const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        if (paragraphs.length >= 2) return paragraphs;
        const productPattern = /\n(?=📦|🔥|➡️|•\s|[-]\s|\d+[\.\)]\s)/;
        const productSplit = text.split(productPattern).map(p => p.trim()).filter(Boolean);
        if (productSplit.length >= 2) return productSplit;
        return [text];
      };

      const parts = splitWebMessage(assistantSoFar.trim());
      
      if (parts.length > 1) {
        const splitMsgs: Msg[] = parts.map((part, idx) => ({
          role: 'assistant' as const,
          content: part,
          timestamp: Date.now() + idx,
          wordCount: part.split(/\s+/).filter(Boolean).length,
          responseTime: idx === parts.length - 1 ? responseTime : undefined,
        }));
        
        const savedIds: (string | undefined)[] = [];
        for (const msg of splitMsgs) {
          const id = await saveToDb(msg);
          savedIds.push(id);
        }
        
        setMessages(prev => {
          const withoutStreaming = prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && !m.id));
          return [...withoutStreaming, ...splitMsgs.map((m, i) => ({ ...m, id: savedIds[i] }))];
        });
      } else {
        const assistantMsg: Msg = { role: 'assistant', content: assistantSoFar, timestamp: Date.now(), wordCount: assistantSoFar.split(/\s+/).filter(Boolean).length, responseTime };
        const savedId = await saveToDb(assistantMsg);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, id: savedId, responseTime } : m);
          }
          return prev;
        });
      }
      setFollowUps(generateFollowUps(assistantSoFar));
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error('Failed to connect to AI');
      }
    }
    setLoading(false);
  }, [generateFollowUps, saveToDb]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if ((!msg && !pendingImage) || loading) return;
    
    const userMsg: Msg = { 
      role: 'user', 
      content: msg || (pendingImage ? '📷 Image' : ''), 
      image_url: pendingImage,
      timestamp: Date.now() 
    };
    
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
  }, [input, loading, messages, streamChat, pendingImage, saveToDb]);

  const handleRetry = useCallback(() => {
    if (loading) return;
    setMessages(prev => {
      const withoutLast = prev.slice(0, -1);
      streamChat(withoutLast);
      return withoutLast;
    });
  }, [loading, streamChat]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleClearChat = useCallback(async () => {
    setMessages([]);
    setFollowUps([]);
    if (userId) {
      await supabase.from('ai_chat_messages').delete().eq('user_id', userId);
    }
    toast.success('Chat cleared');
  }, [userId]);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied!');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
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
