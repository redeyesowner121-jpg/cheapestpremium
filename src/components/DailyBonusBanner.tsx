import React, { useState, useEffect } from 'react';
import { Gift, X, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface DailyBonusBannerProps {
  onBonusClaimed?: () => void;
}

const DailyBonusBanner: React.FC<DailyBonusBannerProps> = React.memo(({ onBonusClaimed }) => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading } = useAuth();
  const [canClaimBonus, setCanClaimBonus] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkBonusEligibility();
  }, [profile]);

  const getISTDate = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  const checkBonusEligibility = () => {
    if (!profile) {
      setCanClaimBonus(false);
      return;
    }
    const lastBonus = profile.last_daily_bonus;
    if (!lastBonus) {
      setCanClaimBonus(true);
      return;
    }
    const today = getISTDate();
    setCanClaimBonus(lastBonus !== today);
  };

  const handleClaimBonus = async () => {
    if (!user || !profile || claiming) return;
    setClaiming(true);
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['daily_bonus_min', 'daily_bonus_max']);
      
      const settingsMap: Record<string, string> = {};
      settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });
      
      const minBonus = parseFloat(settingsMap.daily_bonus_min) || 0.10;
      const maxBonus = parseFloat(settingsMap.daily_bonus_max) || 1.00;
      const bonusAmount = Math.round((Math.random() * (maxBonus - minBonus) + minBonus) * 100) / 100;
      const newBalance = (profile.wallet_balance || 0) + bonusAmount;
      const todayDate = getISTDate();
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance, last_daily_bonus: todayDate })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        user_id: user.id, type: 'bonus', amount: bonusAmount,
        status: 'completed', description: 'Daily login bonus'
      });

      await supabase.from('notifications').insert({
        user_id: user.id, title: 'Daily Bonus! 🎁',
        message: `You earned ₹${bonusAmount} as your daily bonus!`, type: 'bonus'
      });

      toast.success(`🎉 You earned ₹${bonusAmount} daily bonus!`);
      setCanClaimBonus(false);
      await refreshProfile();
      onBonusClaimed?.();
    } catch (error) {
      console.error('Error claiming bonus:', error);
      toast.error('Failed to claim bonus');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return null;

  // Guest Login Banner
  if (!user) {
    if (dismissed) return null;
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent p-4 shadow-lg animate-fade-in">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg">Join Us! 🎉</h3>
            <p className="text-white/80 text-sm">Login for exclusive deals & daily bonus</p>
          </div>
          <Button
            onClick={() => navigate('/auth')}
            className="bg-white text-primary hover:bg-white/90 font-bold px-5 rounded-xl shadow-lg"
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            Login
          </Button>
        </div>
      </div>
    );
  }

  if (!profile || !canClaimBonus || dismissed) return null;

  // Daily Bonus Banner
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-4 shadow-lg animate-fade-in">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
      >
        <X className="w-4 h-4 text-white" />
      </button>
      <div className="relative flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
          <Gift className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg">Daily Bonus Available! 🎁</h3>
          <p className="text-white/80 text-sm">Claim your free bonus now!</p>
        </div>
        <Button
          onClick={handleClaimBonus}
          disabled={claiming}
          className="bg-white text-orange-600 hover:bg-white/90 font-bold px-6 rounded-xl shadow-lg"
        >
          {claiming ? 'Claiming...' : 'Claim'}
        </Button>
      </div>
    </div>
  );
});

DailyBonusBanner.displayName = 'DailyBonusBanner';

export default DailyBonusBanner;
