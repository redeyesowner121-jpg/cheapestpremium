import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { EscrowDeal } from './types';

interface Props {
  deal: EscrowDeal;
  isBuyer: boolean;
  busy: string | null;
  expired: boolean;
  onSellerAccept: () => void;
  onSellerDecline: () => void;
  onBuyerCancelPending: () => void;
  onBuyerCancelFunded: () => void;
  onSellerDeliver: () => void;
  onBuyerRelease: () => void;
  onOpenDispute: () => void;
}

const DealActions: React.FC<Props> = ({
  deal, isBuyer, busy, expired,
  onSellerAccept, onSellerDecline, onBuyerCancelPending, onBuyerCancelFunded,
  onSellerDeliver, onBuyerRelease, onOpenDispute,
}) => {
  if (expired && deal.status === 'pending_acceptance') {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-600 text-center">
        ⏱️ This escrow has expired. It will auto-cancel shortly.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deal.status === 'pending_acceptance' && !isBuyer && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onSellerAccept} disabled={!!busy} className="rounded-xl btn-gradient h-11">
            {busy === 'Accepted' ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅ Accept'}
          </Button>
          <Button onClick={onSellerDecline} disabled={!!busy} variant="outline" className="rounded-xl h-11">❌ Decline</Button>
        </div>
      )}

      {deal.status === 'pending_acceptance' && isBuyer && (
        <Button onClick={onBuyerCancelPending} disabled={!!busy} variant="outline" className="w-full rounded-xl h-11">
          Cancel Request
        </Button>
      )}

      {deal.status === 'funded' && !isBuyer && (
        <Button onClick={onSellerDeliver} disabled={!!busy} className="w-full rounded-xl btn-gradient h-11">
          📦 Mark as Delivered
        </Button>
      )}

      {/* Buyer can cancel funded deal BEFORE delivery */}
      {deal.status === 'funded' && isBuyer && (
        <Button onClick={onBuyerCancelFunded} disabled={!!busy} variant="destructive" className="w-full rounded-xl h-11">
          🚫 Cancel & Get Refund (before delivery)
        </Button>
      )}

      {(deal.status === 'delivered') && isBuyer && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onBuyerRelease} disabled={!!busy} className="rounded-xl btn-gradient h-11">💰 Release Funds</Button>
          <Button onClick={onOpenDispute} disabled={!!busy} variant="outline" className="rounded-xl h-11">⚠️ Dispute</Button>
        </div>
      )}

      {deal.status === 'funded' && !isBuyer && (
        <Button onClick={onOpenDispute} variant="ghost" size="sm" className="w-full text-xs">Open Dispute</Button>
      )}

      {deal.status === 'disputed' && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-600">
          <p className="font-medium">⚠️ Under admin review</p>
          <p className="text-muted-foreground mt-1">Reason: {deal.dispute_reason}</p>
        </div>
      )}

      {(deal.status === 'completed' || deal.status === 'refunded' || deal.status === 'cancelled') && (
        <div className="text-center text-xs text-muted-foreground p-3 bg-muted rounded-xl">
          🔒 This deal is closed. No further actions or messages allowed.
        </div>
      )}
    </div>
  );
};

export default DealActions;
