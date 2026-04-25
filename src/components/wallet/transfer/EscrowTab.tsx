import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Plus, AlertTriangle, CheckCircle2, Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EscrowTabProps {
  userId: string;
  walletBalance: number;
  onCompleted?: () => void;
}

type Deal = {
  id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  fee_amount: number;
  seller_amount: number;
  description: string;
  status: string;
  delivered_note: string | null;
  dispute_reason: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  funded: { color: 'bg-blue-500/10 text-blue-600', icon: Clock, label: 'Funded' },
  delivered: { color: 'bg-amber-500/10 text-amber-600', icon: Clock, label: 'Delivered' },
  completed: { color: 'bg-green-500/10 text-green-600', icon: CheckCircle2, label: 'Completed' },
  disputed: { color: 'bg-red-500/10 text-red-600', icon: AlertTriangle, label: 'Disputed' },
  refunded: { color: 'bg-muted text-muted-foreground', icon: CheckCircle2, label: 'Refunded' },
};

const EscrowTab: React.FC<EscrowTabProps> = ({ userId, walletBalance, onCompleted }) => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);

  // create form
  const [sellerEmail, setSellerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('escrow_deals')
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(20);
    setDeals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const fee = parseFloat(amount) * 0.02 || 0;
  const sellerGets = (parseFloat(amount) || 0) - fee;

  const handleCreate = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) { toast.error('Insufficient balance'); return; }
    if (!sellerEmail.includes('@')) { toast.error('Valid seller email required'); return; }
    if (description.trim().length < 5) { toast.error('Describe the deal (min 5 chars)'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_escrow_deal', {
        _buyer_id: userId, _seller_email: sellerEmail.trim(),
        _amount: amt, _description: description.trim(),
      });
      if (error) throw error;
      toast.success('Escrow funded! Seller has been notified.');
      setSellerEmail(''); setAmount(''); setDescription('');
      setView('list');
      load();
      onCompleted?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create escrow');
    } finally { setSubmitting(false); }
  };

  const sellerDeliver = async (dealId: string) => {
    const note = window.prompt('Optional delivery note for buyer:') || '';
    const { error } = await supabase.rpc('seller_mark_escrow_delivered', { _seller_id: userId, _deal_id: dealId, _note: note || null });
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as delivered');
    load();
  };

  const buyerConfirm = async (dealId: string) => {
    if (!confirm('Release funds to seller? This is final.')) return;
    const { error } = await supabase.rpc('buyer_confirm_escrow', { _buyer_id: userId, _deal_id: dealId });
    if (error) { toast.error(error.message); return; }
    toast.success('Funds released to seller');
    load(); onCompleted?.();
  };

  const openDispute = async (dealId: string) => {
    const reason = window.prompt('Reason for dispute:');
    if (!reason || reason.trim().length < 5) { toast.error('Provide a reason'); return; }
    const { error } = await supabase.rpc('dispute_escrow', { _user_id: userId, _deal_id: dealId, _reason: reason.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success('Dispute opened — admin will review');
    load();
  };

  if (view === 'create') {
    return (
      <div className="space-y-3">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex gap-2">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">Safe Deal via Admin</p>
            Funds are held until you confirm delivery. Admin mediates disputes. <span className="text-primary font-medium">2% platform fee</span> applies.
          </div>
        </div>
        <Input type="email" placeholder="Seller's email" value={sellerEmail}
          onChange={(e) => setSellerEmail(e.target.value)} className="rounded-xl h-12" />
        <Input type="number" placeholder="Amount (₹)" value={amount}
          onChange={(e) => setAmount(e.target.value)} className="rounded-xl h-12" />
        <Textarea placeholder="What is this deal for? (e.g. Netflix Premium 1 month)"
          value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl min-h-20" />
        {amount && parseFloat(amount) > 0 && (
          <div className="text-xs text-muted-foreground bg-muted rounded-xl p-3 space-y-1">
            <div className="flex justify-between"><span>Amount held</span><span>₹{parseFloat(amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Platform fee (2%)</span><span>−₹{fee.toFixed(2)}</span></div>
            <div className="flex justify-between font-medium text-foreground border-t border-border pt-1"><span>Seller receives</span><span>₹{sellerGets.toFixed(2)}</span></div>
          </div>
        )}
        <Button onClick={handleCreate} disabled={submitting} className="w-full h-12 btn-gradient rounded-xl">
          {submitting ? 'Creating…' : 'Fund Escrow'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-medium text-foreground">Escrow — Safe Deals</p>
          <p className="text-muted-foreground">Admin-mediated · 2% fee · Dispute protection</p>
        </div>
        <Button size="sm" onClick={() => setView('create')} className="rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Loading deals…</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No escrow deals yet.</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {deals.map((d) => {
            const isBuyer = d.buyer_id === userId;
            const meta = STATUS_META[d.status] || STATUS_META.funded;
            const Icon = meta.icon;
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{isBuyer ? 'You → Seller' : 'Buyer → You'}</p>
                    <p className="font-medium text-foreground text-sm truncate">{d.description}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" />{meta.label}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Amount: ₹{Number(d.amount).toFixed(2)}{!isBuyer && ` (you get ₹${Number(d.seller_amount).toFixed(2)})`}
                  </span>
                </div>
                {d.status === 'funded' && !isBuyer && (
                  <Button size="sm" variant="outline" className="w-full rounded-lg" onClick={() => sellerDeliver(d.id)}>Mark Delivered</Button>
                )}
                {(d.status === 'delivered' || d.status === 'funded') && isBuyer && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="rounded-lg btn-gradient" onClick={() => buyerConfirm(d.id)}>Release</Button>
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openDispute(d.id)}>Dispute</Button>
                  </div>
                )}
                {d.status === 'delivered' && !isBuyer && (
                  <p className="text-[11px] text-muted-foreground">Waiting for buyer to confirm.</p>
                )}
                {d.status === 'funded' && !isBuyer && (
                  <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => openDispute(d.id)}>Open Dispute</Button>
                )}
                {d.status === 'disputed' && (
                  <p className="text-[11px] text-red-600">Dispute under admin review.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EscrowTab;
