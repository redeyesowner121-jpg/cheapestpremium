import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Plus, AlertTriangle, CheckCircle2, Clock, ArrowLeft, XCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EscrowDealView from './EscrowDealView';

interface EscrowTabProps {
  userId: string;
  walletBalance: number;
  onCompleted?: () => void;
  /** Called when the escrow flow needs to redirect away (e.g. for top-up) */
  onClose?: () => void;
}

type Deal = {
  id: string; buyer_id: string; seller_id: string;
  amount: number; fee_amount: number; seller_amount: number;
  description: string; status: string;
  delivered_note: string | null; dispute_reason: string | null;
  admin_resolution: string | null;
  created_at: string; funded_at: string | null;
  delivered_at: string | null; completed_at: string | null;
};

const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  pending_acceptance: { color: 'bg-amber-500/10 text-amber-600', icon: Clock, label: 'Awaiting Seller' },
  funded: { color: 'bg-blue-500/10 text-blue-600', icon: Shield, label: 'Funded' },
  delivered: { color: 'bg-violet-500/10 text-violet-600', icon: Clock, label: 'Delivered' },
  completed: { color: 'bg-green-500/10 text-green-600', icon: CheckCircle2, label: 'Completed' },
  disputed: { color: 'bg-red-500/10 text-red-600', icon: AlertTriangle, label: 'Disputed' },
  refunded: { color: 'bg-muted text-muted-foreground', icon: XCircle, label: 'Refunded' },
  cancelled: { color: 'bg-muted text-muted-foreground', icon: XCircle, label: 'Cancelled' },
};

const EscrowTab: React.FC<EscrowTabProps> = ({ userId, walletBalance, onCompleted, onClose }) => {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active');

  // create form
  const [sellerEmail, setSellerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('escrow_deals').select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false }).limit(50);
    setDeals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  // Realtime: refresh list when any deal involving me changes
  useEffect(() => {
    const ch = supabase.channel('escrow-list-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrow_deals' },
        (p: any) => {
          const row = p.new || p.old;
          if (row && (row.buyer_id === userId || row.seller_id === userId)) load();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const fee = parseFloat(amount) * 0.02 || 0;
  const sellerGets = (parseFloat(amount) || 0) - fee;

  const handleCreate = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) {
      const need = (amt - walletBalance).toFixed(2);
      toast.error('Insufficient balance — redirecting to top-up.');
      onClose?.();
      navigate(`/wallet?deposit=1&reason=insufficient&amount=${need}`);
      return;
    }
    if (!sellerEmail.includes('@')) { toast.error('Valid seller email required'); return; }
    if (description.trim().length < 5) { toast.error('Describe the deal (min 5 chars)'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_escrow_deal', {
        _buyer_id: userId, _seller_email: sellerEmail.trim(),
        _amount: amt, _description: description.trim(),
      });
      if (error) throw error;
      toast.success('Escrow request sent! Waiting for seller acceptance.');
      setSellerEmail(''); setAmount(''); setDescription('');
      setView('list'); load(); onCompleted?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create escrow');
    } finally { setSubmitting(false); }
  };

  // ========== DETAIL VIEW ==========
  if (view === 'detail' && activeDeal) {
    return <EscrowDealView deal={activeDeal} userId={userId}
      onBack={() => { setView('list'); load(); }}
      onChanged={() => { load(); onCompleted?.(); }} />;
  }

  // ========== CREATE VIEW ==========
  if (view === 'create') {
    return (
      <div className="space-y-3">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3 flex gap-2">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">Safe Deal — Admin Mediated</p>
            Seller must accept first. Funds are held only after acceptance. Dispute protection included.
            <span className="text-primary font-medium"> 2% platform fee</span>.
          </div>
        </div>
        <Input type="email" placeholder="Seller's email" value={sellerEmail}
          onChange={(e) => setSellerEmail(e.target.value)} className="rounded-xl h-12" />
        <Input type="number" placeholder="Amount (₹)" value={amount}
          onChange={(e) => setAmount(e.target.value)} className="rounded-xl h-12" />
        <Textarea placeholder="What is this deal for? (e.g. Netflix Premium 1 month — login email & pass)"
          value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl min-h-20" />
        {amount && parseFloat(amount) > 0 && (
          <div className="text-xs bg-muted rounded-xl p-3 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Amount held</span><span>₹{parseFloat(amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (2%)</span><span>−₹{fee.toFixed(2)}</span></div>
            <div className="flex justify-between font-medium border-t border-border pt-1"><span>Seller receives</span><span>₹{sellerGets.toFixed(2)}</span></div>
          </div>
        )}
        <Button onClick={handleCreate} disabled={submitting} className="w-full h-12 btn-gradient rounded-xl">
          {submitting ? 'Sending Request…' : 'Send Escrow Request'}
        </Button>
      </div>
    );
  }

  // ========== LIST VIEW ==========
  const isActive = (s: string) => ['pending_acceptance', 'funded', 'delivered', 'disputed'].includes(s);
  const filteredDeals = deals.filter((d) => {
    if (filter === 'active') return isActive(d.status);
    if (filter === 'closed') return !isActive(d.status);
    return true;
  });
  const pendingForMe = deals.filter((d) => d.status === 'pending_acceptance' && d.seller_id === userId).length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3 flex items-center gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-medium text-foreground">Escrow — Safe Deals</p>
          <p className="text-muted-foreground">Admin-mediated · 2% fee · Built-in chat</p>
        </div>
        <Button size="sm" onClick={() => setView('create')} className="rounded-xl btn-gradient">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {pendingForMe > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400">
          🔔 You have <b>{pendingForMe}</b> escrow request{pendingForMe > 1 ? 's' : ''} waiting for your acceptance.
        </div>
      )}

      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(['active', 'closed', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 text-xs py-1.5 rounded-lg capitalize transition-colors ${filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Loading deals…</div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {filter === 'active' ? 'No active escrow deals.' : filter === 'closed' ? 'No closed deals yet.' : 'No escrow deals yet.'}
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredDeals.map((d) => {
            const isBuyer = d.buyer_id === userId;
            const meta = STATUS_META[d.status] || STATUS_META.funded;
            const Icon = meta.icon;
            const needsAction =
              (d.status === 'pending_acceptance' && !isBuyer) ||
              (d.status === 'funded' && !isBuyer) ||
              ((d.status === 'delivered' || d.status === 'funded') && isBuyer);
            return (
              <button key={d.id}
                onClick={() => { setActiveDeal(d); setView('detail'); }}
                className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors hover:bg-muted/30
                  ${needsAction ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">{isBuyer ? 'You → Seller' : 'Buyer → You'}</p>
                    <p className="font-medium text-foreground text-sm truncate">{d.description}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${meta.color}`}>
                    <Icon className="w-3 h-3" />{meta.label}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    ₹{Number(d.amount).toFixed(2)}
                    {!isBuyer && <span> · you get ₹{Number(d.seller_amount).toFixed(2)}</span>}
                  </span>
                  <span className="text-primary inline-flex items-center gap-1 text-[10px]">
                    <MessageSquare className="w-3 h-3" /> Open
                  </span>
                </div>
                {needsAction && <p className="text-[10px] text-primary font-medium">⚡ Action needed</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EscrowTab;
