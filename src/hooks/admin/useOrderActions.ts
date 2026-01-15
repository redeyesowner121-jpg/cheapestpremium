import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function handleUpdateOrderStatus(
  orderId: string,
  status: string,
  adminNote: string,
  accessLink: string,
  orders: any[],
  onComplete: () => void
) {
  const order = orders.find(o => o.id === orderId);
  
  const updateData: any = { 
    status, 
    admin_note: adminNote || null,
    updated_at: new Date().toISOString()
  };
  
  if (accessLink) {
    updateData.access_link = accessLink;
  }

  const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
  
  if (error) {
    toast.error('Failed to update order');
    return false;
  }

  // Add status history
  await supabase.from('order_status_history').insert({
    order_id: orderId,
    status,
    note: adminNote || null
  });

  // Send notification to user
  if (order) {
    let notificationTitle = '';
    let notificationMessage = '';
    
    switch (status) {
      case 'completed':
        notificationTitle = 'Order Completed! ✅';
        notificationMessage = `Your order for ${order.product_name} has been completed.`;
        break;
      case 'processing':
        notificationTitle = 'Order Processing 🔄';
        notificationMessage = `Your order for ${order.product_name} is being processed.`;
        break;
      case 'cancelled':
        notificationTitle = 'Order Cancelled ❌';
        notificationMessage = `Your order for ${order.product_name} has been cancelled. Refund added to wallet.`;
        break;
      case 'refunded':
        notificationTitle = 'Order Refunded 💰';
        notificationMessage = `Your order for ${order.product_name} has been refunded.`;
        break;
      default:
        notificationTitle = 'Order Update';
        notificationMessage = `Your order for ${order.product_name} status: ${status}`;
    }

    await supabase.from('notifications').insert({
      user_id: order.user_id,
      title: notificationTitle,
      message: notificationMessage,
      type: 'order'
    });

    // If cancelled/refunded, refund money
    if (status === 'cancelled' || status === 'refunded') {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', order.user_id)
        .single();
      
      if (userProfile) {
        await supabase.from('profiles').update({
          wallet_balance: (userProfile.wallet_balance || 0) + order.total_price
        }).eq('id', order.user_id);

        await supabase.from('transactions').insert({
          user_id: order.user_id,
          type: 'refund',
          amount: order.total_price,
          status: 'completed',
          description: `Order refund - ${order.product_name}`
        });
      }
    }
  }

  toast.success('Order updated!');
  onComplete();
  return true;
}
