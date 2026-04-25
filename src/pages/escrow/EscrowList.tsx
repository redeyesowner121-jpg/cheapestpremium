import React from 'react';
import { Shield, Plus, Clock, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { EscrowDeal, STATUS_META, isActive } from './types';
import { useCountdown } from './useCountdown';

interface Props {
  userId: string;
  deals: EscrowDeal[];
  loading: boolean;
  filter: 'all' | 'active' | 'closed';
  setFilter: (f: 'all' | 'active' | 'closed') => void;
  onCreate: () => void;
  onOpenDeal: (d: EscrowDeal) => void;
}

const DealCountdown: React.FC<{ deal: EscrowDeal }> = ({ deal }) => {
  const { label, expired } = useCountdown(
    deal.status === 'pending_acceptance' ? deal.expires_at : null
  );
  if (!label) return null;
  return (
    <span className={`text-[10px] font-mono inline-flex items-center gap-1 ${expired ? 'text-red-600' : 'text-amber-600'}`}>
      <Clock className="w-3 h-3" /> {expired ? 'expired' : label}
    </span>
  );
};

const EscrowList: React.FC<Props> = ({ userId, deals, loading, filter, setFilter, onCreate, onOpenDeal }) => {
  const navigate = useNavigate();
  const filteredDeals = deals.filter((d) => {
    if (filter === 'active') return isActive(d.status);
    if (filter === 'closed') return !isActive(d.status);
    return true;
  });
  const pendingForMe = deals.filter((d) => d.status === 'pending_acceptance' && d.seller_id === userId).length;

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground">← Back</button>
        <Button size="sm" onClick={onCreate} className="rounded-xl btn-gradient">
          <Plus className="w-4 h-4 mr-1" /> New Escrow
        </Button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Escrow — Safe Deals</h1>
            <p className="text-xs text-muted-foreground">Admin-mediated · 2% fee · 30-min auto-cancel · Built-in chat</p>
          </div>
        </div>
      </div>

      {pendingForMe > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Inbox className="w-4 h-4" />
          You have <b>{pendingForMe}</b> escrow request{pendingForMe > 1 ? 's' : ''} waiting for your acceptance.
        </div>
      )}

      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(['active', 'closed', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 text-xs py-2 rounded-lg capitalize transition-colors ${filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading deals…</div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filter === 'active' ? 'No active escrow deals.' : filter === 'closed' ? 'No closed deals yet.' : 'No escrow deals yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDeals.map((d) => {
            const isBuyer = d.buyer_id === userId;
            const meta = STATUS_META[d.status] || STATUS_META.funded;
            const needsAction =
              (d.status === 'pending_acceptance' && !isBuyer) ||
              (d.status === 'funded' && !isBuyer) ||
              ((d.status === 'delivered' || d.status === 'funded') && isBuyer);
            return (
              <button key={d.id}
                onClick={() => onOpenDeal(d)}
                className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-all hover:shadow-md hover:scale-[1.01]
                  ${needsAction ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">{isBuyer ? 'You → Seller' : 'Buyer → You'}</p>
                    <p className="font-medium text-foreground text-sm truncate">{d.description}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 border ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    ₹{Number(d.amount).toFixed(2)}
                    {!isBuyer && <span> · you get ₹{Number(d.seller_amount).toFixed(2)}</span>}
                  </span>
                  <DealCountdown deal={d} />
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

export default EscrowList;
