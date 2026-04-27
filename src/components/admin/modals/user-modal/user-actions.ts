import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const giftBlueTick = async (userId: string) => {
  const { error } = await supabase.from('profiles').update({ has_blue_check: true }).eq('id', userId);
  if (error) {
    toast.error('Failed to gift blue tick');
    return false;
  }
  toast.success('Blue Tick gifted successfully!');
  return true;
};

export const giftMoney = async (user: any, giftAmount: string) => {
  if (!user || !giftAmount) return null;
  const amount = parseFloat(giftAmount);
  if (isNaN(amount) || amount === 0) {
    toast.error('Invalid amount');
    return null;
  }
  const newBalance = (user.wallet_balance || 0) + amount;
  if (newBalance < 0) {
    toast.error(`Cannot deduct more than current balance (₹${user.wallet_balance || 0})`);
    return null;
  }
  const { error } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', user.id);
  if (error) { toast.error('Failed to update balance'); return null; }
  const isDeduction = amount < 0;
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: isDeduction ? 'gift_deduct' : 'gift',
    amount: Math.abs(amount),
    status: 'completed',
    description: isDeduction ? `Admin deducted - ₹${Math.abs(amount)}` : `Admin gift - ₹${amount}`,
  });
  toast.success(isDeduction ? `₹${Math.abs(amount)} deducted from ${user.name}` : `₹${amount} gifted to ${user.name}`);
  return newBalance;
};

export const updateWalletBalance = async (user: any, walletBalanceInput: string) => {
  if (!user || walletBalanceInput === '') return null;
  const newBalance = parseFloat(walletBalanceInput);
  if (isNaN(newBalance) || newBalance < 0) { toast.error('Invalid balance amount'); return null; }
  const oldBalance = user.wallet_balance || 0;
  const difference = newBalance - oldBalance;
  const { error } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', user.id);
  if (error) { toast.error('Failed to update wallet balance'); return null; }
  if (difference !== 0) {
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: difference > 0 ? 'admin_credit' : 'admin_debit',
      amount: Math.abs(difference),
      status: 'completed',
      description: `Admin balance adjustment: ₹${oldBalance} → ₹${newBalance}`,
    });
  }
  toast.success(`Wallet balance updated to ₹${newBalance}`);
  return newBalance;
};

export const updateRankBalance = async (user: any, rankBalanceInput: string) => {
  if (!user || !rankBalanceInput) return null;
  const newRankBalance = parseFloat(rankBalanceInput);
  if (isNaN(newRankBalance) || newRankBalance < 0) { toast.error('Invalid rank balance'); return null; }
  const { error } = await supabase.from('profiles').update({ rank_balance: newRankBalance }).eq('id', user.id);
  if (error) { toast.error('Failed to update rank balance'); return null; }
  toast.success(`Rank balance updated to ₹${newRankBalance}`);
  return newRankBalance;
};

export const setUserRank = async (user: any, rank: any) => {
  const { error } = await supabase.from('profiles').update({ rank_balance: rank.min_balance }).eq('id', user.id);
  if (error) { toast.error('Failed to set rank'); return false; }
  toast.success(`Rank set to ${rank.icon} ${rank.name}!`);
  return true;
};

export const toggleReseller = async (user: any, checked: boolean) => {
  await supabase.from('profiles').update({ is_reseller: checked }).eq('id', user.id);
  toast.success(checked ? 'User is now a Reseller!' : 'Reseller status removed');
};

export const toggleSeller = async (user: any) => {
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
};

export const deleteUser = async (user: any) => {
  if (!confirm(`Are you sure you want to delete ${user.name}?`)) return false;
  await supabase.from('user_roles').delete().eq('user_id', user.id);
  await supabase.from('notifications').delete().eq('user_id', user.id);
  await supabase.from('transactions').delete().eq('user_id', user.id);
  await supabase.from('orders').delete().eq('user_id', user.id);
  await supabase.from('profiles').delete().eq('id', user.id);
  toast.success('User deleted');
  return true;
};
