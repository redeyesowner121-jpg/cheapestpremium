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
    // Fire-and-forget email via Outlook (only for key statuses)
    if (['confirmed', 'completed', 'processing', 'cancelled', 'refunded'].includes(status)) {
      try {
        let recipientEmail: string | null = order.guest_email || null;
        let recipientName: string | null = order.guest_name || null;
        if (!recipientEmail && order.user_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', order.user_id)
            .maybeSingle();
          recipientEmail = prof?.email || null;
          recipientName = prof?.name || null;
        }
        if (recipientEmail) {
          supabase.functions.invoke('send-order-email', {
            body: {
              to: recipientEmail,
              customerName: recipientName,
              productName: order.product_name,
              orderId: orderId,
              status,
              totalPrice: order.total_price,
              accessLink: accessLink || order.access_link || null,
              hasDiscount: (order.discount_applied || 0) > 0,
            },
          }).catch((e) => console.error('Email send error:', e));
        }
      } catch (e) {
        console.error('Email prep error:', e);
      }
    }

    let notificationTitle = '';
    let notificationMessage = '';
    const hasDiscount = (order.discount_applied || 0) > 0;
    
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
        notificationMessage = hasDiscount 
          ? `Your order for ${order.product_name} has been cancelled. No refund (coupon/discount was used).`
          : `Your order for ${order.product_name} has been cancelled. Refund added to wallet.`;
        break;
      case 'refunded':
        notificationTitle = 'Order Refunded 💰';
        notificationMessage = hasDiscount
          ? `Your order for ${order.product_name} has been cancelled. No refund (coupon/discount was used).`
          : `Your order for ${order.product_name} has been refunded.`;
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

    // If cancelled/refunded, refund money ONLY if no discount/coupon was used
    if (status === 'cancelled' || status === 'refunded') {
      const hasDiscount = (order.discount_applied || 0) > 0;
      
      if (!hasDiscount) {
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
  }

  toast.success('Order updated!');
  onComplete();
  return true;
}
