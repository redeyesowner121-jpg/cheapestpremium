export interface EscrowDeal {
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
  admin_resolution: string | null;
  created_at: string;
  funded_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

export interface EscrowMsg {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export const STATUS_META: Record<string, { color: string; label: string }> = {
  pending_acceptance: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', label: 'Awaiting Seller' },
  funded: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', label: 'Funded' },
  delivered: { color: 'bg-violet-500/10 text-violet-600 border-violet-500/30', label: 'Delivered' },
  completed: { color: 'bg-green-500/10 text-green-600 border-green-500/30', label: 'Completed' },
  disputed: { color: 'bg-red-500/10 text-red-600 border-red-500/30', label: 'Disputed' },
  refunded: { color: 'bg-muted text-muted-foreground border-border', label: 'Refunded' },
  cancelled: { color: 'bg-muted text-muted-foreground border-border', label: 'Cancelled' },
};

export const isClosed = (s: string) => ['completed', 'refunded', 'cancelled'].includes(s);
export const isActive = (s: string) => ['pending_acceptance', 'funded', 'delivered', 'disputed'].includes(s);
