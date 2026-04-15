import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, RotateCcw, Sparkles, Clock, Zap } from 'lucide-react';
import { MarkdownContent, StreamingCursor } from './ChatMarkdown';
import { Msg, formatTime } from './types';

export const MessageBubble = React.memo(({ msg, onCopy, onRetry, isLast, isLoading, isStreaming, searchTerm, onNavigate }: {
  msg: Msg; onCopy: () => void; onRetry?: () => void; isLast: boolean; isLoading: boolean; isStreaming: boolean; searchTerm: string; onNavigate?: (path: string) => void;
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
              <MarkdownContent content={searchTerm ? highlightContent(msg.content) : msg.content} onNavigate={onNavigate} />
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

export const FollowUpChips = React.memo(({ suggestions, onSelect }: { suggestions: string[]; onSelect: (s: string) => void }) => (
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
