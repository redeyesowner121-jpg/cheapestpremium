import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, ShoppingBag, Package, IndianRupee } from 'lucide-react';

interface Order {
  id: string;
  product_name: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  sold_count: number;
  category: string;
}

interface AdminAnalyticsProps {
  orders: Order[];
  products: Product[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ orders, products }) => {
  // Calculate sales by day (last 7 days)
  const salesByDay = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayOrders = orders.filter(o => 
        o.created_at?.split('T')[0] === date && o.status !== 'cancelled'
      );
      const revenue = dayOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      const count = dayOrders.length;
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        revenue,
        orders: count,
      };
    });
  }, [orders]);

  // Calculate revenue stats
  const revenueStats = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const thisMonth = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      const now = new Date();
      return orderDate.getMonth() === now.getMonth() && 
             orderDate.getFullYear() === now.getFullYear() &&
             (o.status === 'completed' || o.status === 'delivered');
    });
    const monthlyRevenue = thisMonth.reduce((sum, o) => sum + (o.total_price || 0), 0);
    
    return { totalRevenue, monthlyRevenue };
  }, [orders]);

  // Top selling products
  const topProducts = useMemo(() => {
    return [...products]
      .filter(p => (p.sold_count || 0) > 0)
      .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        sold: p.sold_count || 0,
        revenue: (p.sold_count || 0) * p.price,
      }));
  }, [products]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    orders.forEach(o => {
      const status = o.status || 'pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [orders]);

  // Category distribution
  const categoryDistribution = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    products.forEach(p => {
      const category = p.category || 'Other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    return Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            ₹{revenueStats.totalRevenue.toFixed(0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-success/20 to-success/5 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <span className="text-sm text-muted-foreground">This Month</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            ₹{revenueStats.monthlyRevenue.toFixed(0)}
          </p>
        </motion.div>
      </div>

      {/* Sales Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Sales Trend (Last 7 Days)
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesByDay}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => [`₹${value}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top Products & Order Status */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-accent" />
            Top Selling Products
          </h3>
          {topProducts.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Bar dataKey="sold" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No sales data yet
            </div>
          )}
        </motion.div>

        {/* Order Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-secondary" />
            Order Status
          </h3>
          {ordersByStatus.length > 0 ? (
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {ordersByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No orders yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Category Distribution */}
      {categoryDistribution.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <h3 className="font-semibold text-foreground mb-4">Products by Category</h3>
          <div className="space-y-2">
            {categoryDistribution.map((cat, index) => (
              <div key={cat.name} className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-foreground flex-1">{cat.name}</span>
                <span className="text-sm font-medium text-muted-foreground">{cat.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminAnalytics;
