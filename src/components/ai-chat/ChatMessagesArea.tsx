import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, Search, X } from 'lucide-react';
import { MessageBubble, FollowUpChips } from './ChatMessageBubble';
import ChatEmptyState from './ChatEmptyState';

interface Props {
  chat: any;
  onClose: () => void;
}

export const ChatMessagesArea: React.FC<Props> = ({ chat, onClose }) => (
  <>
    <AnimatePresence>
      {chat.searchMode && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-border"
        >
          <div className="px-3 py-2 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={chat.searchInputRef}
              type="text"
              value={chat.searchTerm}
              onChange={(e) => chat.setSearchTerm(e.target.value)}
              placeholder="Search in conversation..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            {chat.searchTerm && (
              <span className="text-[10px] text-muted-foreground shrink-0">{chat.filteredMessages.length} found</span>
            )}
            <button onClick={() => { chat.setSearchMode(false); chat.setSearchTerm(''); }} className="p-0.5">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <div ref={chat.scrollRef} onScroll={chat.handleScroll} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
      {chat.messages.length === 0 && <ChatEmptyState onSend={chat.handleSend} />}

      {chat.filteredMessages.map((msg: any) => {
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
            onNavigate={(path: string) => { onClose(); window.location.href = path; }}
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
              <span className="text-[10px] font-medium text-muted-foreground">RKR AI is thinking...</span>
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-tl-sm border border-border/40 px-4 py-3">
              <div className="flex gap-1.5 items-center">
                {[0, 0.15, 0.3].map((d) => (
                  <motion.span
                    key={d}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: d }}
                    className="w-2 h-2 bg-primary/50 rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>

    <AnimatePresence>
      {chat.showScrollDown && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={chat.scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>

    {chat.pendingImage && (
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <div className="relative inline-block">
          <img src={chat.pendingImage} alt="Pending" className="h-16 rounded-lg object-cover" />
          <button
            onClick={() => chat.setPendingImage(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    )}
  </>
);
