import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Maximize2, Minimize2, Trash2, Sparkles, ChevronDown, Mic, MicOff, Search, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageBubble, FollowUpChips } from './ai-chat/ChatMessageBubble';
import ChatEmptyState from './ai-chat/ChatEmptyState';
import { useAIChat } from './ai-chat/useAIChat';

const AIChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const chat = useAIChat();
  const [open, setOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const [btnPos, setBtnPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  useEffect(() => { chat.scrollToBottom(); }, [chat.messages, open, chat.scrollToBottom]);

  useEffect(() => {
    if (chat.inputRef.current) {
      chat.inputRef.current.style.height = 'auto';
      chat.inputRef.current.style.height = Math.min(chat.inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [chat.input]);

  useEffect(() => {
    if (open && chat.inputRef.current && !chat.searchMode) setTimeout(() => chat.inputRef.current?.focus(), 300);
  }, [open, chat.searchMode]);

  useEffect(() => {
    if (chat.searchMode && chat.searchInputRef.current) chat.searchInputRef.current.focus();
  }, [chat.searchMode]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && open) {
        e.preventDefault();
        chat.setSearchMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
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
  const handleBtnClick = useCallback(() => { if (!hasMoved.current) setOpen(true); }, []);

  const msgCount = chat.messages.length;

  const panelClasses = isFullScreen
    ? 'fixed inset-0 z-[60] w-full h-full rounded-none'
    : 'fixed bottom-24 right-4 z-[60] w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl';

  return (
    <>
      {/* Floating Draggable Button */}
      <AnimatePresence>
        {!open && location.pathname !== '/ai' && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="fixed bottom-24 right-4 z-[60]"
            style={{ transform: `translate(${btnPos.x}px, ${btnPos.y}px)` }}
          >
            <div className="relative">
              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110 transition-transform z-10"
                title="Hide AI"
              >
                <X className="w-3 h-3" />
              </button>
              <button
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input ref={chat.fileInputRef} type="file" accept="image/*" onChange={chat.handleImageSelect} className="hidden" />

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.95 }}
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
                    {chat.loading ? '✍️ Typing...' : !chat.userId ? '🔐 Login to save history' : msgCount > 0 ? `${msgCount} msgs • ${chat.totalWords} words` : 'Always online'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => { chat.setSearchMode(prev => !prev); chat.setSearchTerm(''); }} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Search (Ctrl+K)">
                  <Search className="w-3.5 h-3.5" />
                </button>
                {msgCount > 0 && (
                  <button onClick={chat.handleClearChat} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Clear chat">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => { setOpen(false); navigate('/ai'); }} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Open full page">
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button onClick={() => { setOpen(false); chat.setSearchMode(false); }} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <AnimatePresence>
              {chat.searchMode && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border">
                  <div className="px-3 py-2 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={chat.searchInputRef} type="text" value={chat.searchTerm}
                      onChange={e => chat.setSearchTerm(e.target.value)}
                      placeholder="Search in conversation..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                    {chat.searchTerm && <span className="text-[10px] text-muted-foreground shrink-0">{chat.filteredMessages.length} found</span>}
                    <button onClick={() => { chat.setSearchMode(false); chat.setSearchTerm(''); }} className="p-0.5">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div ref={chat.scrollRef} onScroll={chat.handleScroll} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
              {chat.messages.length === 0 && <ChatEmptyState onSend={chat.handleSend} />}
              
              {chat.filteredMessages.map((msg, i) => {
                const originalIdx = chat.messages.indexOf(msg);
                return (
                  <MessageBubble
                    key={`${originalIdx}-${msg.timestamp || msg.id}`}
                    msg={msg}
                    onCopy={() => chat.handleCopy(msg.content)}
                    onRetry={originalIdx === chat.lastAssistantIdx ? chat.handleRetry : undefined}
                    isLast={originalIdx === chat.lastAssistantIdx}
                    isLoading={chat.loading}
                    isStreaming={chat.loading && originalIdx === chat.messages.length - 1 && msg.role === 'assistant'}
                    searchTerm={chat.searchTerm}
                    onNavigate={(path) => { setOpen(false); window.location.href = path; }}
                  />
                );
              })}

              {!chat.loading && chat.followUps.length > 0 && chat.lastAssistantIdx === chat.messages.length - 1 && (
                <FollowUpChips suggestions={chat.followUps} onSelect={chat.handleSend} />
              )}
              
              {chat.loading && chat.messages[chat.messages.length - 1]?.role !== 'assistant' && (
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
              {chat.showScrollDown && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  onClick={chat.scrollToBottom}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Pending image preview */}
            {chat.pendingImage && (
              <div className="px-3 py-2 border-t border-border bg-muted/30">
                <div className="relative inline-block">
                  <img src={chat.pendingImage} alt="Pending" className="h-16 rounded-lg object-cover" />
                  <button onClick={() => chat.setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-background/95 backdrop-blur-sm">
              {chat.loading && (
                <motion.button
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  onClick={chat.handleStop}
                  className="w-full mb-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive border border-border/50 transition-all"
                >
                  <span className="w-3 h-3 rounded-sm bg-destructive/60" />
                  Stop generating
                </motion.button>
              )}
              <div className="flex gap-2 items-end">
                <button
                  onClick={() => chat.fileInputRef.current?.click()}
                  disabled={chat.loading || chat.uploadingImage}
                  className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 disabled:opacity-50"
                  title="Send image"
                >
                  {chat.uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                </button>
                
                <div className="flex-1 relative">
                  <textarea
                    ref={chat.inputRef} value={chat.input} onChange={e => chat.setInput(e.target.value)} onKeyDown={chat.handleKeyDown}
                    placeholder={chat.isListening ? '🎤 Listening...' : 'Ask anything...'}
                    className={`w-full resize-none text-sm rounded-xl bg-muted/50 border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 px-3.5 py-2.5 pr-10 outline-none transition-all min-h-[42px] max-h-[120px] placeholder:text-muted-foreground/50 ${chat.isListening ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border/50'}`}
                    disabled={chat.loading} rows={1}
                  />
                  <button
                    onClick={chat.toggleVoice}
                    className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all ${chat.isListening ? 'bg-primary text-primary-foreground animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    title={chat.isListening ? 'Stop listening' : 'Voice input'}
                  >
                    {chat.isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button size="icon" className="w-10 h-10 rounded-xl shrink-0 transition-all shadow-sm" onClick={() => chat.handleSend()} disabled={(!chat.input.trim() && !chat.pendingImage) || chat.loading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <p className="text-[9px] text-muted-foreground/40">
                  {chat.input.length > 0 ? `${chat.input.length} chars` : 'Shift+Enter for new line'}
                </p>
                <p className="text-[9px] text-muted-foreground/40">
                  {chat.userId ? '☁️ Synced' : '🔐 Login to sync'}
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
