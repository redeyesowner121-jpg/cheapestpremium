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
    const currentOrder = orders.find(o => o.id === orderId);
    
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

    // Send notification to user
    if (currentOrder) {
      let notificationTitle = '';
      let notificationMessage = '';
      
      switch (status) {
        case 'completed':
          notificationTitle = 'Order Completed! ✅';
          notificationMessage = `Your order for ${currentOrder.product_name} has been completed.`;
          break;
        case 'processing':
          notificationTitle = 'Order Processing 🔄';
          notificationMessage = `Your order for ${currentOrder.product_name} is being processed.`;
          break;
        case 'cancelled':
          notificationTitle = 'Order Cancelled ❌';
          notificationMessage = `Your order for ${currentOrder.product_name} has been cancelled. Refund added to wallet.`;
          break;
        case 'refunded':
          notificationTitle = 'Order Refunded 💰';
          notificationMessage = `Your order for ${currentOrder.product_name} has been refunded.`;
          break;
        default:
          notificationTitle = 'Order Update';
          notificationMessage = `Your order for ${currentOrder.product_name} status: ${status}`;
      }

      await supabase.from('notifications').insert({
        user_id: currentOrder.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: 'order'
      });
    }

    // If cancelled/rejected, refund
    if (status === 'cancelled' || status === 'refunded') {
      if (currentOrder) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', currentOrder.user_id)
          .single();
        
        if (userProfile) {
          await supabase.from('profiles').update({
            wallet_balance: (userProfile.wallet_balance || 0) + currentOrder.total_price
          }).eq('id', currentOrder.user_id);

          await supabase.from('transactions').insert({
            user_id: currentOrder.user_id,
            type: 'refund',
            amount: currentOrder.total_price,
            status: 'completed',
            description: `Order refund - ${currentOrder.product_name}`
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
            <p><strong>Customer:</strong> {order.profiles?.name || 'Unknown'}</p>
            <p><strong>Email:</strong> {order.profiles?.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {order.profiles?.phone || 'N/A'}</p>
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
