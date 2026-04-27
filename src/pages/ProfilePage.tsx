import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ShoppingBag, Users, Bell, Gift, HelpCircle, Shield, LogOut, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { RankProgressionCard } from '@/components/RankProgressionCard';
import { ProfileCard, ReferralSection, ProfileMenuItem, DailyBonusModal, EditReferralModal } from '@/components/profile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import AnimatedSuccessModal from '@/components/AnimatedSuccessModal';
import { useReferralCount } from './profile/useReferralCount';
import { useDailyBonus } from './profile/useDailyBonus';
import BlueTickModal from './profile/BlueTickModal';
import GuestProfile from './profile/GuestProfile';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, logout, refreshProfile, user } = useAuth();
  const { settings } = useAppSettingsContext();

  const [showEditReferral, setShowEditReferral] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [showBlueTickModal, setShowBlueTickModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notifications_enabled || false);

  const referralCount = useReferralCount(profile?.referral_code);
  const dailyBonus = useDailyBonus(profile, user, refreshProfile);

  const handleToggleNotifications = async () => {
    try {
      await supabase.from('profiles')
        .update({ notifications_enabled: !notificationsEnabled })
        .eq('id', profile?.id);
      setNotificationsEnabled(!notificationsEnabled);
      toast.success(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
    } catch {
      toast.error('Failed to update notification settings');
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    navigate('/auth', { replace: true });
  };

  if (!user) return <GuestProfile />;

  const blueTickPrice = settings.blue_tick_price || 0;
  const canBuyBlueTick = !profile?.has_blue_check && blueTickPrice > 0;

  const menuItems = [
    { icon: <Wallet className="w-5 h-5" />, label: 'Wallet', value: `₹${profile?.wallet_balance?.toFixed(2) || '0.00'}`, color: 'text-primary', bgColor: 'bg-primary/10', onClick: () => navigate('/wallet') },
    { icon: <ShoppingBag className="w-5 h-5" />, label: 'My Orders', value: profile?.total_orders || 0, color: 'text-accent', bgColor: 'bg-accent/10', onClick: () => navigate('/orders') },
    ...(canBuyBlueTick ? [{
      icon: <Award className="w-5 h-5" />, label: 'Get Blue Tick ✅', value: `₹${blueTickPrice}`, color: 'text-sky-500', bgColor: 'bg-sky-100', onClick: () => setShowBlueTickModal(true), isClaimable: true
    }] : []),
    { icon: <Users className="w-5 h-5" />, label: 'Community', color: 'text-secondary', bgColor: 'bg-secondary/10', onClick: () => navigate('/users') },
    { icon: <Bell className="w-5 h-5" />, label: 'Notifications', color: 'text-success', bgColor: 'bg-success/10', onClick: () => navigate('/notifications'), toggle: true, toggleValue: notificationsEnabled, onToggle: handleToggleNotifications },
    { icon: <Gift className="w-5 h-5" />, label: 'Daily Bonus', value: dailyBonus.canClaim() ? 'Claim Now!' : 'Claimed ✓', color: 'text-pink-500', bgColor: 'bg-pink-100', onClick: () => setShowDailyBonus(true), isClaimable: dailyBonus.canClaim() },
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
            <LogOut className="w-5 h-5 mr-2" />Logout
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">RKR Premium Store v1.0.0</p>
      </main>

      <EditReferralModal
        open={showEditReferral} onOpenChange={setShowEditReferral}
        profileId={profile?.id || ''} onSuccess={refreshProfile}
      />

      <DailyBonusModal
        open={showDailyBonus} onOpenChange={setShowDailyBonus}
        canClaim={dailyBonus.canClaim()}
        claiming={dailyBonus.claiming}
        onClaim={() => dailyBonus.claim(() => setShowDailyBonus(false))}
      />

      <AnimatedSuccessModal
        isOpen={dailyBonus.showSuccess}
        onClose={() => dailyBonus.setShowSuccess(false)}
        type="bonus_claimed"
        title="Bonus Claimed! 🎁"
        subtitle={`₹${dailyBonus.amount} has been added to your wallet.`}
        details={[{ label: 'Bonus Amount', value: `₹${dailyBonus.amount}` }]}
        actionLabel="Continue"
        autoCloseDelay={3000}
      />

      <BlueTickModal
        open={showBlueTickModal}
        onOpenChange={setShowBlueTickModal}
        profile={profile}
        user={user}
        blueTickPrice={blueTickPrice}
        refreshProfile={refreshProfile}
      />

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
