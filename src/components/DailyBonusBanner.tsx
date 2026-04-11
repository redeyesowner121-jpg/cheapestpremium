import React, { useState, useEffect } from 'react';
import { Gift, X, LogIn, UserPlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

interface DailyBonusBannerProps {
  onBonusClaimed?: () => void;
}

const DailyBonusBanner: React.FC<DailyBonusBannerProps> = React.memo(({ onBonusClaimed }) => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading } = useAuth();
  const { settings } = useAppSettingsContext();
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
    if (!profile) { setCanClaimBonus(false); return; }
    const lastBonus = profile.last_daily_bonus;
    if (!lastBonus) { setCanClaimBonus(true); return; }
    const today = getISTDate();
    setCanClaimBonus(lastBonus !== today);
  };

  const handleClaimBonus = async () => {
    if (!user || !profile || claiming) return;
    setClaiming(true);
    try {
      const minBonus = settings.daily_bonus_min || 0.10;
      const maxBonus = settings.daily_bonus_max || 1.00;
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
      <div className="relative overflow-hidden rounded-2xl gradient-primary p-4 shadow-colored-primary animate-fade-in">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="relative flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center animate-float">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-extrabold text-lg font-display tracking-tight">Join Us! 🎉</h3>
            <p className="text-white/80 text-[11px] font-medium">Login for exclusive deals & daily bonus</p>
          </div>
          <Button
            onClick={() => navigate('/auth')}
            className="bg-white text-primary hover:bg-white/90 font-extrabold px-5 rounded-xl shadow-lg text-sm"
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            Login
          </Button>
        </div>
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full" />
        <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
      </div>
    );
  }

  if (!profile || !canClaimBonus || dismissed || !profile.has_blue_check) return null;

  // Daily Bonus Banner
  return (
    <div className="relative overflow-hidden rounded-2xl gradient-warm p-4 shadow-colored-accent animate-fade-in">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
      >
        <X className="w-4 h-4 text-white" />
      </button>
      <div className="relative flex items-center gap-4 z-10">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center animate-float">
          <Gift className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-extrabold text-lg font-display tracking-tight flex items-center gap-1.5">
            Daily Bonus! 
            <Sparkles className="w-4 h-4" />
          </h3>
          <p className="text-white/80 text-[11px] font-medium">Claim your free bonus now!</p>
        </div>
        <Button
          onClick={handleClaimBonus}
          disabled={claiming}
          className="bg-white text-accent hover:bg-white/90 font-extrabold px-6 rounded-xl shadow-lg"
        >
          {claiming ? '...' : 'Claim'}
        </Button>
      </div>
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />
    </div>
  );
});

DailyBonusBanner.displayName = 'DailyBonusBanner';

export default DailyBonusBanner;
