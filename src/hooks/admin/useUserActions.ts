import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function handleGiftBlueTick(userId: string, onComplete: () => void) {
  const { error } = await supabase.from('profiles').update({ has_blue_check: true }).eq('id', userId);
  if (error) {
    toast.error('Failed to gift blue tick');
    return false;
  }
  toast.success('Blue Tick gifted successfully!');
  onComplete();
  return true;
}

export async function handleGiftMoney(
  userId: string, 
  userName: string,
  currentBalance: number,
  amount: number, 
  onComplete: () => void
) {
  if (isNaN(amount) || amount === 0) {
    toast.error('Invalid amount');
    return false;
  }

  const newBalance = currentBalance + amount;
  
  // Prevent balance from going negative
  if (newBalance < 0) {
    toast.error(`Cannot deduct more than current balance (₹${currentBalance})`);
    return false;
  }
  
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ wallet_balance: newBalance })
    .eq('id', userId);
  
  if (updateError) {
    toast.error('Failed to update balance');
    return false;
  }

  // For transaction record, store positive amount with appropriate type
  const isDeduction = amount < 0;
  await supabase.from('transactions').insert({
    user_id: userId,
    type: isDeduction ? 'gift_deduct' : 'gift',
    amount: Math.abs(amount),
    status: 'completed',
    description: isDeduction 
      ? `Admin deducted - ₹${Math.abs(amount)}` 
      : `Admin gift - ₹${amount}`
  });

  toast.success(isDeduction 
    ? `₹${Math.abs(amount)} deducted from ${userName}` 
    : `₹${amount} gifted to ${userName}`
  );
  onComplete();
  return true;
}

export async function handleUpdateRankBalance(userId: string, rankBalance: number, onComplete: () => void) {
  if (isNaN(rankBalance) || rankBalance < 0) {
    toast.error('Invalid rank balance');
    return false;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ rank_balance: rankBalance })
    .eq('id', userId);
  
  if (error) {
    toast.error('Failed to update rank balance');
    return false;
  }

  toast.success('Rank balance updated successfully!');
  onComplete();
  return true;
}

export async function handleToggleReseller(userId: string, currentStatus: boolean, onComplete: () => void) {
  const { error } = await supabase.from('profiles').update({ is_reseller: !currentStatus }).eq('id', userId);
  if (error) {
    toast.error('Failed to update reseller status');
    return false;
  }
  toast.success(!currentStatus ? 'User is now a Reseller!' : 'Reseller status removed');
  onComplete();
  return true;
}

export async function handleToggleSellerRole(userId: string, onComplete: () => void) {
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'seller')
    .maybeSingle();

  if (existingRole) {
    await supabase.from('user_roles').delete().eq('id', existingRole.id);
    toast.success('Seller role removed');
  } else {
    await supabase.from('user_roles').insert({ user_id: userId, role: 'seller' });
    toast.success('User is now a seller!');
  }
  onComplete();
  return true;
}

export async function handleDeleteUser(userId: string, userName: string, onComplete: () => void) {
  if (!confirm(`Are you sure you want to delete ${userName}?`)) return false;
  
  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.from('notifications').delete().eq('user_id', userId);
  await supabase.from('transactions').delete().eq('user_id', userId);
  await supabase.from('orders').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
  
  toast.success('User deleted');
  onComplete();
  return true;
}
