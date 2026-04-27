import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const istToday = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString().split('T')[0];
};

export function useDailyBonus(profile: any, user: any, refreshProfile: () => Promise<void> | void) {
  const [claiming, setClaiming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [amount, setAmount] = useState(0);

  const canClaim = () => !profile?.last_daily_bonus || profile.last_daily_bonus !== istToday();

  const claim = async (onClaimed?: () => void) => {
    if (!user || !profile) return;
    const today = istToday();
    if (profile.last_daily_bonus === today) {
      toast.error('You have already claimed your daily bonus today!');
      return;
    }
    setClaiming(true);
    const bonusAmount = parseFloat((Math.random() * 0.5 + 0.1).toFixed(2));
    try {
      const newBalance = (profile.wallet_balance || 0) + bonusAmount;
      await supabase.from('profiles')
        .update({ wallet_balance: newBalance, last_daily_bonus: today })
        .eq('id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'bonus', amount: bonusAmount,
        status: 'completed', description: 'Daily sign-in bonus'
      });
      await refreshProfile();
      onClaimed?.();
      setAmount(bonusAmount);
      setShowSuccess(true);
    } catch {
      toast.error('Failed to claim bonus');
    } finally {
      setClaiming(false);
    }
  };

  return { claiming, claim, canClaim, showSuccess, setShowSuccess, amount };
}
