import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedSuccessModal, { SuccessType } from '@/components/AnimatedSuccessModal';
import { useNavigate } from 'react-router-dom';

const RecentOrderNotification: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [orderData, setOrderData] = useState<{ type: SuccessType; title: string; subtitle: string; details: { label: string; value: string }[] } | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkRecentOrders = async () => {
      // Check if we already showed this session
      const sessionKey = `recent_order_shown_${user.id}`;
      if (sessionStorage.getItem(sessionKey)) return;

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const { data: orders } = await supabase
        .from('orders')
        .select('id, product_name, total_price, status, access_link, created_at')
        .eq('user_id', user.id)
        .gte('created_at', twoDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!orders || orders.length === 0) return;

      const order = orders[0];
      let type: SuccessType = 'order_placed';
      let title = 'Order Placed!';
      let subtitle = 'Your recent order is being processed.';

      if (order.status === 'confirmed') {
        type = 'order_confirmed';
        title = 'Order Confirmed ✅';
        subtitle = 'Your order has been confirmed by the seller.';
      } else if (order.status === 'delivered' || order.status === 'completed') {
        type = 'order_delivered';
        title = 'Order Delivered! 🎉';
        subtitle = 'Check your order history for access details.';
      } else if (order.status === 'shipped') {
        type = 'order_confirmed';
        title = 'Order Shipped 📦';
        subtitle = 'Your order is on the way!';
      }

      // Only show for pending/confirmed/shipped/delivered within 2 days
      if (['pending', 'confirmed', 'shipped', 'delivered', 'completed'].includes(order.status || '')) {
        setOrderData({
          type,
          title,
          subtitle,
          details: [
            { label: 'Product', value: order.product_name },
            { label: 'Amount', value: `₹${order.total_price}` },
          ],
        });
        setShow(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(checkRecentOrders, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  if (!orderData) return null;

  return (
    <AnimatedSuccessModal
      isOpen={show}
      onClose={() => setShow(false)}
      type={orderData.type}
      title={orderData.title}
      subtitle={orderData.subtitle}
      details={orderData.details}
      actionLabel="View Orders"
      onAction={() => navigate('/orders')}
      autoCloseDelay={5000}
    />
  );
};

export default RecentOrderNotification;
