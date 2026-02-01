import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  ShoppingBag, 
  Users, 
  Bell, 
  Gift,
  HelpCircle,
  Shield,
  LogOut
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

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, logout, refreshProfile, user } = useAuth();
  
  const [showEditReferral, setShowEditReferral] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notifications_enabled || false);
  const [claimingBonus, setClaimingBonus] = useState(false);

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

  const menuItems = [
    { icon: <Wallet className="w-5 h-5" />, label: 'Wallet', value: `₹${profile?.wallet_balance?.toFixed(2) || '0.00'}`, color: 'text-primary', bgColor: 'bg-primary/10', onClick: () => navigate('/wallet') },
    { icon: <ShoppingBag className="w-5 h-5" />, label: 'My Orders', value: profile?.total_orders || 0, color: 'text-accent', bgColor: 'bg-accent/10', onClick: () => navigate('/orders') },
    { icon: <Users className="w-5 h-5" />, label: 'Community', color: 'text-secondary', bgColor: 'bg-secondary/10', onClick: () => navigate('/users') },
    { icon: <Bell className="w-5 h-5" />, label: 'Notifications', color: 'text-success', bgColor: 'bg-success/10', onClick: () => navigate('/notifications'), toggle: true, toggleValue: notificationsEnabled, onToggle: handleToggleNotifications },
    { icon: <Gift className="w-5 h-5" />, label: 'Daily Bonus', value: canClaimDailyBonus() ? 'Claim Now!' : 'Claimed ✓', color: 'text-pink-500', bgColor: 'bg-pink-100', onClick: () => setShowDailyBonus(true), isClaimable: canClaimDailyBonus() },
    { icon: <HelpCircle className="w-5 h-5" />, label: 'Help & Support', color: 'text-slate-500', bgColor: 'bg-slate-100', onClick: () => navigate('/chat') },
    { icon: <Shield className="w-5 h-5" />, label: 'Terms & Privacy', color: 'text-muted-foreground', bgColor: 'bg-muted', onClick: () => {} },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <ProfileCard profile={profile} onEditProfile={() => navigate('/profile/edit')} />
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

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
