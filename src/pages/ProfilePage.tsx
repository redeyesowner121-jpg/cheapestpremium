import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Wallet, 
  ShoppingBag, 
  Users, 
  Bell, 
  Share2, 
  Copy,
  Edit,
  LogOut,
  ChevronRight,
  Check,
  Gift,
  HelpCircle,
  Shield,
  ExternalLink
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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { userData, logout, updateUserData } = useAuth();
  
  const [showEditReferral, setShowEditReferral] = useState(false);
  const [newReferralCode, setNewReferralCode] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(userData?.notificationsEnabled || false);

  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(userData?.referralCode || '');
    toast.success('Referral code copied!');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join RKR Premium Store',
        text: `Use my referral code ${userData?.referralCode} to get bonus!`,
        url: window.location.origin,
      });
    }
  };

  const handleUpdateReferralCode = async () => {
    if (newReferralCode.length < 4) {
      toast.error('Referral code must be at least 4 characters');
      return;
    }
    
    try {
      await updateUserData({ referralCode: newReferralCode.toUpperCase() });
      setShowEditReferral(false);
      toast.success('Referral code updated!');
    } catch (error) {
      toast.error('Failed to update referral code');
    }
  };

  const handleToggleNotifications = async () => {
    try {
      await updateUserData({ notificationsEnabled: !notificationsEnabled });
      setNotificationsEnabled(!notificationsEnabled);
      toast.success(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
    } catch (error) {
      toast.error('Failed to update notification settings');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const menuItems = [
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Wallet',
      value: `₹${userData?.walletBalance?.toFixed(2) || '0.00'}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: () => navigate('/wallet'),
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      label: 'My Orders',
      value: userData?.totalOrders || 0,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      onClick: () => navigate('/orders'),
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Other Users',
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
      value: 'Claim Now',
      color: 'text-pink-500',
      bgColor: 'bg-pink-100',
      onClick: () => {},
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
              {userData?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {userData?.hasBlueCheck && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
                <BlueTick size="sm" />
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-primary-foreground mt-4 flex items-center justify-center gap-2">
            {userData?.name || 'User'}
            {userData?.hasBlueCheck && <BlueTick size="md" />}
          </h2>
          <p className="text-primary-foreground/70 text-sm">{userData?.email}</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">
                ₹{userData?.totalDeposit?.toFixed(0) || '0'}
              </p>
              <p className="text-xs text-primary-foreground/70">Deposited</p>
            </div>
            <div className="text-center border-x border-primary-foreground/20">
              <p className="text-2xl font-bold text-primary-foreground">
                {userData?.totalOrders || 0}
              </p>
              <p className="text-xs text-primary-foreground/70">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-foreground">0</p>
              <p className="text-xs text-primary-foreground/70">Referrals</p>
            </div>
          </div>

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
              {userData?.referralCode || 'RKRXXXX'}
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
                    <span className="text-sm text-muted-foreground">{item.value}</span>
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

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
