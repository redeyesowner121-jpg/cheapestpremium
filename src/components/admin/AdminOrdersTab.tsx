import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface AdminOrdersTabProps {
  orders: any[];
  onSelectOrder: (order: any) => void;
}

const AdminOrdersTab: React.FC<AdminOrdersTabProps> = ({ orders, onSelectOrder }) => {
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {['all', 'pending', 'processing', 'completed', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === status 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-1 text-xs">
                ({orders.filter(o => o.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredOrders.map((order: any) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="flex items-start gap-4">
              <img src={order.product_image || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">{order.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  {order.profiles?.name} • {order.profiles?.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Phone: {order.profiles?.phone || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Qty: {order.quantity} | Total: ₹{order.total_price}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </p>
                {order.user_note && (
                  <p className="text-xs text-primary mt-1 bg-primary/5 p-2 rounded">
                    📝 Note: {order.user_note}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  order.status === 'completed' ? 'bg-success/10 text-success' :
                  order.status === 'pending' ? 'bg-primary/10 text-primary' :
                  order.status === 'processing' ? 'bg-accent/10 text-accent' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {order.status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => onSelectOrder(order)}
                >
                  Manage
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminOrdersTab;
