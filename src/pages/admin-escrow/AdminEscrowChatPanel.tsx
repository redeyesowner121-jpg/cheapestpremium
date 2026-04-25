import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';

interface Msg {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface Props {
  dealId: string;
  adminId: string;
  buyerId: string;
  sellerId: string;
  onClose: () => void;
}

const AdminEscrowChatPanel: React.FC<Props> = ({ dealId, adminId, buyerId, sellerId, onClose }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from('escrow_messages').select('*')
      .eq('deal_id', dealId).order('created_at', { ascending: true });
    setMessages((data as Msg[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`admin-escrow-chat-${dealId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escrow_messages', filter: `deal_id=eq.${dealId}` },
        (p) => setMessages((m) => [...m, p.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dealId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc('send_escrow_message', { _sender_id: adminId, _deal_id: dealId, _message: text });
      if (error) throw error;
      setInput('');
    } catch (e: any) {
      toast.error(e.message || 'Send failed');
    } finally { setSending(false); }
  };

  const labelFor = (m: Msg) => {
    if (m.sender_role === 'admin') return '🛡️ Admin';
    if (m.sender_role === 'system') return 'System';
    if (m.sender_id === buyerId) return 'Buyer';
    if (m.sender_id === sellerId) return 'Seller';
    return m.sender_role;
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <MessageSquare className="w-4 h-4" /> Deal Chat (admin view)
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto p-3 space-y-2 bg-muted/20">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">No messages yet.</p>
        ) : messages.map((m) => (
          <div key={m.id} className={`text-xs ${m.sender_role === 'admin' ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <b>{labelFor(m)}</b>
              <span>· {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <div className={`mt-0.5 rounded-lg px-2 py-1 inline-block max-w-full break-words ${m.sender_role === 'admin' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-card border border-border'}`}>
              {m.message}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 p-2 border-t border-border bg-card">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
          placeholder="Send a message as Admin…"
          className="rounded-lg h-9 text-sm"
        />
        <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="rounded-lg h-9 w-9">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AdminEscrowChatPanel;
