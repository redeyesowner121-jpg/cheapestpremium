import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  ShoppingBag, 
  Users, 
  Bell, 
  Gift,
  HelpCircle,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { RankProgressionCard } from '@/components/RankProgressionCard';
import {
  ProfileCard,
  ReferralSection,
  ProfileMenuItem,
  DailyBonusModal,
  EditReferralModal,
} from '@/components/profile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import appLogo from '@/assets/app-logo.jpg';
import BlueTick from '@/components/BlueTick';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, logout, refreshProfile, user } = useAuth();
  const { settings } = useAppSettingsContext();
  
  const [showEditReferral, setShowEditReferral] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [showBlueTickModal, setShowBlueTickModal] = useState(false);
  const [buyingBlueTick, setBuyingBlueTick] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notifications_enabled || false);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  // Fetch referral count
  useEffect(() => {
    if (!profile?.referral_code) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', profile.referral_code);
      setReferralCount(count || 0);
    };
    fetchCount();
  }, [profile?.referral_code]);

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
    
    // Use IST timezone for Indian users (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split('T')[0];
    
    if (profile.last_daily_bonus === today) {
      toast.error('You have already claimed your daily bonus today!');
      return;
    }
    
    setClaimingBonus(true);
    const bonusAmount = parseFloat((Math.random() * 0.5 + 0.1).toFixed(2));
    
    try {
      const newBalance = (profile.wallet_balance || 0) + bonusAmount;
      
      await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance, last_daily_bonus: today })
        .eq('id', user.id);

      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'bonus',
        amount: bonusAmount,
        status: 'completed',
        description: 'Daily sign-in bonus'
      });

      await refreshProfile();
      setShowDailyBonus(false);
      setBonusSuccessAmount(bonusAmount);
      setShowBonusSuccess(true);
    } catch (error) {
      toast.error('Failed to claim bonus');
    } finally {
      setClaimingBonus(false);
    }
  };

  const canClaimDailyBonus = () => {
    if (!profile?.last_daily_bonus) return true;
    // Use IST timezone for Indian users
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split('T')[0];
    return profile.last_daily_bonus !== today;
  };

  const handleLogout = async () => {
    try { await logout(); } catch (error) { console.log('Logout error ignored'); }
    navigate('/auth', { replace: true });
  };

  const blueTickPrice = settings.blue_tick_price || 0;
  const canBuyBlueTick = !profile?.has_blue_check && blueTickPrice > 0;

  const handleBuyBlueTick = async () => {
    if (!user || !profile || !canBuyBlueTick) return;
    if ((profile.wallet_balance || 0) < blueTickPrice) {
      toast.error(`Insufficient balance! You need ₹${blueTickPrice}`);
      return;
    }
    setBuyingBlueTick(true);
    try {
      const newBalance = (profile.wallet_balance || 0) - blueTickPrice;
      await supabase.from('profiles').update({ wallet_balance: newBalance, has_blue_check: true }).eq('id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'purchase', amount: blueTickPrice,
        status: 'completed', description: 'Blue Tick Badge Purchase'
      });
      toast.success('🎉 Blue Tick purchased successfully!');
      await refreshProfile();
      setShowBlueTickModal(false);
    } catch { toast.error('Failed to purchase Blue Tick'); }
    finally { setBuyingBlueTick(false); }
  };

  // Guest view - show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="pt-20 px-4 max-w-lg mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <motion.img
              src={appLogo}
              alt="RKR Premium"
              className="w-24 h-24 rounded-2xl mx-auto mb-6 shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome!</h2>
            <p className="text-muted-foreground mb-8">
              Login to access your profile, wallet, orders and more
            </p>
            
            <div className="space-y-3">
              <Button 
                className="w-full h-12 btn-gradient rounded-xl"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="w-5 h-5 mr-2" />
                Login
              </Button>
              <Button 
                variant="outline"
                className="w-full h-12 rounded-xl"
                onClick={() => navigate('/auth')}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Create Account
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-8">
              You can browse products without logging in
            </p>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const menuItems = [
    { icon: <Wallet className="w-5 h-5" />, label: 'Wallet', value: `₹${profile?.wallet_balance?.toFixed(2) || '0.00'}`, color: 'text-primary', bgColor: 'bg-primary/10', onClick: () => navigate('/wallet') },
    { icon: <ShoppingBag className="w-5 h-5" />, label: 'My Orders', value: profile?.total_orders || 0, color: 'text-accent', bgColor: 'bg-accent/10', onClick: () => navigate('/orders') },
    ...(canBuyBlueTick ? [{
      icon: <Award className="w-5 h-5" />, label: 'Get Blue Tick ✅', value: `₹${blueTickPrice}`, color: 'text-sky-500', bgColor: 'bg-sky-100', onClick: () => setShowBlueTickModal(true), isClaimable: true
    }] : []),
    { icon: <Users className="w-5 h-5" />, label: 'Community', color: 'text-secondary', bgColor: 'bg-secondary/10', onClick: () => navigate('/users') },
    { icon: <Bell className="w-5 h-5" />, label: 'Notifications', color: 'text-success', bgColor: 'bg-success/10', onClick: () => navigate('/notifications'), toggle: true, toggleValue: notificationsEnabled, onToggle: handleToggleNotifications },
    { icon: <Gift className="w-5 h-5" />, label: 'Daily Bonus', value: canClaimDailyBonus() ? 'Claim Now!' : 'Claimed ✓', color: 'text-pink-500', bgColor: 'bg-pink-100', onClick: () => setShowDailyBonus(true), isClaimable: canClaimDailyBonus() },
    { icon: <HelpCircle className="w-5 h-5" />, label: 'Help & Support', color: 'text-slate-500', bgColor: 'bg-slate-100', onClick: () => navigate('/chat') },
    { icon: <Shield className="w-5 h-5" />, label: 'Terms & Privacy', color: 'text-muted-foreground', bgColor: 'bg-muted', onClick: () => navigate('/terms') },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <ProfileCard profile={profile} onEditProfile={() => navigate('/profile/edit')} referralCount={referralCount} />
        <RankProgressionCard rankBalance={profile?.rank_balance || 0} className="mt-6" />
        <ReferralSection referralCode={profile?.referral_code || ''} onCustomize={() => setShowEditReferral(true)} />

        <div className="mt-6 space-y-2">
          {menuItems.map((item, index) => (
            <ProfileMenuItem key={item.label} {...item} index={index} />
          ))}
        </div>

        <div className="mt-6">
          <Button variant="destructive" className="w-full h-12 rounded-xl" onClick={handleLogout}>
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">RKR Premium Store v1.0.0</p>
      </main>

      <EditReferralModal
        open={showEditReferral}
        onOpenChange={setShowEditReferral}
        profileId={profile?.id || ''}
        onSuccess={refreshProfile}
      />

      <DailyBonusModal
        open={showDailyBonus}
        onOpenChange={setShowDailyBonus}
        canClaim={canClaimDailyBonus()}
        claiming={claimingBonus}
        onClaim={handleClaimDailyBonus}
      />

      {/* Blue Tick Purchase Modal */}
      <Dialog open={showBlueTickModal} onOpenChange={setShowBlueTickModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center">Get Verified ✅</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <BlueTick size="lg" className="w-12 h-12" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Blue Tick Badge</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Get a verified badge on your profile! Stand out from the crowd.
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-bold text-foreground">₹{blueTickPrice}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Balance</span>
                <span className={`font-bold ${(profile?.wallet_balance || 0) >= blueTickPrice ? 'text-success' : 'text-destructive'}`}>
                  ₹{profile?.wallet_balance?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
            {(profile?.wallet_balance || 0) < blueTickPrice ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive">Insufficient balance</p>
                <Button className="w-full rounded-xl" onClick={() => { setShowBlueTickModal(false); navigate('/wallet'); }}>
                  <Wallet className="w-4 h-4 mr-2" />
                  Add Money to Wallet
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white"
                onClick={handleBuyBlueTick}
                disabled={buyingBlueTick}
              >
                {buyingBlueTick ? 'Processing...' : `Buy for ₹${blueTickPrice}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
