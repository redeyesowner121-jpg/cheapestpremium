import React from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, MicOff, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  chat: any;
}

export const ChatInputArea: React.FC<Props> = ({ chat }) => (
  <div className="p-3 border-t border-border bg-background/95 backdrop-blur-sm">
    {chat.loading && (
      <motion.button
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
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
          ref={chat.inputRef}
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={chat.handleKeyDown}
          placeholder={chat.isListening ? '🎤 Listening...' : 'Ask anything...'}
          className={`w-full resize-none text-sm rounded-xl bg-muted/50 border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 px-3.5 py-2.5 pr-10 outline-none transition-all min-h-[42px] max-h-[120px] placeholder:text-muted-foreground/50 ${chat.isListening ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border/50'}`}
          disabled={chat.loading}
          rows={1}
        />
        <button
          onClick={chat.toggleVoice}
          className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all ${chat.isListening ? 'bg-primary text-primary-foreground animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          title={chat.isListening ? 'Stop listening' : 'Voice input'}
        >
          {chat.isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
      </div>
      <Button
        size="icon"
        className="w-10 h-10 rounded-xl shrink-0 transition-all shadow-sm"
        onClick={() => chat.handleSend()}
        disabled={(!chat.input.trim() && !chat.pendingImage) || chat.loading}
      >
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
);
