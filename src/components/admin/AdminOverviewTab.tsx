import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, ShoppingBag, Clock, TrendingUp, Award, Calendar, 
  Package, UserPlus, Bell, BarChart3, Activity, DollarSign,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import AdminAnalytics from '@/components/AdminAnalytics';

import { AdminStats, AdminData } from '@/hooks/useAdminData';

interface AdminOverviewTabProps {
  stats: AdminStats;
  data: AdminData;
}

const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ stats, data }) => {
  const navigate = useNavigate();

  // Calculate growth metrics
  const todayRevenue = data.orders
    .filter(o => {
      const orderDate = new Date(o.created_at);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString() && o.status === 'completed';
    })
    .reduce((sum, o) => sum + o.total_price, 0);

  const completedOrders = data.orders.filter(o => o.status === 'completed').length;
  const completionRate = data.orders.length > 0 
    ? Math.round((completedOrders / data.orders.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Overview & Analytics</h2>
          <p className="text-sm text-muted-foreground">Monitor your business performance</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3" />
          <span>Live Data</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-green-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              Active
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
          <p className="text-xs text-muted-foreground">Total Users</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-success/10 to-success/5 rounded-2xl p-4 border border-success/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-success/10 rounded-xl">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <span className="text-xs text-success flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              +{stats.todayOrders}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">₹{stats.totalDeposits.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Total Deposits</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl p-4 border border-accent/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xs text-accent flex items-center gap-0.5">
              {completionRate}% Done
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`bg-gradient-to-br rounded-2xl p-4 border ${
            stats.pendingOrders > 0 
              ? 'from-destructive/10 to-destructive/5 border-destructive/20' 
              : 'from-muted/50 to-muted/30 border-border'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl ${stats.pendingOrders > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
              <Clock className={`w-5 h-5 ${stats.pendingOrders > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            {stats.pendingOrders > 0 && (
              <motion.span 
                className="text-xs text-destructive flex items-center gap-0.5"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Needs Action
              </motion.span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.pendingOrders}</p>
          <p className="text-xs text-muted-foreground">Pending Orders</p>
        </motion.div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Award, value: stats.blueTickUsers, label: 'Blue Tick Users', color: 'text-blue-500' },
          { icon: Calendar, value: stats.todayOrders, label: "Today's Orders", color: 'text-green-500' },
          { icon: Package, value: data.products.length, label: 'Products', color: 'text-purple-500' },
          { icon: UserPlus, value: data.tempAdmins.length, label: 'Temp Admins', color: 'text-orange-500' },
          { icon: BarChart3, value: `₹${todayRevenue.toFixed(0)}`, label: "Today's Revenue", color: 'text-emerald-500' }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="bg-card rounded-xl p-3 shadow-sm border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-lg font-bold text-foreground">{stat.value}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Stock Alerts */}
      {(stats.lowStockProducts.length > 0 || stats.outOfStockProducts.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-foreground">Stock Alert</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {stats.outOfStockProducts.length > 0 && (
                  <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-lg">
                    {stats.outOfStockProducts.length} Out of Stock
                  </span>
                )}
                {stats.lowStockProducts.length > 0 && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded-lg">
                    {stats.lowStockProducts.length} Low Stock
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analytics Dashboard */}
      <AdminAnalytics orders={data.orders} products={data.products} users={data.users} transactions={data.transactions} />
    </div>
  );
};

export default AdminOverviewTab;
