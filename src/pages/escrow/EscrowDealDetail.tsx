import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Shield, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EscrowDeal, EscrowMsg, STATUS_META, isClosed } from './types';
import { useCountdown } from './useCountdown';
import { validateEscrowMessage } from './contactFilter';
import DealActions from './DealActions';
import DealChat from './DealChat';

interface Props {
  dealId: string;
  userId: string;
  onBack: () => void;
}

const EscrowDealDetail: React.FC<Props> = ({ dealId, userId, onBack }) => {
  const [deal, setDeal] = useState<EscrowDeal | null>(null);
  const [messages, setMessages] = useState<EscrowMsg[]>([]);
  const [counterpartName, setCounterpartName] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const isBuyer = deal?.buyer_id === userId;
  const meta = deal ? (STATUS_META[deal.status] || STATUS_META.funded) : null;

  const { label: countdownLabel, expired } = useCountdown(
    deal?.status === 'pending_acceptance' ? deal?.expires_at : null
  );

  const validationError = useMemo(
    () => (input.trim() ? validateEscrowMessage(input) : null),
    [input]
  );

  const reloadDeal = async () => {
    const { data } = await supabase.from('escrow_deals').select('*').eq('id', dealId).single();
    if (data) setDeal(data as EscrowDeal);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('escrow_messages').select('*')
      .eq('deal_id', dealId).order('created_at', { ascending: true });
    setMessages((data as EscrowMsg[]) || []);
  };

  useEffect(() => {
    reloadDeal();
    loadMessages();
  }, [dealId]);

  useEffect(() => {
    if (!deal) return;
    const otherId = deal.buyer_id === userId ? deal.seller_id : deal.buyer_id;
    supabase.from('profiles').select('name').eq('id', otherId).single()
      .then(({ data }) => setCounterpartName(data?.name || 'Counterpart'));

    const ch = supabase
      .channel(`escrow-detail-${dealId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escrow_messages', filter: `deal_id=eq.${dealId}` },
        (p) => setMessages((m) => [...m, p.new as EscrowMsg]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'escrow_deals', filter: `id=eq.${dealId}` },
        (p) => setDeal(p.new as EscrowDeal))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dealId, deal?.buyer_id]);

  const send = async () => {
    if (!input.trim()) return;
    if (validationError) { toast.error(validationError); return; }
    if (deal && (isClosed(deal.status) || expired)) {
      toast.error('Deal is closed — no messages allowed');
      return;
    }
    const text = input.trim();
    setInput('');

    // AI moderation — catches obfuscated contact-sharing the regex misses.
    try {
      const { data: mod, error: modErr } = await supabase.functions.invoke('escrow-moderate-message', {
        body: { message: text },
      });
      if (!modErr && mod?.blocked) {
        toast.error(mod.reason || 'Message blocked: contact-sharing not allowed');
        setInput(text);
        return;
      }
    } catch (e) {
      // fail-open: don't break chat if AI is unreachable
      console.warn('escrow moderation skipped', e);
    }

    const { error } = await supabase.rpc('send_escrow_message', { _sender_id: userId, _deal_id: dealId, _message: text });
    if (error) {
      toast.error(error.message || 'Message blocked');
      setInput(text);
    }
  };

  const run = async (label: string, rpc: string, params: any) => {
    setBusy(label);
    try {
      const { error } = await supabase.rpc(rpc as any, params);
      if (error) throw error;
      toast.success(`${label} ✓`);
      await reloadDeal();
    } catch (e: any) { toast.error(e.message || 'Action failed'); }
    finally { setBusy(null); }
  };

  if (!deal) return <div className="text-center py-8 text-muted-foreground">Loading…</div>;

  const sellerAccept = () => run('Accepted', 'seller_respond_escrow', { _seller_id: userId, _deal_id: dealId, _accept: true });
  const sellerDecline = () => { if (confirm('Decline this escrow request?')) run('Declined', 'seller_respond_escrow', { _seller_id: userId, _deal_id: dealId, _accept: false }); };
  const buyerCancelPending = () => { if (confirm('Cancel this pending escrow?')) run('Cancelled', 'cancel_escrow_deal', { _buyer_id: userId, _deal_id: dealId }); };
  const buyerCancelFunded = () => {
    if (confirm('Cancel this funded escrow and get a refund? Only allowed BEFORE seller delivers.')) {
      run('Cancelled & Refunded', 'buyer_cancel_funded_escrow', { _buyer_id: userId, _deal_id: dealId });
    }
  };
  const sellerDeliver = () => {
    const note = window.prompt('Delivery note (optional):') || '';
    run('Marked delivered', 'seller_mark_escrow_delivered', { _seller_id: userId, _deal_id: dealId, _note: note || null });
  };
  const buyerRelease = () => { if (confirm('Release funds to seller? This is FINAL.')) run('Released', 'buyer_confirm_escrow', { _buyer_id: userId, _deal_id: dealId }); };
  const openDispute = () => {
    const reason = window.prompt('Dispute reason (min 5 chars):');
    if (!reason || reason.trim().length < 5) { toast.error('Reason required'); return; }
    run('Dispute opened', 'dispute_escrow', { _user_id: userId, _deal_id: dealId, _reason: reason.trim() });
  };

  const chatDisabled = isClosed(deal.status) || (deal.status === 'pending_acceptance' && expired);
  const chatDisabledReason = isClosed(deal.status)
    ? 'This deal is closed — no further messages.'
    : expired ? 'Escrow expired — no further messages.' : '';

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <button onClick={onBack} className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{isBuyer ? `To: ${counterpartName}` : `From: ${counterpartName}`}</p>
          <p className="text-sm font-semibold truncate">{deal.description}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full inline-flex items-center gap-1 border ${meta?.color}`}>
          <Shield className="w-3 h-3" /> {meta?.label}
        </span>
      </div>

      {/* Countdown banner for pending */}
      {deal.status === 'pending_acceptance' && countdownLabel && (
        <div className={`mt-2 rounded-xl border p-2 text-xs flex items-center justify-center gap-2 font-mono
          ${expired ? 'bg-red-500/10 border-red-500/30 text-red-600' : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'}`}>
          <Clock className="w-4 h-4" />
          {expired ? 'EXPIRED — auto-cancelling…' : <>Auto-cancel in <b>{countdownLabel}</b></>}
        </div>
      )}

      {/* Summary card */}
      <div className="rounded-xl bg-muted/50 p-3 my-2 text-xs space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Amount held</span><span className="font-medium">₹{Number(deal.amount).toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (2%)</span><span>−₹{Number(deal.fee_amount).toFixed(2)}</span></div>
        <div className="flex justify-between font-medium border-t border-border pt-1"><span>Seller receives</span><span>₹{Number(deal.seller_amount).toFixed(2)}</span></div>
      </div>

      {/* Chat fills remaining space */}
      <DealChat
        messages={messages}
        userId={userId}
        input={input}
        setInput={setInput}
        onSend={send}
        disabled={chatDisabled}
        disabledReason={chatDisabledReason}
        validationError={validationError}
      />

      {/* Actions */}
      <div className="mt-3">
        <DealActions
          deal={deal}
          isBuyer={!!isBuyer}
          busy={busy}
          expired={expired}
          onSellerAccept={sellerAccept}
          onSellerDecline={sellerDecline}
          onBuyerCancelPending={buyerCancelPending}
          onBuyerCancelFunded={buyerCancelFunded}
          onSellerDeliver={sellerDeliver}
          onBuyerRelease={buyerRelease}
          onOpenDispute={openDispute}
        />
      </div>
    </div>
  );
};

export default EscrowDealDetail;
