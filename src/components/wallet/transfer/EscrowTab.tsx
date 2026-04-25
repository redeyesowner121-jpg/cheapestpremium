import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EscrowTabProps {
  userId: string;
  walletBalance: number;
  onCompleted?: () => void;
  onClose?: () => void;
}

const EscrowTab: React.FC<EscrowTabProps> = ({ userId, onClose }) => {
  const navigate = useNavigate();
  const [pendingForMe, setPendingForMe] = useState(0);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('escrow_deals')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'pending_acceptance')
      .then(({ count }) => setPendingForMe(count || 0));
  }, [userId]);

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
