import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, MessageCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import AdminEditSections from './user-modal/AdminEditSections';
import {
  giftBlueTick,
  giftMoney,
  updateWalletBalance,
  updateRankBalance,
  setUserRank,
  toggleReseller,
  toggleSeller,
  deleteUser,
} from './user-modal/user-actions';

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  setUser: (user: any) => void;
  isAdmin: boolean;
  onRefresh: () => void;
}

const UserModal: React.FC<UserModalProps> = ({
  open, onOpenChange, user, setUser, isAdmin, onRefresh,
}) => {
  const navigate = useNavigate();
  const [giftAmount, setGiftAmount] = React.useState('');
  const [rankBalanceInput, setRankBalanceInput] = React.useState('');
  const [walletBalanceInput, setWalletBalanceInput] = React.useState('');
  const [ranks, setRanks] = React.useState<any[]>([]);

  React.useEffect(() => {
    supabase.from('ranks').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      .then(({ data }) => { if (data) setRanks(data); });
  }, []);

  const getCurrentRank = () => {
    if (!ranks.length || !user) return null;
    const rb = user.rank_balance || 0;
    let current = ranks[0];
    for (const r of ranks) {
      if (rb >= r.min_balance) current = r;
    }
    return current;
  };

  const handleSetRank = async (rankId: string) => {
    const rank = ranks.find(r => r.id === rankId);
    if (!rank || !user) return;
    if (await setUserRank(user, rank)) {
      setUser({ ...user, rank_balance: rank.min_balance });
      onRefresh();
    }
  };

  const handleGiftBlueTick = async (userId: string) => {
    if (await giftBlueTick(userId)) {
      onOpenChange(false);
      onRefresh();
    }
  };

  const handleGiftMoney = async () => {
    const newBalance = await giftMoney(user, giftAmount);
    if (newBalance !== null) {
      setGiftAmount('');
      onOpenChange(false);
      onRefresh();
    }
  };

  const handleToggleReseller = async (checked: boolean) => {
    await toggleReseller(user, checked);
    setUser({ ...user, is_reseller: checked });
    onRefresh();
  };

  const handleUpdateWalletBalance = async () => {
    const newBalance = await updateWalletBalance(user, walletBalanceInput);
    if (newBalance !== null) {
      setWalletBalanceInput('');
      setUser({ ...user, wallet_balance: newBalance });
      onRefresh();
    }
  };

  const handleToggleSeller = async () => {
    await toggleSeller(user);
    onOpenChange(false);
    onRefresh();
  };

  const handleUpdateRankBalance = async () => {
    const newRankBalance = await updateRankBalance(user, rankBalanceInput);
    if (newRankBalance !== null) {
      setRankBalanceInput('');
      setUser({ ...user, rank_balance: newRankBalance });
      onRefresh();
    }
  };

  const handleDeleteUser = async () => {
    if (await deleteUser(user)) {
      onOpenChange(false);
      onRefresh();
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              {user.name?.charAt(0) || 'U'}
            </div>
            <h3 className="font-bold text-foreground mt-2 flex items-center justify-center gap-1">
              {user.name}
              {user.has_blue_check && <BlueTick />}
            </h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded-xl p-2">
              <p className="font-bold">₹{user.wallet_balance || 0}</p>
              <p className="text-xs text-muted-foreground">Balance</p>
            </div>
            <div className="bg-muted rounded-xl p-2">
              <p className="font-bold">₹{user.total_deposit || 0}</p>
              <p className="text-xs text-muted-foreground">Deposited</p>
            </div>
            <div className="bg-muted rounded-xl p-2">
              <p className="font-bold">{user.total_orders || 0}</p>
              <p className="text-xs text-muted-foreground">Orders</p>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-sm">
            <p><strong>Referral Code:</strong> {user.referral_code}</p>
            <p><strong>Referred By:</strong> {user.referred_by || 'None'}</p>
            <p><strong>Joined:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
            <p><strong>Rank Balance:</strong> ₹{user.rank_balance || 0}</p>
          </div>

          <AdminEditSections
            user={user}
            ranks={ranks}
            walletBalanceInput={walletBalanceInput}
            setWalletBalanceInput={setWalletBalanceInput}
            giftAmount={giftAmount}
            setGiftAmount={setGiftAmount}
            rankBalanceInput={rankBalanceInput}
            setRankBalanceInput={setRankBalanceInput}
            onUpdateWalletBalance={handleUpdateWalletBalance}
            onGiftMoney={handleGiftMoney}
            onUpdateRankBalance={handleUpdateRankBalance}
            onSetRank={handleSetRank}
            getCurrentRank={getCurrentRank}
          />

          <div className="flex gap-2">
            {!user.has_blue_check && (
              <Button onClick={() => handleGiftBlueTick(user.id)} className="flex-1 btn-gradient">
                <Award className="w-4 h-4 mr-2" />
                Gift Blue Tick
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => navigate('/chat')}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">💼 Reseller Status</span>
              {user.is_reseller && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>
              )}
            </div>
            <Switch
              checked={user.is_reseller || false}
              onCheckedChange={handleToggleReseller}
            />
          </div>

          <Button variant="outline" className="w-full" onClick={handleToggleSeller}>
            <Shield className="w-4 h-4 mr-2" />
            Toggle Seller Role
          </Button>

          {isAdmin && (
            <Button variant="destructive" className="w-full" onClick={handleDeleteUser}>
              Delete User
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
