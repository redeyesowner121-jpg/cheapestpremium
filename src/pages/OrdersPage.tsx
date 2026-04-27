import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { OrderCard, OrderTabs, ReportOrderModal } from '@/components/orders';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrders, type Order } from './orders/useOrders';
import GuestOrders from './orders/GuestOrders';

const OrdersPage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const { orders, loading, loadOrders } = useOrders(user, profile);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending', 'processing'].includes(order.status);
    if (activeTab === 'completed') return ['completed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status);
    return true;
  });

  const handleConfirmReceipt = async (order: Order) => {
    if (!order.seller_id || !user) return;
    setConfirmingOrder(order.id);
    try {
      const { error } = await supabase.rpc('confirm_seller_receipt', {
        _buyer_id: user.id, _order_id: order.id,
      });
      if (error) throw new Error(error.message);
      toast.success('Receipt confirmed! Payment released to seller.');
      await refreshProfile(); loadOrders();
    } catch (error: any) { toast.error(error.message || 'Failed to confirm receipt'); }
    finally { setConfirmingOrder(null); }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('cancel_order_refund', {
        _user_id: user.id, _order_id: orderId,
      });
      if (error) throw new Error(error.message);
      const result = data as any;
      const message = result.refunded
        ? 'Order cancelled and refunded'
        : 'Order cancelled (no refund - coupon/discount was used)';
      toast.success(message);
      await refreshProfile(); loadOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel order');
      loadOrders();
    }
  };

  if (!user) return <GuestOrders />;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-4">My Orders</h1>
          <OrderTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No orders found</div>
            ) : (
              filteredOrders.map((order, index) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  index={index}
                  confirmingOrder={confirmingOrder}
                  onConfirmReceipt={handleConfirmReceipt}
                  onCancelOrder={handleCancelOrder}
                  onReport={(o) => { setSelectedOrder(o); setShowReportModal(true); }}
                />
              ))
            )}
          </div>
        </motion.div>
      </main>
      <ReportOrderModal open={showReportModal} onOpenChange={setShowReportModal} orderId={selectedOrder?.id || ''} />
      <BottomNav />
    </div>
  );
};

export default OrdersPage;
