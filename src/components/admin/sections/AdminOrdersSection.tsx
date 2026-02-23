import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface AdminOrdersSectionProps {
  orders: any[];
  orderFilter: string;
  onOrderFilterChange: (filter: string) => void;
  onSelectOrder: (order: any) => void;
}

const ORDER_STATUSES = ['all', 'pending', 'processing', 'completed', 'cancelled'];

const AdminOrdersSection: React.FC<AdminOrdersSectionProps> = ({
  orders,
  orderFilter,
  onOrderFilterChange,
  onSelectOrder,
}) => {
  const filteredOrders = orders.filter(o =>
    orderFilter === 'all' || o.status === orderFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {ORDER_STATUSES.map(status => (
          <button
            key={status}
            onClick={() => onOrderFilterChange(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              orderFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredOrders.slice(0, 10).map((order: any) => (
          <div
            key={order.id}
            onClick={() => onSelectOrder(order)}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <img src={order.product_image || '/placeholder.svg'} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{order.product_name}</p>
              <p className="text-xs text-muted-foreground">{order.profiles?.name}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">₹{order.total_price}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                order.status === 'completed' ? 'bg-success/10 text-success' :
                order.status === 'pending' ? 'bg-warning/10 text-warning' :
                order.status === 'processing' ? 'bg-primary/10 text-primary' :
                'bg-destructive/10 text-destructive'
              }`}>
                {order.status}
              </span>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No orders found</p>
        )}
      </div>
    </div>
  );
};

export default AdminOrdersSection;
