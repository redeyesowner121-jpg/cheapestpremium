import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import AdminAdvancedFilters from './AdminAdvancedFilters';

interface AdminOrdersTabProps {
  orders: any[];
  onSelectOrder: (order: any) => void;
}

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'amount_high', label: 'Amount ↓' },
  { value: 'amount_low', label: 'Amount ↑' },
];

const AdminOrdersTab: React.FC<AdminOrdersTabProps> = ({ orders, onSelectOrder }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('newest');

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Search filter (order ID, product name, user name/email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.id?.toLowerCase().includes(query) ||
        o.product_name?.toLowerCase().includes(query) ||
        o.profiles?.name?.toLowerCase().includes(query) ||
        o.profiles?.email?.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateRange.from) {
      result = result.filter(o => new Date(o.created_at) >= dateRange.from!);
    }
    if (dateRange.to) {
      const endDate = new Date(dateRange.to);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(o => new Date(o.created_at) <= endDate);
    }

    // Price range filter
    if (priceRange.min) {
      result = result.filter(o => o.total_price >= parseFloat(priceRange.min));
    }
    if (priceRange.max) {
      result = result.filter(o => o.total_price <= parseFloat(priceRange.max));
    }

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'amount_high':
          return b.total_price - a.total_price;
        case 'amount_low':
          return a.total_price - b.total_price;
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [orders, statusFilter, searchQuery, dateRange, priceRange, sortBy]);

  return (
    <div className="space-y-4">
      {/* Advanced Filters */}
      <AdminAdvancedFilters
        config={{
          searchPlaceholder: 'Search by order ID, product, user...',
          showDateFilter: true,
          showPriceFilter: true,
          showSortOptions: true,
          sortOptions
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Status Filter Pills */}
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

      {/* Results Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filteredOrders.length} of {orders.length} orders
      </p>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No orders found matching your filters</p>
          </div>
        ) : (
          filteredOrders.map((order: any) => (
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
                    {order.profiles?.name || order.guest_name || 'Guest'} • {order.profiles?.email || order.guest_email || 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Phone: {order.profiles?.phone || order.guest_phone || 'N/A'}
                  </p>
                  {!order.user_id && order.guest_email && (
                    <span className="inline-block text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded mt-1">
                      Guest Order
                    </span>
                  )}
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
          ))
        )}
      </div>
    </div>
  );
};

export default AdminOrdersTab;
