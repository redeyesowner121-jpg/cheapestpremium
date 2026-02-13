import React, { useMemo, useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
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
  Target,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Wallet,
  ArrowDownLeft,
  ShoppingBag,
  Gift,
  CreditCard,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Order {
  id: string;
  product_name: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  user_id?: string;
  discount_applied?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  sold_count: number;
  category: string;
  stock?: number | null;
  original_price?: number;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  total_deposit?: number;
  wallet_balance?: number;
  created_at?: string;
}

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  description?: string;
}

interface AdminAnalyticsProps {
  orders: Order[];
  products: Product[];
  users?: User[];
  transactions?: Transaction[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deposit: { label: 'Deposit', color: 'text-success', icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
  purchase: { label: 'Purchase', color: 'text-destructive', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  bonus: { label: 'Bonus', color: 'text-accent', icon: <Gift className="w-3.5 h-3.5" /> },
  refund: { label: 'Refund', color: 'text-primary', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  admin_credit: { label: 'Admin Credit', color: 'text-success', icon: <CreditCard className="w-3.5 h-3.5" /> },
  admin_debit: { label: 'Admin Debit', color: 'text-destructive', icon: <CreditCard className="w-3.5 h-3.5" /> },
  gift_deduct: { label: 'Gift Deduct', color: 'text-destructive', icon: <Gift className="w-3.5 h-3.5" /> },
  rank_decay: { label: 'Rank Decay', color: 'text-muted-foreground', icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
};

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ orders, products, users = [], transactions = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [txFilter, setTxFilter] = useState<string>('all');

  // Wallet transaction analytics
  const walletStats = useMemo(() => {
    const totalCredits = transactions
      .filter(t => t.status === 'completed' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = transactions
      .filter(t => t.status === 'completed' && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const byType: Record<string, { count: number; total: number }> = {};
    transactions.filter(t => t.status === 'completed').forEach(t => {
      if (!byType[t.type]) byType[t.type] = { count: 0, total: 0 };
      byType[t.type].count++;
      byType[t.type].total += t.amount;
    });

    const totalWalletBalance = users.reduce((sum, u) => sum + (u.wallet_balance || 0), 0);

    return { totalCredits, totalDebits, byType, totalWalletBalance };
  }, [transactions, users]);

  // Transaction type distribution for pie chart
  const txTypeDistribution = useMemo(() => {
    return Object.entries(walletStats.byType)
      .map(([type, data]) => ({
        name: TRANSACTION_TYPE_LABELS[type]?.label || type,
        value: data.count,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [walletStats]);

  // Daily transaction flow chart
  const dailyFlow = useMemo(() => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const periodDays = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return date.toISOString().split('T')[0];
    });

    return periodDays.map(date => {
      const dayTx = transactions.filter(t =>
        t.created_at?.split('T')[0] === date && t.status === 'completed'
      );
      const credits = dayTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const debits = dayTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

      return {
        date: new Date(date).toLocaleDateString('en-US', {
          weekday: days <= 7 ? 'short' : undefined,
          day: 'numeric',
          month: days > 7 ? 'short' : undefined,
        }),
        credits,
        debits,
      };
    });
  }, [transactions, selectedPeriod]);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (txFilter !== 'all') {
      filtered = filtered.filter(t => t.type === txFilter);
    }
    return filtered.slice(0, 50);
  }, [transactions, txFilter]);

  // Unique transaction types for filter
  const txTypes = useMemo(() => {
    const types = new Set(transactions.map(t => t.type));
    return Array.from(types);
  }, [transactions]);

  // User lookup map
  const userMap = useMemo(() => {
    const map: Record<string, { name: string; email: string }> = {};
    users.forEach(u => { map[u.id] = { name: u.name || '', email: u.email || '' }; });
    return map;
  }, [users]);

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

      {/* Wallet Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-primary/10">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Total Wallet Balance</p>
          <p className="text-xl font-bold text-foreground">
            ₹{walletStats.totalWalletBalance.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Across {users.length} users
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-success/20 to-success/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-success/10">
            <ArrowDownLeft className="w-4 h-4 text-success" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
          <p className="text-xl font-bold text-foreground">
            ₹{walletStats.totalCredits.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Money In
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-destructive/20 to-destructive/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/10">
            <ArrowUpRight className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
          <p className="text-xl font-bold text-foreground">
            ₹{walletStats.totalDebits.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Money Out
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl p-4 relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-accent/10">
            <Target className="w-4 h-4 text-accent" />
          </div>
          <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
          <p className="text-xl font-bold text-foreground">
            {transactions.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {txTypes.length} types
          </p>
        </motion.div>
      </div>

      {/* Money Flow Chart */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-primary" />
            Money Flow (Credits vs Debits)
          </h3>
          <div className="flex gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              Credits
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive"></span>
              Debits
            </span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyFlow}>
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
                width={50}
                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number, name: string) => [
                  `₹${value.toLocaleString()}`,
                  name === 'credits' ? 'Credits' : 'Debits',
                ]}
              />
              <Line type="monotone" dataKey="credits" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="debits" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction Type Distribution + Type Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            Transaction Types
          </h3>
          {txTypeDistribution.length > 0 ? (
            <>
              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={txTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {txTypeDistribution.map((_, index) => (
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
              <div className="grid grid-cols-2 gap-2 mt-2">
                {txTypeDistribution.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.name}: <span className="font-medium text-foreground">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No transactions yet</p>
            </div>
          )}
        </div>

        {/* Type Breakdown Cards */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Type Breakdown
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {Object.entries(walletStats.byType)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([type, data]) => {
                const meta = TRANSACTION_TYPE_LABELS[type] || { label: type, color: 'text-muted-foreground', icon: <CreditCard className="w-3.5 h-3.5" /> };
                return (
                  <div key={type} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <div className={`${meta.color}`}>{meta.icon}</div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        <p className="text-[10px] text-muted-foreground">{data.count} transactions</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${data.total >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {data.total >= 0 ? '+' : ''}₹{Math.abs(data.total).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            {Object.keys(walletStats.byType).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No transaction data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All Wallet Transactions List */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            All User Transactions
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={txFilter}
              onChange={(e) => setTxFilter(e.target.value)}
              className="text-xs bg-muted border-none rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Types</option>
              {txTypes.map(type => (
                <option key={type} value={type}>
                  {TRANSACTION_TYPE_LABELS[type]?.label || type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => {
              const user = userMap[tx.user_id];
              const meta = TRANSACTION_TYPE_LABELS[tx.type] || { label: tx.type, color: 'text-muted-foreground', icon: <CreditCard className="w-3.5 h-3.5" /> };
              const isCredit = tx.amount > 0;

              return (
                <div key={tx.id} className="flex items-center gap-3 bg-muted/30 hover:bg-muted/50 rounded-xl p-3 transition-colors">
                  <div className={`p-2 rounded-full ${isCredit ? 'bg-success/10' : 'bg-destructive/10'}`}>
                    <div className={meta.color}>{meta.icon}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user?.name || 'Unknown User'}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isCredit ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      }`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {tx.description || meta.label} • {user?.email || ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className={`text-sm font-bold whitespace-nowrap ${isCredit ? 'text-success' : 'text-destructive'}`}>
                    {isCredit ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString()}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No transactions found</p>
              <p className="text-xs mt-1">Transactions will appear here as users interact</p>
            </div>
          )}
        </div>

        {filteredTransactions.length >= 50 && (
          <p className="text-center text-[10px] text-muted-foreground mt-3">
            Showing latest 50 transactions
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(AdminAnalytics);
