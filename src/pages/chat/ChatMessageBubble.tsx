import React from 'react';
import { motion } from 'framer-motion';
import { Reply } from 'lucide-react';
import { ChatMessage, formatChatTime } from './types';

interface Props {
  message: ChatMessage;
  index: number;
  repliedMsg: ChatMessage | null;
  onReply: (m: ChatMessage) => void;
  onScrollToReply: (id: string) => void;
}

const ChatMessageBubble: React.FC<Props> = ({ message, index, repliedMsg, onReply, onScrollToReply }) => (
  <motion.div
    id={`msg-${message.id}`}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(index * 0.02, 0.5) }}
    className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'} group transition-colors duration-500 rounded-xl`}
  >
    <div className="max-w-[80%] relative">
      <button
        onClick={() => onReply(message)}
        className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-muted hover:bg-muted/80 ${
          message.is_admin ? '-right-8' : '-left-8'
        }`}
      >
        <Reply className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {repliedMsg && (
        <div
          onClick={() => onScrollToReply(repliedMsg.id)}
          className={`text-[11px] mb-1 px-3 py-1.5 rounded-t-xl cursor-pointer border-l-2 ${
            message.is_admin
              ? 'bg-muted/60 border-primary/50 text-muted-foreground'
              : 'bg-primary/80 border-primary-foreground/40 text-primary-foreground/80'
          }`}
        >
          <span className="font-semibold">{repliedMsg.is_admin ? 'Admin' : 'You'}</span>
          <p className="truncate">{repliedMsg.message || '📷 Photo'}</p>
        </div>
      )}

      <div className={`rounded-2xl px-4 py-2.5 ${repliedMsg ? 'rounded-t-sm' : ''} ${
        message.is_admin
          ? 'bg-card shadow-sm border border-border/50 rounded-tl-sm'
          : 'bg-primary text-primary-foreground rounded-tr-sm'
      }`}>
        {message.image_url && (
          <img src={message.image_url} alt="Shared" className="rounded-lg mb-2 max-w-full cursor-pointer"
            onClick={() => window.open(message.image_url, '_blank')} />
        )}
        {message.message && message.message !== '📷 Photo' && (
          <p className={`text-sm leading-relaxed ${message.is_admin ? 'text-foreground' : ''}`}>{message.message}</p>
        )}
        <p className={`text-[10px] mt-1 text-right ${message.is_admin ? 'text-muted-foreground' : 'text-primary-foreground/60'}`}>
          {formatChatTime(message.created_at)}
        </p>
      </div>
    </div>
  </motion.div>
);

export default ChatMessageBubble;
