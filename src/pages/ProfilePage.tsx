import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  ShoppingBag, 
  Users, 
  Bell, 
  Share2, 
  Copy,
  Edit,
  LogOut,
  ChevronRight,
  Gift,
  HelpCircle,
  Shield,
  Calendar,
  TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BlueTick from '@/components/BlueTick';
import { RankBadge } from '@/components/RankBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, getNextRank, getProgressToNextRank, getDecayAmount, getNextDecayDate } from '@/lib/ranks';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, logout, refreshProfile, user, isAdmin } = useAuth();
  
  const [showEditReferral, setShowEditReferral] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [newReferralCode, setNewReferralCode] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notifications_enabled || false);
  const [claimingBonus, setClaimingBonus] = useState(false);

  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(profile?.referral_code || '');
    toast.success('Referral code copied!');
  };

  const handleShare = async () => {
    const shareText = `Join RKR Premium Store with my referral code ${profile?.referral_code} and get bonus!`;
    const shareUrl = `${window.location.origin}?ref=${profile?.referral_code}`;
    
    const shareData = {
      title: 'Join RKR Premium Store',
      text: shareText,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success('Referral link copied to clipboard!');
      }
    } catch (error) {
      // Fallback - copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success('Referral link copied to clipboard!');
      } catch (e) {
        toast.error('Failed to share');
      }
    }
  };

  const handleUpdateReferralCode = async () => {
    if (newReferralCode.length < 4) {
      toast.error('Referral code must be at least 4 characters');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: newReferralCode.toUpperCase() })
        .eq('id', profile?.id);
      
      if (error) {
        if (error.code === '23505') {
          toast.error('This referral code is already taken');
        } else {
          toast.error('Failed to update referral code');
        }
        return;
      }
      
      await refreshProfile();
      setShowEditReferral(false);
      toast.success('Referral code updated!');
    } catch (error) {
      toast.error('Failed to update referral code');
    }
  };

  const handleToggleNotifications = async () => {
    try {
      await supabase
        .from('profiles')
        .update({ notifications_enabled: !notificationsEnabled })
        .eq('id', profile?.id);
      setNotificationsEnabled(!notificationsEnabled);
      toast.success(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
    } catch (error) {
      toast.error('Failed to update notification settings');
    }
  };

  const handleClaimDailyBonus = async () => {
    if (!user || !profile) return;
    
    // Check if already claimed today
    const today = new Date().toISOString().split('T')[0];
    if (profile.last_daily_bonus === today) {
      toast.error('You have already claimed your daily bonus today!');
      return;
    }
    
    setClaimingBonus(true);
    
    // Random bonus between 0.10 and 0.60
    const bonusAmount = parseFloat((Math.random() * 0.5 + 0.1).toFixed(2));
    
    try {
      const newBalance = (profile.wallet_balance || 0) + bonusAmount;
      
      await supabase
        .from('profiles')
        .update({ 
          wallet_balance: newBalance,
          last_daily_bonus: today
        })
        .eq('id', user.id);

      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'bonus',
        amount: bonusAmount,
        status: 'completed',
        description: 'Daily sign-in bonus'
      });

      toast.success(`🎉 You received Rs${bonusAmount} daily bonus!`);
      await refreshProfile();
      setShowDailyBonus(false);
    } catch (error) {
      toast.error('Failed to claim bonus');
    } finally {
      setClaimingBonus(false);
    }
  };

  const canClaimDailyBonus = () => {
    if (!profile?.last_daily_bonus) return true;
    const today = new Date().toISOString().split('T')[0];
    return profile.last_daily_bonus !== today;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.log('Logout error ignored');
    }
    navigate('/auth', { replace: true });
  };

  const menuItems = [
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Wallet',
      value: `₹${profile?.wallet_balance?.toFixed(2) || '0.00'}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: () => navigate('/wallet'),
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      label: 'My Orders',
      value: profile?.total_orders || 0,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      onClick: () => navigate('/orders'),
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Community',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      onClick: () => navigate('/users'),
    },
    {
      icon: <Bell className="w-5 h-5" />,
      label: 'Notifications',
      color: 'text-success',
      bgColor: 'bg-success/10',
      onClick: () => navigate('/notifications'),
      toggle: true,
      toggleValue: notificationsEnabled,
      onToggle: handleToggleNotifications,
    },
    {
      icon: <Gift className="w-5 h-5" />,
      label: 'Daily Bonus',
      value: canClaimDailyBonus() ? 'Claim Now!' : 'Claimed ✓',
      color: 'text-pink-500',
      bgColor: 'bg-pink-100',
      onClick: () => setShowDailyBonus(true),
    },
    {
      icon: <HelpCircle className="w-5 h-5" />,
      label: 'Help & Support',
      color: 'text-slate-500',
      bgColor: 'bg-slate-100',
      onClick: () => navigate('/chat'),
    },
    {
      icon: <Shield className="w-5 h-5" />,
      label: 'Terms & Privacy',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      onClick: () => {},
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-primary rounded-3xl p-6 text-center shadow-glow"
        >
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {profile?.has_blue_check && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
                <BlueTick size="sm" />
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-primary-foreground mt-4 flex items-center justify-center gap-2">
            {profile?.name || 'User'}
            {profile?.has_blue_check && <BlueTick size="md" />}
          </h2>
          <p className="text-primary-foreground/70 text-sm">{profile?.email}</p>
          {profile?.phone && (
            <p className="text-primary-foreground/60 text-xs">{profile.phone}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">
                ₹{profile?.total_deposit?.toFixed(0) || '0'}
              </p>
              <p className="text-xs text-primary-foreground/70">Deposited</p>
            </div>
            <div className="text-center border-x border-primary-foreground/20">
              <p className="text-2xl font-bold text-primary-foreground">
                {profile?.total_orders || 0}
              </p>
              <p className="text-xs text-primary-foreground/70">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">0</p>
              <p className="text-xs text-primary-foreground/70">Referrals</p>
            </div>
          </div>

          {/* Rank Badge */}
          <div className="mt-4 p-3 bg-white/10 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-primary-foreground/80">Your Rank</span>
              <RankBadge rankBalance={profile?.rank_balance || 0} size="md" />
            </div>
            {(() => {
              const rankBalance = profile?.rank_balance || 0;
              const rank = getUserRank(rankBalance);
              const nextRank = getNextRank(rankBalance);
              const { progress, remaining } = getProgressToNextRank(rankBalance);
              const decayAmount = getDecayAmount(rankBalance);
              
              return (
                <>
                  <div className="flex items-center justify-between text-xs text-primary-foreground/70 mb-1">
                    <span>Rank Balance: ₹{rankBalance.toLocaleString()}</span>
                    {rank.discount > 0 && <span>{rank.discount}% off</span>}
                    {rank.usesResellerPrice && !rank.titanBonus && <span>Reseller Price</span>}
                    {rank.titanBonus && <span>RP +20%</span>}
                  </div>
                  {nextRank ? (
                    <>
                      <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                        <div 
                          className="bg-white h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-primary-foreground/70">
                        ₹{remaining.toLocaleString()} more for {nextRank.icon} {nextRank.name}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-primary-foreground font-medium">🏆 Highest rank!</p>
                  )}
                  {decayAmount > 0 && (
                    <p className="text-xs text-primary-foreground/60 mt-1 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      Next decay: -₹{decayAmount.toLocaleString()} on {getNextDecayDate().toLocaleDateString()}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
          
          {/* Blue Tick Progress */}
          {!profile?.has_blue_check && (
            <div className="mt-4 p-3 bg-white/10 rounded-xl">
              <p className="text-xs text-primary-foreground/80 mb-2">
                Deposit ₹{Math.max(0, 1000 - (profile?.total_deposit || 0))} more to get Blue Tick!
              </p>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((profile?.total_deposit || 0) / 1000) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="mt-6 bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20 rounded-xl"
            onClick={() => navigate('/profile/edit')}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </motion.div>

        {/* Referral Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 bg-card rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Your Referral Code</h3>
            <button
              onClick={() => setShowEditReferral(true)}
              className="text-xs text-primary font-medium"
            >
              Customize
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono font-bold text-foreground">
              {profile?.referral_code || 'RKRXXXX'}
            </div>
            <Button
              size="icon"
              variant="outline"
              className="rounded-xl"
              onClick={handleCopyReferralCode}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              className="btn-gradient rounded-xl"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Earn ₹10 for every friend who signs up using your code!
          </p>
        </motion.div>

        {/* Menu Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 space-y-2"
        >
          {menuItems.map((item, index) => (
            <motion.button
              key={item.label}
              onClick={item.toggle ? undefined : item.onClick}
              className="w-full bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 card-hover"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.03 }}
              whileTap={!item.toggle ? { scale: 0.98 } : undefined}
            >
              <div className={`p-2 rounded-xl ${item.bgColor}`}>
                <div className={item.color}>{item.icon}</div>
              </div>
              <span className="flex-1 text-left font-medium text-foreground">
                {item.label}
              </span>
              {item.toggle ? (
                <Switch
                  checked={item.toggleValue}
                  onCheckedChange={item.onToggle}
                />
              ) : (
                <>
                  {item.value && (
                    <span className={`text-sm ${item.label === 'Daily Bonus' && canClaimDailyBonus() ? 'text-success font-semibold' : 'text-muted-foreground'}`}>
                      {item.value}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </>
              )}
            </motion.button>
          ))}
        </motion.div>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Button
            variant="destructive"
            className="w-full h-12 rounded-xl"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </motion.div>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          RKR Premium Store v1.0.0
        </p>
      </main>

      {/* Edit Referral Code Modal */}
      <Dialog open={showEditReferral} onOpenChange={setShowEditReferral}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Customize Referral Code</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <Input
              placeholder="Enter new referral code"
              value={newReferralCode}
              onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
              className="h-12 rounded-xl uppercase"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Choose a unique code (4-10 characters, letters and numbers only)
            </p>
            <Button
              className="w-full btn-gradient rounded-xl"
              onClick={handleUpdateReferralCode}
              disabled={newReferralCode.length < 4}
            >
              Update Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Bonus Modal */}
      <Dialog open={showDailyBonus} onOpenChange={setShowDailyBonus}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center">Daily Sign-in Bonus</DialogTitle>
          </DialogHeader>

          <div className="mt-4 text-center space-y-4">
            <div className="w-24 h-24 mx-auto gradient-accent rounded-full flex items-center justify-center animate-pulse">
              <Gift className="w-12 h-12 text-accent-foreground" />
            </div>
            
            {canClaimDailyBonus() ? (
              <>
                <p className="text-muted-foreground">
                  Claim your daily bonus! You can earn between <span className="font-bold text-success">₹0.10 to ₹0.60</span>
                </p>
                <Button
                  className="w-full btn-gradient rounded-xl h-12"
                  onClick={handleClaimDailyBonus}
                  disabled={claimingBonus}
                >
                  {claimingBonus ? 'Claiming...' : '🎁 Claim Daily Bonus'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  You've already claimed your daily bonus today! Come back tomorrow for more.
                </p>
                <div className="flex items-center justify-center gap-2 text-success">
                  <Calendar className="w-5 h-5" />
                  <span className="font-semibold">Next bonus: Tomorrow</span>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
