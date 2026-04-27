import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function updateOrderStatus(
  orderId: string,
  status: string,
  adminNote: string,
  finalAccessLink: string,
  onRefresh: () => void
): Promise<boolean> {
  const { data: freshOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (!freshOrder) {
    toast.error('Order not found');
    return false;
  }

  if ((status === 'cancelled' || status === 'refunded') && freshOrder.status !== 'pending' && freshOrder.status !== 'processing') {
    toast.error('Order status has already been updated. Please refresh.');
    onRefresh();
    return false;
  }

  const updateData: any = { status, admin_note: adminNote || null, updated_at: new Date().toISOString() };
  if (finalAccessLink) updateData.access_link = finalAccessLink;

  const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
  if (error) {
    toast.error('Failed to update order');
    return false;
  }

  const hasDiscount = (freshOrder.discount_applied || 0) > 0;

  const { title, message } = buildNotification(status, freshOrder.product_name, hasDiscount);

  await supabase.from('notifications').insert({
    user_id: freshOrder.user_id,
    title, message, type: 'order',
  });

  if ((status === 'cancelled' || status === 'refunded') && !hasDiscount) {
    const { data: userProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', freshOrder.user_id).single();
    if (userProfile) {
      await supabase.from('profiles').update({
        wallet_balance: (userProfile.wallet_balance || 0) + freshOrder.total_price,
      }).eq('id', freshOrder.user_id);

      await supabase.from('transactions').insert({
        user_id: freshOrder.user_id,
        type: 'refund',
        amount: freshOrder.total_price,
        status: 'completed',
        description: `Order refund - ${freshOrder.product_name}`,
      });
    }
  }

  toast.success('Order updated!');
  return true;
}

function buildNotification(status: string, productName: string, hasDiscount: boolean) {
  switch (status) {
    case 'completed':
      return { title: 'Order Completed! ✅', message: `Your order for ${productName} has been completed.` };
    case 'processing':
      return { title: 'Order Processing 🔄', message: `Your order for ${productName} is being processed.` };
    case 'cancelled':
      return {
        title: 'Order Cancelled ❌',
        message: hasDiscount
          ? `Your order for ${productName} has been cancelled. No refund (coupon/discount was used).`
          : `Your order for ${productName} has been cancelled. Refund added to wallet.`,
      };
    case 'refunded':
      return {
        title: 'Order Refunded 💰',
        message: hasDiscount
          ? `Your order for ${productName} has been cancelled. No refund (coupon/discount was used).`
          : `Your order for ${productName} has been refunded.`,
      };
    default:
      return { title: 'Order Update', message: `Your order for ${productName} status: ${status}` };
  }
}
