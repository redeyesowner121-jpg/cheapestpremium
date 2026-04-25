import React, { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ShieldAlert } from 'lucide-react';
import { EscrowMsg } from './types';

interface Props {
  messages: EscrowMsg[];
  userId: string;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  disabledReason?: string;
  validationError: string | null;
}

const DealChat: React.FC<Props> = ({ messages, userId, input, setInput, onSend, disabled, disabledReason, validationError }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/20 rounded-xl p-3 space-y-2 min-h-48">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">
            No messages yet. Stay on-platform — sharing contacts is blocked.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const isSystem = m.sender_role === 'system';
          if (isSystem) return (
            <div key={m.id} className="text-center">
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{m.message}</span>
            </div>
          );
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                {m.message}
                <div className={`text-[9px] mt-0.5 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {validationError && (
        <div className="mt-2 text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded-xl p-2 flex items-start gap-1">
          <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" /> {validationError}
        </div>
      )}

      {disabled ? (
        <div className="mt-2 text-center text-xs text-muted-foreground p-2 bg-muted rounded-xl">
          🔒 {disabledReason || 'Chat is disabled.'}
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Type a message… (no emails / phones / links)"
            className="rounded-xl h-10"
          />
          <Button onClick={onSend} size="icon" className="rounded-xl" disabled={!!validationError || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DealChat;
