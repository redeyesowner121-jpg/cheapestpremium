import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface DailyBonusBannerProps {
  onBonusClaimed?: () => void;
}

const DailyBonusBanner: React.FC<DailyBonusBannerProps> = ({ onBonusClaimed }) => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading } = useAuth();
  const [canClaimBonus, setCanClaimBonus] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkBonusEligibility();
  }, [profile]);

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

    const lastBonusDate = new Date(lastBonus);
    const today = new Date();
    
    // Check if it's a new day
    const isNewDay = 
      lastBonusDate.getDate() !== today.getDate() ||
      lastBonusDate.getMonth() !== today.getMonth() ||
      lastBonusDate.getFullYear() !== today.getFullYear();
    
    setCanClaimBonus(isNewDay);
  };

  const handleClaimBonus = async () => {
    if (!user || !profile || claiming) return;

    setClaiming(true);
    try {
      // Fetch admin-configured bonus settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['daily_bonus_min', 'daily_bonus_max']);
      
      const settingsMap: Record<string, string> = {};
      settings?.forEach(s => { settingsMap[s.key] = s.value || ''; });
      
      const minBonus = parseFloat(settingsMap.daily_bonus_min) || 0.10;
      const maxBonus = parseFloat(settingsMap.daily_bonus_max) || 1.00;
      
      // Generate random bonus within admin-configured range
      const bonusAmount = Math.round((Math.random() * (maxBonus - minBonus) + minBonus) * 100) / 100;
      const newBalance = (profile.wallet_balance || 0) + bonusAmount;

      // Format date as YYYY-MM-DD for date field
      const todayDate = new Date().toISOString().split('T')[0];
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          wallet_balance: newBalance,
          last_daily_bonus: todayDate
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Create transaction record
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'bonus',
        amount: bonusAmount,
        status: 'completed',
        description: 'Daily login bonus'
      });

      // Create notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Daily Bonus! 🎁',
        message: `You earned ₹${bonusAmount} as your daily bonus!`,
        type: 'bonus'
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

  // Show loading state
  if (loading) {
    return null;
  }

  // Guest Login Banner
  if (!user) {
    if (dismissed) return null;
    
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent p-4 shadow-lg"
        >
          {/* Sparkle effects */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
              >
                <Sparkles className="w-3 h-3 text-white/60" />
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="relative flex items-center gap-4">
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 1,
              }}
              className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
            >
              <UserPlus className="w-8 h-8 text-white" />
            </motion.div>

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
        </motion.div>
      </AnimatePresence>
    );
  }

  // Don't show daily bonus banner if already claimed or dismissed
  if (!profile || !canClaimBonus || dismissed) {
    return null;
  }

  // Daily Bonus Banner for logged in users
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-4 shadow-lg"
      >
        {/* Sparkle effects */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            >
              <Sparkles className="w-3 h-3 text-white/60" />
            </motion.div>
          ))}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="relative flex items-center gap-4">
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 1,
            }}
            className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
          >
            <Gift className="w-8 h-8 text-white" />
          </motion.div>

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
      </motion.div>
    </AnimatePresence>
  );
};

export default DailyBonusBanner;
