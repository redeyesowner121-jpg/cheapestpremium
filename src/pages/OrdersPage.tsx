import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { OrderCard, OrderTabs, ReportOrderModal } from '@/components/orders';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Order {
  id: string;
  product_name: string;
  product_image: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  access_link?: string;
  admin_note?: string;
  user_note?: string;
  seller_id?: string;
  buyer_confirmed?: boolean;
  is_withdrawable?: boolean;
}

const OrdersPage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  useEffect(() => { if (user) loadOrders(); }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending', 'processing'].includes(order.status);
    if (activeTab === 'completed') return ['completed', 'cancelled', 'refunded'].includes(order.status);
    return true;
  });

  const handleConfirmReceipt = async (order: Order) => {
    if (!order.seller_id || !user) return;
    setConfirmingOrder(order.id);
    try {
      const platformCommission = order.total_price * 0.10;
      const sellerEarnings = order.total_price - platformCommission;
      const { data: sellerProfile } = await supabase.from('profiles').select('wallet_balance, pending_balance').eq('id', order.seller_id).single();
      if (sellerProfile) {
        await supabase.from('profiles').update({ wallet_balance: (sellerProfile.wallet_balance || 0) + sellerEarnings, pending_balance: Math.max(0, (sellerProfile.pending_balance || 0) - sellerEarnings) }).eq('id', order.seller_id);
      }
      await supabase.from('orders').update({ buyer_confirmed: true, is_withdrawable: true, updated_at: new Date().toISOString() }).eq('id', order.id);
      await supabase.from('transactions').update({ status: 'completed', type: 'sale', description: `Sale completed: ${order.product_name} (10% commission deducted)` }).eq('user_id', order.seller_id).eq('type', 'sale_pending').eq('status', 'pending');
      await supabase.from('notifications').insert({ user_id: order.seller_id, title: 'Payment Released! 💰', message: `Buyer confirmed receipt for ${order.product_name}. ₹${sellerEarnings.toFixed(2)} has been added to your wallet.`, type: 'payment' });
      toast.success('Receipt confirmed! Payment released to seller.');
      await refreshProfile(); loadOrders();
    } catch (error) { toast.error('Failed to confirm receipt'); }
    finally { setConfirmingOrder(null); }
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return;
    try {
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', orderId);
      if (profile) {
        const newBalance = (profile.wallet_balance || 0) + order.total_price;
        await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', user?.id);
        await supabase.from('transactions').insert({ user_id: user?.id, type: 'refund', amount: order.total_price, status: 'completed', description: `Order cancelled - ${order.product_name}` });
      }
      if (order.seller_id) {
        const sellerEarnings = order.total_price * 0.90;
        const { data: sellerProfile } = await supabase.from('profiles').select('pending_balance').eq('id', order.seller_id).single();
        if (sellerProfile) { await supabase.from('profiles').update({ pending_balance: Math.max(0, (sellerProfile.pending_balance || 0) - sellerEarnings) }).eq('id', order.seller_id); }
        await supabase.from('transactions').delete().eq('user_id', order.seller_id).eq('type', 'sale_pending').eq('status', 'pending');
        await supabase.from('notifications').insert({ user_id: order.seller_id, title: 'Order Cancelled', message: `Order for ${order.product_name} was cancelled by the buyer.`, type: 'order' });
      }
      toast.success('Order cancelled and refunded');
      await refreshProfile(); loadOrders();
    } catch (error) { toast.error('Failed to cancel order'); }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

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
