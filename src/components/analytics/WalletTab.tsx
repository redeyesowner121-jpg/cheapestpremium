import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Target, IndianRupee,
  Award, CreditCard, ShoppingBag, Gift, ArrowDownRight, Filter,
} from 'lucide-react';
import type { AnalyticsData } from './types';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

const TX_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deposit: { label: 'Deposit', color: 'text-success', icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
  purchase: { label: 'Purchase', color: 'text-destructive', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  bonus: { label: 'Bonus', color: 'text-accent', icon: <Gift className="w-3.5 h-3.5" /> },
  refund: { label: 'Refund', color: 'text-primary', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  admin_credit: { label: 'Admin Credit', color: 'text-success', icon: <CreditCard className="w-3.5 h-3.5" /> },
  admin_debit: { label: 'Admin Debit', color: 'text-destructive', icon: <CreditCard className="w-3.5 h-3.5" /> },
  gift_deduct: { label: 'Gift Deduct', color: 'text-destructive', icon: <Gift className="w-3.5 h-3.5" /> },
  rank_decay: { label: 'Rank Decay', color: 'text-muted-foreground', icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
};

const WalletTab: React.FC<AnalyticsData> = ({ transactions, users, selectedPeriod = '7d' }) => {
  const [txFilter, setTxFilter] = useState('all');

  const walletStats = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'completed');
    const totalCredits = completed.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalDebits = completed.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const byType: Record<string, { count: number; total: number }> = {};
    completed.forEach(t => {
      if (!byType[t.type]) byType[t.type] = { count: 0, total: 0 };
      byType[t.type].count++;
      byType[t.type].total += t.amount;
    });
    const totalWallet = users.reduce((s, u) => s + (u.wallet_balance || 0), 0);
    return { totalCredits, totalDebits, byType, totalWallet };
  }, [transactions, users]);

  const txTypeDistribution = useMemo(() => {
    return Object.entries(walletStats.byType)
      .map(([type, data]) => ({ name: TX_LABELS[type]?.label || type, value: data.count }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [walletStats]);

  const dailyFlow = useMemo(() => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const dayTx = transactions.filter(t => t.created_at?.split('T')[0] === dateStr && t.status === 'completed');
      return {
        date: new Date(dateStr).toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: days > 7 ? 'short' : undefined }),
        credits: dayTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
        debits: dayTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
      };
    });
  }, [transactions, selectedPeriod]);

  const userMap = useMemo(() => {
    const map: Record<string, { name: string; email: string }> = {};
    users.forEach(u => { map[u.id] = { name: u.name || '', email: u.email || '' }; });
    return map;
  }, [users]);

  const txTypes = useMemo(() => Array.from(new Set(transactions.map(t => t.type))), [transactions]);

  const filteredTx = useMemo(() => {
    let list = [...transactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (txFilter !== 'all') list = list.filter(t => t.type === txFilter);
    return list.slice(0, 50);
  }, [transactions, txFilter]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Wallet', value: `₹${walletStats.totalWallet.toLocaleString()}`, icon: Wallet, color: 'from-primary/20 to-primary/5', iconColor: 'text-primary', sub: `${users.length} users` },
          { label: 'Total Credits', value: `₹${walletStats.totalCredits.toLocaleString()}`, icon: ArrowDownLeft, color: 'from-success/20 to-success/5', iconColor: 'text-success', sub: 'Money In' },
          { label: 'Total Debits', value: `₹${walletStats.totalDebits.toLocaleString()}`, icon: ArrowUpRight, color: 'from-destructive/20 to-destructive/5', iconColor: 'text-destructive', sub: 'Money Out' },
          { label: 'Transactions', value: transactions.length, icon: Target, color: 'from-accent/20 to-accent/5', iconColor: 'text-accent', sub: `${txTypes.length} types` },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
            className={`bg-gradient-to-br ${card.color} rounded-2xl p-4 relative overflow-hidden`}>
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-background/30">
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Money Flow Chart */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <IndianRupee className="w-4 h-4 text-primary" /> Credits vs Debits
          </h3>
          <div className="flex gap-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Credits</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Debits</span>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyFlow}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={{ stroke: 'hsl(var(--border))' }} width={50} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} formatter={(value: number, name: string) => [`₹${value.toLocaleString()}`, name === 'credits' ? 'Credits' : 'Debits']} />
              <Line type="monotone" dataKey="credits" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="debits" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie + Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Award className="w-4 h-4 text-accent" /> Transaction Types
          </h3>
          {txTypeDistribution.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={txTypeDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                      {txTypeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {txTypeDistribution.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] text-muted-foreground">{item.name}: <span className="font-medium text-foreground">{item.value}</span></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-muted-foreground">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No transactions yet</p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-primary" /> Type Breakdown
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(walletStats.byType).sort((a, b) => b[1].count - a[1].count).map(([type, data]) => {
              const meta = TX_LABELS[type] || { label: type, color: 'text-muted-foreground', icon: <CreditCard className="w-3.5 h-3.5" /> };
              return (
                <div key={type} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className={meta.color}>{meta.icon}</div>
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
              <div className="text-center text-muted-foreground py-8"><p className="text-sm">No transaction data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-primary" /> All Transactions
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <select value={txFilter} onChange={e => setTxFilter(e.target.value)}
              className="text-xs bg-muted border-none rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Types</option>
              {txTypes.map(t => <option key={t} value={t}>{TX_LABELS[t]?.label || t}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredTx.length > 0 ? filteredTx.map(tx => {
            const user = userMap[tx.user_id];
            const meta = TX_LABELS[tx.type] || { label: tx.type, color: 'text-muted-foreground', icon: <CreditCard className="w-3.5 h-3.5" /> };
            const isCredit = tx.amount > 0;
            return (
              <div key={tx.id} className="flex items-center gap-3 bg-muted/30 hover:bg-muted/50 rounded-xl p-3 transition-colors">
                <div className={`p-2 rounded-full ${isCredit ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  <div className={meta.color}>{meta.icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{user?.name || 'Unknown'}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isCredit ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{meta.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{tx.description || meta.label} • {user?.email || ''}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <p className={`text-sm font-bold whitespace-nowrap ${isCredit ? 'text-success' : 'text-destructive'}`}>{isCredit ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString()}</p>
              </div>
            );
          }) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No transactions found</p>
            </div>
          )}
        </div>
        {filteredTx.length >= 50 && <p className="text-center text-[10px] text-muted-foreground mt-2">Showing latest 50</p>}
      </div>
    </div>
  );
};

export default WalletTab;
