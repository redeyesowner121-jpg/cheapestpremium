import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, ShoppingBag, IndianRupee, TrendingUp,
  ArrowUpRight, ArrowDownRight, Wallet, Package,
  UserPlus, Clock,
} from 'lucide-react';
import type { AnalyticsData } from './types';

const OverviewTab: React.FC<AnalyticsData> = ({ orders, products, users, transactions }) => {
  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter(o => o.status === 'completed' || o.status === 'delivered')
      .reduce((s, o) => s + o.total_price, 0);
    const totalDeposits = transactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((s, t) => s + t.amount, 0);
    const totalWallet = users.reduce((s, u) => s + (u.wallet_balance || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const todayOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d.toDateString() === new Date().toDateString();
    }).length;
    const todayUsers = users.filter(u => {
      if (!u.created_at) return false;
      return new Date(u.created_at).toDateString() === new Date().toDateString();
    }).length;

    return { totalRevenue, totalDeposits, totalWallet, pendingOrders, todayOrders, todayUsers };
  }, [orders, users, transactions]);

  const cards = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'from-primary/20 to-primary/5', iconColor: 'text-primary', sub: `+${stats.todayUsers} today` },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: IndianRupee, color: 'from-success/20 to-success/5', iconColor: 'text-success', sub: `${orders.length} orders` },
    { label: 'Total Deposits', value: `₹${stats.totalDeposits.toLocaleString()}`, icon: TrendingUp, color: 'from-accent/20 to-accent/5', iconColor: 'text-accent', sub: 'All time' },
    { label: 'Wallet Balance', value: `₹${stats.totalWallet.toLocaleString()}`, icon: Wallet, color: 'from-secondary/20 to-secondary/5', iconColor: 'text-secondary-foreground', sub: `${users.length} users` },
    { label: 'Products', value: products.length, icon: Package, color: 'from-primary/10 to-primary/5', iconColor: 'text-primary', sub: `${products.filter(p => (p.stock ?? 0) <= 0 && p.stock !== null).length} out of stock` },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: Clock, color: stats.pendingOrders > 0 ? 'from-destructive/20 to-destructive/5' : 'from-muted/50 to-muted/30', iconColor: stats.pendingOrders > 0 ? 'text-destructive' : 'text-muted-foreground', sub: `${stats.todayOrders} today` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`bg-gradient-to-br ${card.color} rounded-2xl p-4 relative overflow-hidden`}
          >
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-background/30">
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Insights */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 text-sm">Quick Insights</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Avg Order Value', value: orders.length > 0 ? `₹${(orders.reduce((s,o) => s+o.total_price, 0) / orders.length).toFixed(0)}` : '₹0' },
            { label: 'Completion Rate', value: orders.length > 0 ? `${Math.round((orders.filter(o => o.status === 'completed' || o.status === 'delivered').length / orders.length) * 100)}%` : '0%' },
            { label: 'Avg Deposit', value: (() => { const deps = transactions.filter(t => t.type === 'deposit' && t.status === 'completed'); return deps.length > 0 ? `₹${(deps.reduce((s,t) => s+t.amount, 0) / deps.length).toFixed(0)}` : '₹0'; })() },
            { label: 'Active Products', value: products.filter(p => p.sold_count > 0).length },
          ].map(item => (
            <div key={item.label} className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
