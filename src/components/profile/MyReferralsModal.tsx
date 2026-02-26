import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Users, ShoppingBag, IndianRupee } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ReferredUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  total_orders: number;
  created_at: string;
  total_spent: number;
}

interface MyReferralsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode: string;
}

const MyReferralsModal: React.FC<MyReferralsModalProps> = ({ open, onOpenChange, referralCode }) => {
  const [referrals, setReferrals] = useState<ReferredUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !referralCode) return;

    const fetchReferrals = async () => {
      setLoading(true);
      try {
        // Get profiles referred by this user's code
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, total_orders, created_at')
          .eq('referred_by', referralCode);

        if (!profiles || profiles.length === 0) {
          setReferrals([]);
          setLoading(false);
          return;
        }

        // For each referred user, get their total purchase amount
        const results: ReferredUser[] = [];
        for (const p of profiles) {
          const { data: orders } = await supabase
            .from('orders')
            .select('total_price')
            .eq('user_id', p.id)
            .in('status', ['completed', 'delivered', 'shipped', 'processing']);

          const totalSpent = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
          results.push({ ...p, total_spent: totalSpent });
        }

        setReferrals(results);
      } catch (err) {
        console.error('Failed to fetch referrals', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReferrals();
  }, [open, referralCode]);

  const totalEarnings = referrals.reduce((s, r) => s + r.total_spent, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            My Referrals ({referrals.length})
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-primary">{referrals.length}</p>
            <p className="text-xs text-muted-foreground">Total Referrals</p>
          </div>
          <div className="bg-accent/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-accent">₹{totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Their Purchases</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))
          ) : referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No referrals yet</p>
              <p className="text-muted-foreground/70 text-xs mt-1">Share your referral code to earn bonuses!</p>
            </div>
          ) : (
            referrals.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt={r.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    r.name?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShoppingBag className="w-3 h-3" /> {r.total_orders || 0} orders
                    </span>
                    <span className="flex items-center gap-1 text-xs text-primary font-medium">
                      <IndianRupee className="w-3 h-3" /> ₹{r.total_spent.toFixed(0)} spent
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyReferralsModal;
