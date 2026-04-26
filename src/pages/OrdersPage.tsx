import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { OrderCard, OrderTabs, ReportOrderModal } from '@/components/orders';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, LogIn } from 'lucide-react';

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
  discount_applied?: number;
}

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  useEffect(() => { 
    if (user) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    setLoading(true);

    // Auto-claim any orphaned bot orders that belong to this user's telegram account.
    // This handles the case where a Telegram user purchased via the bot (orders saved
    // on the synthetic telegram_<id>@bot.local profile) and later signs in from
    // "View on Website" with their real email — orders would otherwise be invisible.
    try {
      const tgId =
        (profile as any)?.telegram_id ??
        (user as any)?.user_metadata?.telegram_id ??
        null;
      if (tgId) {
        await supabase.rpc('claim_telegram_orders', { _telegram_id: Number(tgId) });
      }
    } catch (e) {
      console.warn('claim_telegram_orders failed (non-fatal):', e);
    }

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

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
      const { data, error } = await supabase.rpc('confirm_seller_receipt', {
        _buyer_id: user.id,
        _order_id: order.id,
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
        _user_id: user.id,
        _order_id: orderId,
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

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  // Guest view - show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="pt-20 px-4 max-w-lg mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <motion.div 
              className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <ShoppingBag className="w-10 h-10 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground mb-2">My Orders</h2>
            <p className="text-muted-foreground mb-8">
              Login to view your order history and track deliveries
            </p>
            
            <Button 
              className="w-full h-12 btn-gradient rounded-xl"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="w-5 h-5 mr-2" />
              Login to Continue
            </Button>

            <p className="text-sm text-muted-foreground mt-6">
              Guest orders can be tracked via email confirmation
            </p>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    );
  }

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
