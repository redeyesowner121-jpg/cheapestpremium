import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Trash2, Sparkles, ChevronDown, Mic, MicOff,
  Search, Image as ImageIcon, Loader2, X, Bot, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageBubble, FollowUpChips } from '@/components/ai-chat/ChatMessageBubble';
import ChatEmptyState from '@/components/ai-chat/ChatEmptyState';
import { useAIChat } from '@/components/ai-chat/useAIChat';
import SEOHead from '@/components/SEOHead';

const AIPage: React.FC = () => {
  const navigate = useNavigate();
  const chat = useAIChat();

  useEffect(() => { chat.scrollToBottom(); }, [chat.messages, chat.scrollToBottom]);

  useEffect(() => {
    if (chat.inputRef.current) {
      chat.inputRef.current.style.height = 'auto';
      chat.inputRef.current.style.height = Math.min(chat.inputRef.current.scrollHeight, 150) + 'px';
    }
  }, [chat.input]);

  useEffect(() => {
    if (chat.inputRef.current && !chat.searchMode) setTimeout(() => chat.inputRef.current?.focus(), 300);
  }, [chat.searchMode]);

  useEffect(() => {
    if (chat.searchMode && chat.searchInputRef.current) chat.searchInputRef.current.focus();
  }, [chat.searchMode]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        chat.setSearchMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const msgCount = chat.messages.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="RKR AI Assistant"
        description="Chat with RKR AI — your smart assistant for products, deals, and premium apps."
      />

      {/* Hidden file input */}
      <input ref={chat.fileInputRef} type="file" accept="image/*" onChange={chat.handleImageSelect} className="hidden" />

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl text-primary-foreground hover:bg-primary-foreground/15" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary shadow-sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">RKR AI</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary-foreground/15 font-semibold">PRO</span>
                </div>
                <p className="text-[11px] opacity-75">
                  {chat.loading ? '✍️ Typing...' : !chat.userId ? '🔐 Login to save history' : msgCount > 0 ? `${msgCount} msgs • ${chat.totalWords} words` : 'Always online • Ask anything'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { chat.setSearchMode(prev => !prev); chat.setSearchTerm(''); }} className="p-2 rounded-xl hover:bg-primary-foreground/15 transition-colors" title="Search (Ctrl+K)">
              <Search className="w-4 h-4" />
            </button>
            {msgCount > 0 && (
              <button onClick={chat.handleClearChat} className="p-2 rounded-xl hover:bg-primary-foreground/15 transition-colors" title="Clear chat">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-primary-foreground/15 transition-colors" title="Close">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <AnimatePresence>
        {chat.searchMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border bg-background">
            <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={chat.searchInputRef} type="text" value={chat.searchTerm}
                onChange={e => chat.setSearchTerm(e.target.value)}
                placeholder="Search in conversation..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
              {chat.searchTerm && <span className="text-xs text-muted-foreground shrink-0">{chat.filteredMessages.length} found</span>}
              <button onClick={() => { chat.setSearchMode(false); chat.setSearchTerm(''); }} className="p-1 rounded-md hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={chat.scrollRef} onScroll={chat.handleScroll} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {chat.messages.length === 0 && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <ChatEmptyState onSend={chat.handleSend} />
            </div>
          )}

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
                onNavigate={(path) => navigate(path)}
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
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
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
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {chat.showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={chat.scrollToBottom}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-20"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Pending image preview */}
      {chat.pendingImage && (
        <div className="border-t border-border bg-muted/30">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="relative inline-block">
              <img src={chat.pendingImage} alt="Pending" className="h-20 rounded-lg object-cover" />
              <button onClick={() => chat.setPendingImage(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {chat.loading && (
            <motion.button
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              onClick={chat.handleStop}
              className="w-full mb-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-destructive/10 hover:text-destructive border border-border/50 transition-all"
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
              {chat.uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={chat.inputRef} value={chat.input} onChange={e => chat.setInput(e.target.value)} onKeyDown={chat.handleKeyDown}
                placeholder={chat.isListening ? '🎤 Listening...' : 'Ask anything...'}
                className={`w-full resize-none text-sm rounded-xl bg-muted/50 border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 px-4 py-3 pr-12 outline-none transition-all min-h-[48px] max-h-[150px] placeholder:text-muted-foreground/50 ${chat.isListening ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border/50'}`}
                disabled={chat.loading} rows={1}
              />
              <button
                onClick={chat.toggleVoice}
                className={`absolute right-3 bottom-3 p-1.5 rounded-lg transition-all ${chat.isListening ? 'bg-primary text-primary-foreground animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                title={chat.isListening ? 'Stop listening' : 'Voice input'}
              >
                {chat.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
            <Button size="icon" className="w-12 h-12 rounded-xl shrink-0 transition-all shadow-sm" onClick={() => chat.handleSend()} disabled={(!chat.input.trim() && !chat.pendingImage) || chat.loading}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-muted-foreground/50">
              {chat.input.length > 0 ? `${chat.input.length} chars` : 'Shift+Enter for new line • Ctrl+K to search'}
            </p>
            <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {chat.userId ? 'Synced' : 'Login to sync'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPage;
