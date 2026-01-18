import React, { useMemo, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { 
  TrendingUp, 
  IndianRupee,
  Clock,
  Target,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Star,
  Calendar,
  ShoppingBag,
  Package,
} from 'lucide-react';

interface Order {
  id: string;
  product_name: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  user_id?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  sold_count: number;
  category: string;
  stock?: number | null;
}

interface User {
  id: string;
  total_deposit?: number;
  created_at?: string;
}

interface AdminAnalyticsProps {
  orders: Order[];
  products: Product[];
  users?: User[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ orders, products, users = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [showDetails, setShowDetails] = useState(false);

  // Calculate total deposits
  const totalDeposits = useMemo(() => {
    return users.reduce((sum, u) => sum + (u.total_deposit || 0), 0);
  }, [users]);

  // Calculate REAL sales from orders (not fake sold_count)
  const realSalesData = useMemo(() => {
    const productSales: Record<string, { count: number; revenue: number; name: string; category: string }> = {};
    
    // Only count completed/delivered orders
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
    
    completedOrders.forEach(order => {
      const productName = order.product_name;
      if (!productSales[productName]) {
        productSales[productName] = { 
          count: 0, 
          revenue: 0, 
          name: productName,
          category: 'Unknown'
        };
      }
      productSales[productName].count += order.quantity || 1;
      productSales[productName].revenue += order.total_price || 0;
    });
    
    return productSales;
  }, [orders]);

  // Calculate sales by day based on selected period
  const salesByDay = useMemo(() => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const periodDays = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return date.toISOString().split('T')[0];
    });

    return periodDays.map(date => {
      const dayOrders = orders.filter(o => 
        o.created_at?.split('T')[0] === date && o.status !== 'cancelled'
      );
      const revenue = dayOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      const count = dayOrders.length;
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { 
          weekday: days <= 7 ? 'short' : undefined,
          day: 'numeric',
          month: days > 7 ? 'short' : undefined
        }),
        revenue,
        orders: count,
      };
    });
  }, [orders, selectedPeriod]);

  // Calculate revenue stats with comparison
  const revenueStats = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    
    const now = new Date();
    const thisMonth = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate.getMonth() === now.getMonth() && 
             orderDate.getFullYear() === now.getFullYear() &&
             (o.status === 'completed' || o.status === 'delivered');
    });
    const monthlyRevenue = thisMonth.reduce((sum, o) => sum + (o.total_price || 0), 0);

    // Last month for comparison
    const lastMonth = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      return orderDate.getMonth() === lastMonthDate.getMonth() && 
             orderDate.getFullYear() === lastMonthDate.getFullYear() &&
             (o.status === 'completed' || o.status === 'delivered');
    });
    const lastMonthRevenue = lastMonth.reduce((sum, o) => sum + (o.total_price || 0), 0);
    
    const growthPercent = lastMonthRevenue > 0 
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : '0';

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.created_at?.split('T')[0] === today);
    const todayRevenue = todayOrders
      .filter(o => o.status === 'completed' || o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_price || 0), 0);

    // Average order value
    const avgOrderValue = completedOrders.length > 0 
      ? totalRevenue / completedOrders.length 
      : 0;

    // Conversion rate (completed / total)
    const conversionRate = orders.length > 0 
      ? (completedOrders.length / orders.length * 100).toFixed(1)
      : '0';

    // Unique customers
    const uniqueCustomers = new Set(orders.map(o => o.user_id)).size;
    
    return { 
      totalRevenue, 
      monthlyRevenue, 
      lastMonthRevenue,
      growthPercent,
      todayRevenue,
      todayOrders: todayOrders.length,
      avgOrderValue,
      conversionRate,
      uniqueCustomers,
    };
  }, [orders]);

  // Top selling products - REAL DATA from orders only
  const topProducts = useMemo(() => {
    // Calculate from REAL order data, not fake sold_count
    return Object.values(realSalesData)
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        fullName: p.name,
        sold: p.count,
        revenue: p.revenue,
        category: p.category,
      }));
  }, [realSalesData]);

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

  // Category distribution - REAL revenue from orders
  const categoryDistribution = useMemo(() => {
    const categoryData: Record<string, { count: number; revenue: number }> = {};
    
    // Get REAL category revenue from completed orders
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
    
    completedOrders.forEach(order => {
      // Find product category
      const product = products.find(p => p.name === order.product_name);
      const category = product?.category || 'Other';
      
      if (!categoryData[category]) {
        categoryData[category] = { count: 0, revenue: 0 };
      }
      categoryData[category].count += 1;
      categoryData[category].revenue += order.total_price || 0;
    });
    
    return Object.entries(categoryData)
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders, products]);

  // Hourly distribution for best selling hours
  const hourlyDistribution = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    orders.forEach(o => {
      const hour = new Date(o.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      orders: hourCounts[i] || 0,
    }));
  }, [orders]);

  // Peak hours
  const peakHour = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    orders.forEach(o => {
      const hour = new Date(o.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peak = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    return peak ? `${peak[0]}:00` : 'N/A';
  }, [orders]);

  const isGrowthPositive = parseFloat(revenueStats.growthPercent) >= 0;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Analytics Dashboard
        </h2>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(['7d', '30d', 'all'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedPeriod === period 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-primary/10">
            <IndianRupee className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-foreground">
            ₹{revenueStats.totalRevenue.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Avg: ₹{revenueStats.avgOrderValue.toFixed(0)}/order
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-success/20 to-success/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-success/10">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">This Month</p>
          <p className="text-xl font-bold text-foreground">
            ₹{revenueStats.monthlyRevenue.toLocaleString()}
          </p>
          <div className={`flex items-center gap-1 mt-1 ${isGrowthPositive ? 'text-success' : 'text-destructive'}`}>
            {isGrowthPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            <span className="text-[10px] font-medium">{revenueStats.growthPercent}% vs last month</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-accent/10">
            <Calendar className="w-4 h-4 text-accent" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Today</p>
          <p className="text-xl font-bold text-foreground">
            ₹{revenueStats.todayRevenue.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {revenueStats.todayOrders} orders today
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-secondary/10">
            <Target className="w-4 h-4 text-secondary-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Conversion</p>
          <p className="text-xl font-bold text-foreground">
            {revenueStats.conversionRate}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {revenueStats.uniqueCustomers} customers
          </p>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl whitespace-nowrap">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs">Peak Hour: <strong>{peakHour}</strong></span>
        </div>
        <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl whitespace-nowrap">
          <Flame className="w-4 h-4 text-accent" />
          <span className="text-xs">Hot Category: <strong>{categoryDistribution[0]?.name || 'N/A'}</strong></span>
        </div>
        <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl whitespace-nowrap">
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="text-xs">Top Product: <strong>{topProducts[0]?.name || 'N/A'}</strong></span>
        </div>
      </div>

      {/* Side by Side Charts - Sales & Deposits */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Sales Trend Chart */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Sales Trend
            </h3>
          </div>
          <div className="h-40">
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
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  width={40}
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
        </div>

        {/* Deposits Card */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-success" />
              Total Deposits
            </h3>
          </div>
          <div className="h-40 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold text-success">
              ₹{totalDeposits.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              From {users.length} users
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 w-full">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">
                  ₹{users.length > 0 ? Math.round(totalDeposits / users.length) : 0}
                </p>
                <p className="text-[10px] text-muted-foreground">Avg per user</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">
                  {users.filter(u => (u.total_deposit || 0) > 0).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Active depositors</p>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            <Award className="w-5 h-5 text-accent" />
            Top Selling Products
          </h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                    index === 1 ? 'bg-gray-400/20 text-gray-600' :
                    index === 2 ? 'bg-orange-500/20 text-orange-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={product.fullName}>
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">₹{product.revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{product.sold} sold</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No sales data yet</p>
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
            <ShoppingBag className="w-5 h-5 text-secondary-foreground" />
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
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
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
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No orders yet</p>
            </div>
          )}
          {/* Status Legend */}
          {ordersByStatus.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ordersByStatus.map((status, index) => (
                <div key={status.name} className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {status.name}: <span className="font-medium text-foreground">{status.value}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Category Performance */}
      {categoryDistribution.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-2xl p-4 shadow-card"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-accent" />
            Category Performance
          </h3>
          <div className="space-y-3">
            {categoryDistribution.map((cat, index) => {
              const maxRevenue = Math.max(...categoryDistribution.map(c => c.revenue));
              const width = maxRevenue > 0 ? (cat.revenue / maxRevenue * 100) : 0;
              
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary">₹{cat.revenue.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground ml-2">({cat.count} items)</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Hourly Activity */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-2xl p-4 shadow-card overflow-hidden"
          >
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Hourly Order Activity
            </h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    interval={2}
                  />
                  <YAxis 
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
                  <Bar 
                    dataKey="orders" 
                    fill="hsl(var(--primary))" 
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(AdminAnalytics);
