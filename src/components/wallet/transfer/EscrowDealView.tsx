import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Shield, CheckCircle2, AlertTriangle, Clock, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Deal {
  id: string; buyer_id: string; seller_id: string;
  amount: number; fee_amount: number; seller_amount: number;
  description: string; status: string;
  delivered_note: string | null; dispute_reason: string | null;
  admin_resolution: string | null;
  created_at: string; funded_at: string | null;
  delivered_at: string | null; completed_at: string | null;
}

interface Msg {
  id: string; sender_id: string; sender_role: string;
  message: string; created_at: string;
}

interface Props {
  deal: Deal;
  userId: string;
  onBack: () => void;
  onChanged: () => void;
}

const STATUS_LABEL: Record<string, { color: string; label: string; icon: any }> = {
  pending_acceptance: { color: 'bg-amber-500/10 text-amber-600', label: 'Awaiting Seller', icon: Clock },
  funded: { color: 'bg-blue-500/10 text-blue-600', label: 'Funded', icon: Shield },
  delivered: { color: 'bg-violet-500/10 text-violet-600', label: 'Delivered', icon: CheckCircle2 },
  completed: { color: 'bg-green-500/10 text-green-600', label: 'Completed', icon: CheckCircle2 },
  disputed: { color: 'bg-red-500/10 text-red-600', label: 'Disputed', icon: AlertTriangle },
  refunded: { color: 'bg-muted text-muted-foreground', label: 'Refunded', icon: XCircle },
  cancelled: { color: 'bg-muted text-muted-foreground', label: 'Cancelled', icon: XCircle },
};

const EscrowDealView: React.FC<Props> = ({ deal: initialDeal, userId, onBack, onChanged }) => {
  const [deal, setDeal] = useState<Deal>(initialDeal);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [counterpartName, setCounterpartName] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBuyer = deal.buyer_id === userId;
  const meta = STATUS_LABEL[deal.status] || STATUS_LABEL.funded;
  const Icon = meta.icon;

  const reloadDeal = async () => {
    const { data } = await supabase.from('escrow_deals').select('*').eq('id', deal.id).single();
    if (data) setDeal(data as Deal);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('escrow_messages').select('*')
      .eq('deal_id', deal.id).order('created_at', { ascending: true });
    setMessages((data as Msg[]) || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  useEffect(() => {
    loadMessages();
    const otherId = isBuyer ? deal.seller_id : deal.buyer_id;
    supabase.from('profiles').select('name,email').eq('id', otherId).single()
      .then(({ data }) => setCounterpartName(data?.name || data?.email || 'Counterpart'));

    const ch = supabase
      .channel(`escrow-${deal.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escrow_messages', filter: `deal_id=eq.${deal.id}` },
        (p) => setMessages((m) => [...m, p.new as Msg]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'escrow_deals', filter: `id=eq.${deal.id}` },
        (p) => { setDeal(p.new as Deal); onChanged(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deal.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    const { error } = await supabase.rpc('send_escrow_message', { _sender_id: userId, _deal_id: deal.id, _message: text });
    if (error) { toast.error(error.message); setInput(text); }
  };

  const run = async (label: string, rpc: string, params: any) => {
    setBusy(label);
    try {
      const { error } = await supabase.rpc(rpc as any, params);
      if (error) throw error;
      toast.success(`${label} done`);
      await reloadDeal(); onChanged();
    } catch (e: any) { toast.error(e.message || 'Action failed'); }
    finally { setBusy(null); }
  };

  const sellerAccept = () => run('Accepted', 'seller_respond_escrow', { _seller_id: userId, _deal_id: deal.id, _accept: true });
  const sellerDecline = () => {
    if (!confirm('Decline this escrow request?')) return;
    run('Declined', 'seller_respond_escrow', { _seller_id: userId, _deal_id: deal.id, _accept: false });
  };
  const buyerCancel = () => {
    if (!confirm('Cancel this pending escrow?')) return;
    run('Cancelled', 'cancel_escrow_deal', { _buyer_id: userId, _deal_id: deal.id });
  };
  const sellerDeliver = async () => {
    const note = window.prompt('Delivery note (optional):') || '';
    run('Marked delivered', 'seller_mark_escrow_delivered', { _seller_id: userId, _deal_id: deal.id, _note: note || null });
  };
  const buyerRelease = () => {
    if (!confirm('Release funds to seller? This is FINAL.')) return;
    run('Released', 'buyer_confirm_escrow', { _buyer_id: userId, _deal_id: deal.id });
  };
  const openDispute = () => {
    const reason = window.prompt('Dispute reason (min 5 chars):');
    if (!reason || reason.trim().length < 5) { toast.error('Reason required'); return; }
    run('Dispute opened', 'dispute_escrow', { _user_id: userId, _deal_id: deal.id, _reason: reason.trim() });
  };

  // Timeline
  const timeline: { label: string; done: boolean; at?: string | null }[] = [
    { label: 'Created', done: true, at: deal.created_at },
    { label: 'Seller accepted', done: !!deal.funded_at, at: deal.funded_at },
    { label: 'Delivered', done: !!deal.delivered_at, at: deal.delivered_at },
    { label: 'Completed', done: !!deal.completed_at && deal.status !== 'refunded', at: deal.completed_at },
  ];

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <button onClick={onBack} className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{isBuyer ? `To: ${counterpartName}` : `From: ${counterpartName}`}</p>
          <p className="text-sm font-medium truncate">{deal.description}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full inline-flex items-center gap-1 ${meta.color}`}>
          <Icon className="w-3 h-3" /> {meta.label}
        </span>
      </div>

      {/* Summary card */}
      <div className="rounded-xl bg-muted/50 p-3 my-2 text-xs space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Amount held</span><span className="font-medium">₹{Number(deal.amount).toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (2%)</span><span>−₹{Number(deal.fee_amount).toFixed(2)}</span></div>
        <div className="flex justify-between font-medium border-t border-border pt-1"><span>Seller receives</span><span>₹{Number(deal.seller_amount).toFixed(2)}</span></div>
      </div>

      {/* Timeline */}
      <div className="flex items-center justify-between text-[10px] mb-2 px-1">
        {timeline.map((t, i) => (
          <React.Fragment key={t.label}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${t.done ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              <span className={t.done ? 'text-foreground font-medium' : 'text-muted-foreground'}>{t.label}</span>
            </div>
            {i < timeline.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${timeline[i + 1].done ? 'bg-primary' : 'bg-muted-foreground/20'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/20 rounded-xl p-2 space-y-2 min-h-32">
        {messages.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No messages yet. Say hi!</p>}
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

      {/* Chat input — disabled when terminal */}
      {!['completed', 'refunded', 'cancelled'].includes(deal.status) && (
        <div className="flex gap-2 mt-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a message…" className="rounded-xl h-10" />
          <Button onClick={send} size="icon" className="rounded-xl"><Send className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-2 space-y-2">
        {deal.status === 'pending_acceptance' && !isBuyer && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={sellerAccept} disabled={!!busy} className="rounded-xl btn-gradient h-10">
              {busy === 'Accepted' ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅ Accept'}
            </Button>
            <Button onClick={sellerDecline} disabled={!!busy} variant="outline" className="rounded-xl h-10">❌ Decline</Button>
          </div>
        )}
        {deal.status === 'pending_acceptance' && isBuyer && (
          <Button onClick={buyerCancel} disabled={!!busy} variant="outline" className="w-full rounded-xl h-10">Cancel Request</Button>
        )}
        {deal.status === 'funded' && !isBuyer && (
          <Button onClick={sellerDeliver} disabled={!!busy} className="w-full rounded-xl btn-gradient h-10">📦 Mark as Delivered</Button>
        )}
        {deal.status === 'funded' && isBuyer && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 text-center">
            ⏳ Waiting for seller to mark as delivered. Release will unlock after delivery.
          </div>
        )}
        {deal.status === 'delivered' && isBuyer && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={buyerRelease} disabled={!!busy} className="rounded-xl btn-gradient h-10">💰 Release Funds</Button>
            <Button onClick={openDispute} disabled={!!busy} variant="outline" className="rounded-xl h-10">⚠️ Dispute</Button>
          </div>
        )}
        {deal.status === 'delivered' && !isBuyer && (
          <p className="text-center text-xs text-muted-foreground">⏳ Waiting for buyer to release funds.</p>
        )}
        {deal.status === 'funded' && !isBuyer && (
          <Button onClick={openDispute} variant="ghost" size="sm" className="w-full text-xs">Open Dispute</Button>
        )}
        {deal.status === 'disputed' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-600">
            <p className="font-medium">⚠️ Under admin review</p>
            <p className="text-muted-foreground">Reason: {deal.dispute_reason}</p>
          </div>
        )}
        {(deal.status === 'completed' || deal.status === 'refunded' || deal.status === 'cancelled') && (
          <p className="text-center text-xs text-muted-foreground">This deal is closed.</p>
        )}
      </div>
    </div>
  );
};

export default EscrowDealView;
