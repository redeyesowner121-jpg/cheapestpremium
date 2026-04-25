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
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-8 h-8 text-primary" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">Escrow — Safe Deals</p>
            <p className="text-xs text-muted-foreground">30-min auto-cancel · Buyer cancel · Chat filter</p>
          </div>
        </div>
        {pendingForMe > 0 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400 mb-2">
            🔔 {pendingForMe} request{pendingForMe > 1 ? 's' : ''} waiting for you
          </div>
        )}
        <Button onClick={() => { onClose?.(); navigate('/escrow'); }} className="w-full rounded-xl btn-gradient h-11">
          Open Escrow Dashboard →
        </Button>
      </div>
    </div>
  );
};

export default EscrowTab;
