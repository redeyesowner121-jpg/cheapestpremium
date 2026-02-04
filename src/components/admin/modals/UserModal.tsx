import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, MessageCircle, Gift, Shield, Wallet, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  setUser: (user: any) => void;
  isAdmin: boolean;
  onRefresh: () => void;
}

const UserModal: React.FC<UserModalProps> = ({
  open,
  onOpenChange,
  user,
  setUser,
  isAdmin,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [giftAmount, setGiftAmount] = React.useState('');
  const [deductAmount, setDeductAmount] = React.useState('');
  const [rankBalanceInput, setRankBalanceInput] = React.useState('');
  const [walletBalanceInput, setWalletBalanceInput] = React.useState('');

  const handleGiftBlueTick = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ has_blue_check: true }).eq('id', userId);
    if (error) {
      toast.error('Failed to gift blue tick');
      return;
    }
    toast.success('Blue Tick gifted successfully!');
    onOpenChange(false);
    onRefresh();
  };

  const handleGiftMoney = async () => {
    if (!user || !giftAmount) return;
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount - must be positive');
      return;
    }

    const newBalance = (user.wallet_balance || 0) + amount;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);
    
    if (updateError) {
      toast.error('Failed to update balance');
      return;
    }

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'gift',
      amount: amount,
      status: 'completed',
      description: `Admin gift - ₹${amount}`
    });

    toast.success(`₹${amount} gifted to ${user.name}`);
    setGiftAmount('');
    onOpenChange(false);
    onRefresh();
  };

  const handleDeductMoney = async () => {
    if (!user || !deductAmount) return;
    const amount = parseFloat(deductAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount - must be positive');
      return;
    }

    const currentBalance = user.wallet_balance || 0;
    if (amount > currentBalance) {
      toast.error(`Cannot deduct more than current balance (₹${currentBalance})`);
      return;
    }

    const newBalance = currentBalance - amount;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);
    
    if (updateError) {
      toast.error('Failed to deduct balance');
      return;
    }

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'gift_deduct',
      amount: amount,
      status: 'completed',
      description: `Admin deducted - ₹${amount}`
    });

    toast.success(`₹${amount} deducted from ${user.name}`);
    setDeductAmount('');
    onOpenChange(false);
    onRefresh();
  };

  const handleToggleReseller = async (checked: boolean) => {
    await supabase.from('profiles').update({ is_reseller: checked }).eq('id', user.id);
    toast.success(checked ? 'User is now a Reseller!' : 'Reseller status removed');
    setUser({ ...user, is_reseller: checked });
    onRefresh();
  };

  const handleUpdateWalletBalance = async () => {
    if (!user || walletBalanceInput === '') return;
    const newBalance = parseFloat(walletBalanceInput);
    if (isNaN(newBalance) || newBalance < 0) {
      toast.error('Invalid balance amount');
      return;
    }

    const oldBalance = user.wallet_balance || 0;
    const difference = newBalance - oldBalance;

    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update wallet balance');
      return;
    }

    // Log the balance change as a transaction for audit trail
    // Amount should always be positive, type indicates credit/debit
    if (difference !== 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: difference > 0 ? 'admin_credit' : 'admin_debit',
        amount: Math.abs(difference), // Always store positive amount
        status: 'completed',
        description: `Admin balance adjustment: ₹${oldBalance} → ₹${newBalance}`
      });
    }

    toast.success(`Wallet balance updated to ₹${newBalance}`);
    setWalletBalanceInput('');
    setUser({ ...user, wallet_balance: newBalance });
    onRefresh();
  };

  const handleToggleSeller = async () => {
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'seller')
      .maybeSingle();

    if (existingRole) {
      await supabase.from('user_roles').delete().eq('id', existingRole.id);
      toast.success('Seller role removed');
    } else {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'seller' });
      toast.success('User is now a seller!');
    }
    onOpenChange(false);
    onRefresh();
  };

  const handleUpdateRankBalance = async () => {
    if (!user || !rankBalanceInput) return;
    const newRankBalance = parseFloat(rankBalanceInput);
    if (isNaN(newRankBalance) || newRankBalance < 0) {
      toast.error('Invalid rank balance');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ rank_balance: newRankBalance })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update rank balance');
      return;
    }

    toast.success(`Rank balance updated to ₹${newRankBalance}`);
    setRankBalanceInput('');
    setUser({ ...user, rank_balance: newRankBalance });
    onRefresh();
  };

  const handleDeleteUser = async () => {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;
    
    await supabase.from('user_roles').delete().eq('user_id', user.id);
    await supabase.from('notifications').delete().eq('user_id', user.id);
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('orders').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    
    toast.success('User deleted');
    onOpenChange(false);
    onRefresh();
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

          {/* Admin Wallet Balance Edit */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 rounded-xl p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-600" />
              Edit Wallet Balance
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={`Current: ₹${user.wallet_balance || 0}`}
                value={walletBalanceInput}
                onChange={(e) => setWalletBalanceInput(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleUpdateWalletBalance} size="sm" className="bg-green-600 hover:bg-green-700">
                Set
              </Button>
            </div>
          </div>

          {/* Admin Rank Balance Update */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 rounded-xl p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              Update Rank Balance
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={`Current: ₹${user.rank_balance || 0}`}
                value={rankBalanceInput}
                onChange={(e) => setRankBalanceInput(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleUpdateRankBalance} size="sm" className="bg-purple-600 hover:bg-purple-700">
                Update
              </Button>
            </div>
          </div>

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

          {/* Gift Money Section */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 rounded-xl p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-600" />
              Gift Money (Add Balance)
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter amount to gift"
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                className="flex-1"
                min="1"
              />
              <Button onClick={handleGiftMoney} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Gift className="w-4 h-4 mr-1" />
                Gift
              </Button>
            </div>
          </div>

          {/* Deduct Money Section */}
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 rounded-xl p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Minus className="w-4 h-4 text-red-600" />
              Deduct Balance
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter amount to deduct"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                className="flex-1"
                min="1"
              />
              <Button onClick={handleDeductMoney} size="sm" variant="destructive">
                <Minus className="w-4 h-4 mr-1" />
                Deduct
              </Button>
            </div>
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
