import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Maximize2, Minimize2, Copy, Check, RotateCcw, Trash2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string; timestamp?: number };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const SUGGESTIONS = [
  "🔥 Best deals right now?",
  "📦 Show me all products",
  "💰 Cheapest premium apps?",
  "🎟️ Any active coupons?",
];

// Copy button for code blocks
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const MessageBubble = React.memo(({ msg, onCopy, onRetry, isLast, isLoading }: {
  msg: Msg; onCopy: () => void; onRetry?: () => void; isLast: boolean; isLoading: boolean;
}) => {
  const isUser = msg.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
    >
      <div className="flex flex-col gap-1 max-w-[88%]">
        {!isUser && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">RKR AI</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted/70 text-foreground rounded-tl-sm border border-border/50'
          }`}
        >
          {msg.role === 'assistant' ? (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_a]:text-primary [&_a]:underline [&_a]:font-medium [&_p]:m-0 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:m-0 [&_ul]:mb-1.5 [&_ol]:m-0 [&_ol]:mb-1.5 [&_li]:m-0 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:bg-background/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:relative [&_pre]:bg-background/80 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/50">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                  pre: ({ children, ...props }) => {
                    const codeText = (children as any)?.props?.children || '';
                    return (
                      <pre {...props} className="relative">
                        <CopyButton text={String(codeText)} />
                        {children}
                      </pre>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          )}
        </div>
        
        {/* Action buttons for assistant messages */}
        {!isUser && msg.content && (
          <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onCopy} className="p-1 rounded hover:bg-muted transition-colors" title="Copy">
              <Copy className="w-3 h-3 text-muted-foreground" />
            </button>
            {isLast && !isLoading && onRetry && (
              <button onClick={onRetry} className="p-1 rounded hover:bg-muted transition-colors" title="Regenerate">
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

const AIChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Draggable button state
  const [btnPos, setBtnPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, open, scrollToBottom]);

  // Track scroll position for "scroll down" button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

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

  const handleBtnClick = useCallback(() => {
    if (!hasMoved.current) setOpen(true);
  }, []);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    setLoading(true);
    abortRef.current = new AbortController();
    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })) }),
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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: Date.now() }];
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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: Date.now() }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error('Failed to connect to AI');
      }
    }
    setLoading(false);
  }, []);

  const handleSend = useCallback((text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const userMsg: Msg = { role: 'user', content: msg, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    streamChat(updated);
  }, [input, loading, messages, streamChat]);

  const handleRetry = useCallback(() => {
    if (loading) return;
    // Remove last assistant message and retry
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

  const handleClearChat = useCallback(() => {
    setMessages([]);
    toast.success('Chat cleared');
  }, []);

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

  const msgCount = messages.length;
  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  const panelClasses = isFullScreen
    ? 'fixed inset-0 z-[60] w-full h-full rounded-none'
    : 'fixed bottom-24 right-4 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] rounded-2xl';

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
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform touch-none select-none cursor-grab active:cursor-grabbing relative"
            >
              <Bot className="w-6 h-6 pointer-events-none" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`${panelClasses} bg-background border border-border shadow-2xl flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground border-b border-primary/20 ${isFullScreen ? '' : 'rounded-t-2xl'}`}>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-primary" />
                </div>
                <div>
                  <span className="font-bold text-sm">RKR AI</span>
                  <p className="text-[10px] opacity-75">Always online • Powered by AI</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {msgCount > 0 && (
                  <button onClick={handleClearChat} className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors" title="Clear chat">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setIsFullScreen(prev => !prev)} className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors" title={isFullScreen ? 'Minimize' : 'Fullscreen'}>
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => { setOpen(false); setDismissed(false); setIsFullScreen(false); }} className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-primary" />
                  </motion.div>
                  <div className="text-center">
                    <h3 className="font-bold text-foreground">Hey! I'm RKR AI 🤖</h3>
                    <p className="text-xs text-muted-foreground mt-1">Ask me anything about products, deals & premium apps!</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-[300px]">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.08 }}
                        onClick={() => handleSend(s)}
                        className="text-left text-xs p-2.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/50 hover:border-border transition-colors text-foreground"
                      >
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <MessageBubble
                  key={`${i}-${msg.timestamp}`}
                  msg={msg}
                  onCopy={() => handleCopy(msg.content)}
                  onRetry={i === lastAssistantIdx ? handleRetry : undefined}
                  isLast={i === lastAssistantIdx}
                  isLoading={loading}
                />
              ))}
              
              {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">RKR AI is thinking...</span>
                    </div>
                    <div className="bg-muted/70 rounded-2xl rounded-tl-sm border border-border/50 px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Scroll to bottom button */}
            <AnimatePresence>
              {showScrollDown && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-background/95 backdrop-blur-sm">
              {loading && (
                <button onClick={handleStop} className="w-full mb-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 rounded-lg hover:bg-muted transition-colors">
                  <span className="w-3 h-3 rounded-sm bg-muted-foreground/50 border border-muted-foreground/30" />
                  Stop generating
                </button>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything... (Shift+Enter for new line)"
                  className="flex-1 resize-none text-sm rounded-xl bg-muted/70 border border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 px-3.5 py-2.5 outline-none transition-all min-h-[40px] max-h-[120px] placeholder:text-muted-foreground/60"
                  disabled={loading}
                  rows={1}
                />
                <Button
                  size="icon"
                  className="w-10 h-10 rounded-xl shrink-0 transition-all"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground/50 text-center mt-1.5">
                AI can make mistakes. Verify important info.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatWidget;
