import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mic, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { SUGGESTIONS } from './types';

interface ChatEmptyStateProps {
  onSend: (text: string) => void;
}

const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ onSend }) => (
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
          onClick={() => onSend(`${s.icon} ${s.text}`)}
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
);

export default ChatEmptyState;
