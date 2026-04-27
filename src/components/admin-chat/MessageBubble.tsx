import React from 'react';
import { motion } from 'framer-motion';
import { Reply } from 'lucide-react';
import { Message } from './useAdminChat';
import { formatChatTime } from './formatTime';

interface Props {
  message: Message;
  index: number;
  repliedMsg: Message | null;
  selectedUserName?: string;
  onReply: (m: Message) => void;
}

const MessageBubble: React.FC<Props> = ({ message, index, repliedMsg, selectedUserName, onReply }) => {
  return (
    <motion.div
      id={`admin-msg-${message.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`flex ${message.is_admin ? 'justify-end' : 'justify-start'} group transition-colors duration-500 rounded-xl`}
    >
      <div className="max-w-[75%] relative">
        <button
          onClick={() => onReply(message)}
          className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-muted hover:bg-muted/80 z-10 ${
            message.is_admin ? '-left-7' : '-right-7'
          }`}
        >
          <Reply className="w-3 h-3 text-muted-foreground" />
        </button>

        {repliedMsg && (
          <div
            onClick={() => {
              const el = document.getElementById(`admin-msg-${repliedMsg.id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('bg-primary/10');
                setTimeout(() => el.classList.remove('bg-primary/10'), 1500);
              }
            }}
            className={`text-[10px] mb-0.5 px-2 py-1 rounded-t-lg cursor-pointer border-l-2 ${
              message.is_admin
                ? 'bg-primary/20 border-primary-foreground/40 text-primary-foreground/80'
                : 'bg-muted/60 border-primary/50 text-muted-foreground'
            }`}
          >
            <span className="font-semibold">{repliedMsg.is_admin ? 'You' : selectedUserName || 'User'}</span>
            <p className="truncate">{repliedMsg.message || '📷 Photo'}</p>
          </div>
        )}

        <div
          className={`rounded-2xl px-3 py-2 ${repliedMsg ? 'rounded-t-sm' : ''} ${
            message.is_admin
              ? 'gradient-primary text-primary-foreground rounded-tr-none'
              : 'bg-muted rounded-tl-none'
          }`}
        >
          {message.image_url && (
            <img src={message.image_url} alt="Shared" className="rounded-lg mb-2 max-w-full cursor-pointer"
              onClick={() => window.open(message.image_url, '_blank')} />
          )}
          {message.message && message.message !== '📷 Photo' && (
            <p className="text-sm">{message.message}</p>
          )}
          <p className={`text-[10px] mt-1 text-right ${message.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {formatChatTime(message.created_at)}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
