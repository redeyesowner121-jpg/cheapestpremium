import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  transaction_id: string;
  sender_name: string | null;
  payment_method: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  profiles?: { name: string; email: string };
}

export const rejectAllPendingDeposits = async (depositRequests: DepositRequest[]) => {
  const pending = depositRequests.filter(r => r.status === 'pending');
  if (pending.length === 0) return 0;
  const pendingIds = pending.map(r => r.id);

  await supabase
    .from('manual_deposit_requests')
    .update({ status: 'rejected', admin_note: 'Bulk rejected by admin' })
    .in('id', pendingIds);

  const notifications = pending.map(r => ({
    user_id: r.user_id,
    title: 'Deposit Rejected ❌',
    message: `Your deposit request of ₹${r.amount} was rejected.`,
    type: 'wallet',
  }));
  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
  toast.success(`Rejected ${pendingIds.length} pending requests`);
  return pendingIds.length;
};

export const approveDeposit = async (selectedRequest: DepositRequest, adminNote: string) => {
  await supabase
    .from('manual_deposit_requests')
    .update({ status: 'approved', admin_note: adminNote || null })
    .eq('id', selectedRequest.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_balance, total_deposit, has_blue_check, rank_balance')
    .eq('id', selectedRequest.user_id)
    .single();

  if (profile) {
    const newBalance = (profile.wallet_balance || 0) + selectedRequest.amount;
    const newTotalDeposit = (profile.total_deposit || 0) + selectedRequest.amount;
    const newRankBalance = (profile.rank_balance || 0) + selectedRequest.amount;
    const shouldGetBlueTick = !profile.has_blue_check && selectedRequest.amount >= 1000;

    await supabase
      .from('profiles')
      .update({
        wallet_balance: newBalance,
        total_deposit: newTotalDeposit,
        rank_balance: newRankBalance,
        ...(shouldGetBlueTick && { has_blue_check: true }),
      })
      .eq('id', selectedRequest.user_id);

    await supabase.from('transactions').insert({
      user_id: selectedRequest.user_id,
      type: 'deposit',
      amount: selectedRequest.amount,
      status: 'completed',
      description: `Manual deposit - ${selectedRequest.transaction_id}`,
    });

    await supabase.from('notifications').insert({
      user_id: selectedRequest.user_id,
      title: 'Deposit Approved! ✅',
      message: `Your deposit of ₹${selectedRequest.amount} has been approved and added to your wallet.`,
      type: 'wallet',
    });
  }
  toast.success('Deposit approved successfully');
};

export const rejectDeposit = async (selectedRequest: DepositRequest, adminNote: string) => {
  await supabase
    .from('manual_deposit_requests')
    .update({ status: 'rejected', admin_note: adminNote || 'Request rejected by admin' })
    .eq('id', selectedRequest.id);

  await supabase.from('notifications').insert({
    user_id: selectedRequest.user_id,
    title: 'Deposit Rejected ❌',
    message: `Your deposit request of ₹${selectedRequest.amount} was rejected. ${adminNote ? `Reason: ${adminNote}` : ''}`,
    type: 'wallet',
  });
  toast.success('Deposit rejected');
};
