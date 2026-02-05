import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  orders: any[];
  onRefresh: () => void;
}

const OrderModal: React.FC<OrderModalProps> = ({
  open,
  onOpenChange,
  order,
  orders,
  onRefresh,
}) => {
  const [adminNote, setAdminNote] = React.useState(order?.admin_note || '');
  const [accessLink, setAccessLink] = React.useState(order?.access_link || '');

  React.useEffect(() => {
    if (order) {
      setAdminNote(order.admin_note || '');
      setAccessLink(order.access_link || '');
    }
  }, [order]);

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    // Re-fetch fresh order data to prevent race conditions
    const { data: freshOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (!freshOrder) {
      toast.error('Order not found');
      return;
    }
    
    // Check if order status has already changed
    if ((status === 'cancelled' || status === 'refunded') && freshOrder.status !== 'pending' && freshOrder.status !== 'processing') {
      toast.error('Order status has already been updated. Please refresh.');
      onRefresh();
      return;
    }
    
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
      return;
    }

    // Check if discount/coupon was used
    const hasDiscount = (freshOrder.discount_applied || 0) > 0;

    // Send notification to user
    let notificationTitle = '';
    let notificationMessage = '';
    
    switch (status) {
      case 'completed':
        notificationTitle = 'Order Completed! ✅';
        notificationMessage = `Your order for ${freshOrder.product_name} has been completed.`;
        break;
      case 'processing':
        notificationTitle = 'Order Processing 🔄';
        notificationMessage = `Your order for ${freshOrder.product_name} is being processed.`;
        break;
      case 'cancelled':
        notificationTitle = 'Order Cancelled ❌';
        notificationMessage = hasDiscount 
          ? `Your order for ${freshOrder.product_name} has been cancelled. No refund (coupon/discount was used).`
          : `Your order for ${freshOrder.product_name} has been cancelled. Refund added to wallet.`;
        break;
      case 'refunded':
        notificationTitle = 'Order Refunded 💰';
        notificationMessage = hasDiscount
          ? `Your order for ${freshOrder.product_name} has been cancelled. No refund (coupon/discount was used).`
          : `Your order for ${freshOrder.product_name} has been refunded.`;
        break;
      default:
        notificationTitle = 'Order Update';
        notificationMessage = `Your order for ${freshOrder.product_name} status: ${status}`;
    }

    await supabase.from('notifications').insert({
      user_id: freshOrder.user_id,
      title: notificationTitle,
      message: notificationMessage,
      type: 'order'
    });

    // If cancelled/refunded, refund ONLY if no discount/coupon was used
    if (status === 'cancelled' || status === 'refunded') {
      if (!hasDiscount) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', freshOrder.user_id)
          .single();
        
        if (userProfile) {
          await supabase.from('profiles').update({
            wallet_balance: (userProfile.wallet_balance || 0) + freshOrder.total_price
          }).eq('id', freshOrder.user_id);

          await supabase.from('transactions').insert({
            user_id: freshOrder.user_id,
            type: 'refund',
            amount: freshOrder.total_price,
            status: 'completed',
            description: `Order refund - ${freshOrder.product_name}`
          });
        }
      }
    }

    toast.success('Order updated!');
    setAdminNote('');
    setAccessLink('');
    onOpenChange(false);
    onRefresh();
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <img 
              src={order.product_image || 'https://via.placeholder.com/80'} 
              alt="" 
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div>
              <p className="font-bold text-foreground">{order.product_name}</p>
              <p className="text-primary font-bold text-lg">₹{order.total_price}</p>
              <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                order.status === 'completed' ? 'bg-success/10 text-success' :
                order.status === 'pending' ? 'bg-accent/10 text-accent' :
                order.status === 'processing' ? 'bg-secondary/10 text-secondary' :
                'bg-destructive/10 text-destructive'
              }`}>
                {order.status}
              </span>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
            <p><strong>Customer:</strong> {order.profiles?.name || order.guest_name || 'Guest'}</p>
            <p><strong>Email:</strong> {order.profiles?.email || order.guest_email || 'N/A'}</p>
            <p><strong>Phone:</strong> {order.profiles?.phone || order.guest_phone || 'N/A'}</p>
            {!order.user_id && order.guest_email && (
              <p className="text-accent font-medium">🏷️ Guest Order</p>
            )}
            <p><strong>Ordered:</strong> {new Date(order.created_at).toLocaleString()}</p>
            {order.user_note && (
              <p className="mt-2 p-2 bg-background rounded-lg">
                <strong>Customer Note:</strong> {order.user_note}
              </p>
            )}
          </div>

          <Textarea
            placeholder="Admin note (optional)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
          />

          <Input
            placeholder="Access Link / Credentials"
            value={accessLink}
            onChange={(e) => setAccessLink(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleUpdateOrderStatus(order.id, 'processing')}>
              <Clock className="w-4 h-4 mr-2" />
              Processing
            </Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleUpdateOrderStatus(order.id, 'completed')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete
            </Button>
          </div>
          <Button variant="destructive" className="w-full" onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel & Refund
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderModal;
