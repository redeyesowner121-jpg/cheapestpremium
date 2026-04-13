import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Maximize2, Minimize2, Copy, Check, RotateCcw, Trash2, Sparkles, ChevronDown, Mic, MicOff, Search, Clock, MessageSquare, Zap, ArrowRight, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Msg = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string | null;
  timestamp?: number;
  wordCount?: number;
  responseTime?: number;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const SUGGESTIONS = [
  { icon: "🔥", text: "Best deals right now?" },
  { icon: "📦", text: "Show me all products" },
  { icon: "💰", text: "Cheapest premium apps?" },
  { icon: "🎟️", text: "Any active coupons?" },
  { icon: "⚡", text: "Flash sale products?" },
  { icon: "🆚", text: "Compare Netflix vs Disney+" },
];

const formatTime = (ts?: number) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors z-10"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const StreamingCursor = () => (
  <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 animate-pulse align-text-bottom" />
);

const MarkdownContent = React.memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline font-medium hover:opacity-80">
          {children}
          <ArrowRight className="w-3 h-3 inline" />
        </a>
      ),
      strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0 text-foreground">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0 text-foreground">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-foreground">{children}</h3>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      code: ({ className, children, ...props }) => {
        const isInline = !className;
        if (isInline) {
          return <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono text-primary">{children}</code>;
        }
        return <code className={className} {...props}>{children}</code>;
      },
      pre: ({ children }) => {
        const codeText = (children as any)?.props?.children || '';
        return (
          <pre className="relative group/code bg-muted/80 rounded-lg border border-border/50 my-2 p-3 overflow-x-auto text-xs">
            <CopyButton text={String(codeText)} />
            {children}
          </pre>
        );
      },
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse border border-border/50 rounded-lg overflow-hidden">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
      th: ({ children }) => <th className="border border-border/50 px-2.5 py-1.5 text-left font-semibold text-foreground">{children}</th>,
      td: ({ children }) => <td className="border border-border/50 px-2.5 py-1.5">{children}</td>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-3 border-primary/40 pl-3 my-2 italic text-muted-foreground bg-primary/5 py-1 rounded-r-md">{children}</blockquote>
      ),
      hr: () => <hr className="my-3 border-border/40" />,
    }}
  >
    {content}
  </ReactMarkdown>
));
MarkdownContent.displayName = 'MarkdownContent';

const MessageBubble = React.memo(({ msg, onCopy, onRetry, isLast, isLoading, isStreaming, searchTerm }: {
  msg: Msg; onCopy: () => void; onRetry?: () => void; isLast: boolean; isLoading: boolean; isStreaming: boolean; searchTerm: string;
}) => {
  const isUser = msg.role === 'user';

  const highlightContent = useCallback((text: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '**$1**');
  }, [searchTerm]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
    >
      <div className="flex flex-col gap-0.5 max-w-[88%]">
        {!isUser && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[10px] font-semibold text-primary/70">RKR AI</span>
            {msg.timestamp && (
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {formatTime(msg.timestamp)}
              </span>
            )}
          </div>
        )}
        {isUser && msg.timestamp && (
          <div className="flex justify-end px-1">
            <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed transition-all ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
              : 'bg-muted/60 text-foreground rounded-tl-sm border border-border/40 shadow-sm'
          }`}
        >
          {/* Image display */}
          {msg.image_url && (
            <div className="mb-2">
              <img 
                src={msg.image_url} 
                alt="Uploaded" 
                className="max-w-full max-h-48 rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(msg.image_url!, '_blank')}
              />
            </div>
          )}
          
          {msg.role === 'assistant' ? (
            <div className="prose-chat max-w-none break-words text-sm">
              <MarkdownContent content={searchTerm ? highlightContent(msg.content) : msg.content} />
              {isStreaming && isLast && <StreamingCursor />}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          )}
        </div>
        
        {!isUser && msg.content && !isStreaming && (
          <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-0.5">
              <button onClick={onCopy} className="p-1 rounded-md hover:bg-muted transition-colors" title="Copy response">
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
              {isLast && !isLoading && onRetry && (
                <button onClick={onRetry} className="p-1 rounded-md hover:bg-muted transition-colors" title="Regenerate">
                  <RotateCcw className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
            {msg.wordCount && (
              <span className="text-[9px] text-muted-foreground/40">{msg.wordCount} words</span>
            )}
            {msg.responseTime && (
              <span className="text-[9px] text-muted-foreground/40 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />{(msg.responseTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

const FollowUpChips = React.memo(({ suggestions, onSelect }: { suggestions: string[]; onSelect: (s: string) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
    className="flex flex-wrap gap-1.5 px-1 mt-1"
  >
    {suggestions.map((s, i) => (
      <button
        key={i}
        onClick={() => onSelect(s)}
        className="text-[11px] px-2.5 py-1 rounded-full bg-primary/5 hover:bg-primary/10 border border-primary/15 hover:border-primary/30 text-primary transition-all hover:scale-[1.02]"
      >
        {s}
      </button>
    ))}
  </motion.div>
));
FollowUpChips.displayName = 'FollowUpChips';

const AIChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamStartTime = useRef<number>(0);

  const [btnPos, setBtnPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setHistoryLoaded(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load chat history from database
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

  // Save message to database
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

  useEffect(() => { scrollToBottom(); }, [messages, open, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (open && inputRef.current && !searchMode) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, searchMode]);

  useEffect(() => {
    if (searchMode && searchInputRef.current) searchInputRef.current.focus();
  }, [searchMode]);

  // Voice input
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

  // Image upload
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
    if (lc.includes('netflix')) suggestions.push('Netflix plans compare করো');
    if (lc.includes('spotify')) suggestions.push('Spotify features বলো');
    if (lc.includes('price') || content.includes('₹')) suggestions.push('Cheapest option দেখাও');
    if (lc.includes('coupon') || lc.includes('discount')) suggestions.push('আর কোনো offer আছে?');
    if (lc.includes('flash sale')) suggestions.push('Flash sale details দেখাও');
    if (suggestions.length === 0) suggestions.push('আরো details দাও', 'Similar products দেখাও');
    return suggestions.slice(0, 3);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: btnPos.x, posY: btnPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [btnPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
    setBtnPos({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
  }, []);

  const handlePointerUp = useCallback(() => { isDragging.current = false; }, []);
  const handleBtnClick = useCallback(() => { if (!hasMoved.current) setOpen(true); }, []);

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

      // Set response time & save to DB
      const responseTime = Date.now() - streamStartTime.current;
      const assistantMsg: Msg = { role: 'assistant', content: assistantSoFar, timestamp: Date.now(), wordCount: assistantSoFar.split(/\s+/).filter(Boolean).length, responseTime };
      
      // Save assistant message to DB
      const savedId = await saveToDb(assistantMsg);
      
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, id: savedId, responseTime } : m);
        }
        return prev;
      });
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
    
    // Save user message to DB
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
    // Delete from DB
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

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && open) {
        e.preventDefault();
        setSearchMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [open]);

  const msgCount = messages.length;
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

  const panelClasses = isFullScreen
    ? 'fixed inset-0 z-[60] w-full h-full rounded-none'
    : 'fixed bottom-24 right-4 z-[60] w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl';

  return (
    <>
      {/* Floating Draggable Button */}
      <AnimatePresence>
        {!open && !dismissed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-24 right-4 z-[60]"
            style={{ transform: `translate(${btnPos.x}px, ${btnPos.y}px)` }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="absolute -top-2 -right-1 z-[61] w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
            >
              <X className="w-3 h-3" />
            </button>
            <button
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleBtnClick}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform touch-none select-none cursor-grab active:cursor-grabbing relative ring-2 ring-primary/20"
            >
              <Bot className="w-6 h-6 pointer-events-none" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background">
                <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse" />
              </span>
              {msgCount > 0 && (
                <span className="absolute -bottom-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center border-2 border-background">
                  {msgCount > 99 ? '99+' : msgCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`${panelClasses} bg-background border border-border/60 shadow-2xl flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground ${isFullScreen ? '' : 'rounded-t-2xl'}`}>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-4.5 h-4.5" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-primary shadow-sm" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">RKR AI</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary-foreground/15 font-medium">PRO</span>
                  </div>
                  <p className="text-[10px] opacity-70">
                    {loading ? '✍️ Typing...' : !userId ? '🔐 Login to save history' : msgCount > 0 ? `${msgCount} msgs • ${totalWords} words` : 'Always online'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setSearchMode(prev => !prev); setSearchTerm(''); }} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Search (Ctrl+K)">
                  <Search className="w-3.5 h-3.5" />
                </button>
                {msgCount > 0 && (
                  <button onClick={handleClearChat} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Clear chat">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setIsFullScreen(prev => !prev)} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title={isFullScreen ? 'Minimize' : 'Fullscreen'}>
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => { setOpen(false); setDismissed(false); setIsFullScreen(false); setSearchMode(false); }} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <AnimatePresence>
              {searchMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-border"
                >
                  <div className="px-3 py-2 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search in conversation..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                    {searchTerm && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{filteredMessages.length} found</span>
                    )}
                    <button onClick={() => { setSearchMode(false); setSearchTerm(''); }} className="p-0.5">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', delay: 0.1, damping: 15 }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10"
                  >
                    <Sparkles className="w-10 h-10 text-primary" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center"
                  >
                    <h3 className="font-bold text-lg text-foreground">Hey! I'm RKR AI 🤖</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                      Your smart assistant for products, deals, premium apps & more!
                    </p>
                  </motion.div>
                  
                  <div className="grid grid-cols-2 gap-2 w-full max-w-[320px]">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + i * 0.06 }}
                        onClick={() => handleSend(`${s.icon} ${s.text}`)}
                        className="text-left text-[11px] p-2.5 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/40 hover:border-border/80 transition-all text-foreground flex items-start gap-1.5 hover:shadow-sm"
                      >
                        <span className="text-sm">{s.icon}</span>
                        <span>{s.text}</span>
                      </motion.button>
                    ))}
                  </div>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-[10px] text-muted-foreground/40 flex items-center gap-1"
                  >
                    <Mic className="w-3 h-3" /> Voice • <ImageIcon className="w-3 h-3" /> Images • <MessageSquare className="w-3 h-3" /> Rich text
                  </motion.p>
                </div>
              )}
              
              {filteredMessages.map((msg, i) => {
                const originalIdx = messages.indexOf(msg);
                return (
                  <MessageBubble
                    key={`${originalIdx}-${msg.timestamp || msg.id}`}
                    msg={msg}
                    onCopy={() => handleCopy(msg.content)}
                    onRetry={originalIdx === lastAssistantIdx ? handleRetry : undefined}
                    isLast={originalIdx === lastAssistantIdx}
                    isLoading={loading}
                    isStreaming={loading && originalIdx === messages.length - 1 && msg.role === 'assistant'}
                    searchTerm={searchTerm}
                  />
                );
              })}

              {!loading && followUps.length > 0 && lastAssistantIdx === messages.length - 1 && (
                <FollowUpChips suggestions={followUps} onSelect={handleSend} />
              )}
              
              {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                        <Sparkles className="w-3 h-3 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}>
                          RKR AI is thinking
                        </motion.span>
                        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>...</motion.span>
                      </span>
                    </div>
                    <div className="bg-muted/60 rounded-2xl rounded-tl-sm border border-border/40 px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-primary/50 rounded-full" />
                        <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-2 h-2 bg-primary/50 rounded-full" />
                        <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-2 h-2 bg-primary/50 rounded-full" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Scroll to bottom */}
            <AnimatePresence>
              {showScrollDown && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Pending image preview */}
            {pendingImage && (
              <div className="px-3 py-2 border-t border-border bg-muted/30">
                <div className="relative inline-block">
                  <img src={pendingImage} alt="Pending" className="h-16 rounded-lg object-cover" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-background/95 backdrop-blur-sm">
              {loading && (
                <motion.button
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleStop}
                  className="w-full mb-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive border border-border/50 transition-all"
                >
                  <span className="w-3 h-3 rounded-sm bg-destructive/60" />
                  Stop generating
                </motion.button>
              )}
              <div className="flex gap-2 items-end">
                {/* Image button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploadingImage}
                  className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 disabled:opacity-50"
                  title="Send image"
                >
                  {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                </button>
                
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? '🎤 Listening...' : 'Ask anything...'}
                    className={`w-full resize-none text-sm rounded-xl bg-muted/50 border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 px-3.5 py-2.5 pr-10 outline-none transition-all min-h-[42px] max-h-[120px] placeholder:text-muted-foreground/50 ${isListening ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border/50'}`}
                    disabled={loading}
                    rows={1}
                  />
                  <button
                    onClick={toggleVoice}
                    className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all ${isListening ? 'bg-primary text-primary-foreground animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  size="icon"
                  className="w-10 h-10 rounded-xl shrink-0 transition-all shadow-sm"
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && !pendingImage) || loading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <p className="text-[9px] text-muted-foreground/40">
                  {input.length > 0 ? `${input.length} chars` : 'Shift+Enter for new line'}
                </p>
                <p className="text-[9px] text-muted-foreground/40">
                  {userId ? '☁️ Synced' : '🔐 Login to sync'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatWidget;
