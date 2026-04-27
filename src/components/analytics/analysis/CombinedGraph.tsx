// ===== Combined analytics graph (top widget) =====

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { USER_VALUE, DEPOSIT_VALUE, ORDER_VALUE, PROFIT_VALUE, VISIT_VALUE } from './shared';
import type { AnalyticsData } from '../types';

interface Props {
  orders: AnalyticsData['orders'];
  users: AnalyticsData['users'];
  transactions: AnalyticsData['transactions'];
  selectedPeriod: string;
  searchLogs: { created_at: string }[];
  siteVisits: { created_at: string; subdomain: string | null }[];
}

const CustomCombinedTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-primary">👤 Users: {d._users} (value: {d.userJoined})</p>
      <p className="text-success">💰 Deposits: ₹{d._depositAmount?.toLocaleString()} (value: {d.deposit})</p>
      <p className="text-accent">📦 Orders: {d._orders} (value: {d.order})</p>
      <p className="text-secondary-foreground">🎁 Profit Given: ₹{d._profit} (value: {d.profitGiven.toFixed(1)})</p>
      <p style={{ color: '#8b5cf6' }}>🌐 Visits: {d._visits} (value: {d.visits.toFixed(1)})</p>
    </div>
  );
};

export const CombinedGraph: React.FC<Props> = ({ orders, users, transactions, selectedPeriod, searchLogs, siteVisits }) => {
  const combinedData = useMemo(() => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];

      const newUsers = users.filter(u => u.created_at?.split('T')[0] === dateStr).length;
      const dayDeposits = transactions.filter(t => t.created_at?.split('T')[0] === dateStr && t.type === 'deposit' && t.status === 'completed');
      const depositAmount = dayDeposits.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
      const dayOrders = orders.filter(o => o.created_at?.split('T')[0] === dateStr);
      const orderCount = dayOrders.length;
      const profitGiven = dayOrders.reduce((s, o) => s + (o.discount_applied || 0), 0);
      const searchVisits = searchLogs.filter(s => s.created_at?.split('T')[0] === dateStr).length;
      const subdomainVisits = siteVisits.filter(s => s.created_at?.split('T')[0] === dateStr).length;
      const visitCount = searchVisits + subdomainVisits;

      return {
        date: new Date(dateStr).toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: days > 7 ? 'short' : undefined }),
        userJoined: newUsers * USER_VALUE,
        deposit: depositAmount * DEPOSIT_VALUE,
        order: orderCount * ORDER_VALUE,
        profitGiven: profitGiven * PROFIT_VALUE,
        visits: visitCount * VISIT_VALUE,
        _users: newUsers,
        _depositAmount: depositAmount,
        _orders: orderCount,
        _profit: profitGiven,
        _visits: visitCount,
      };
    });
  }, [orders, users, transactions, searchLogs, siteVisits, selectedPeriod]);

  const totals = useMemo(() => combinedData.reduce((acc, d) => ({
    users: acc.users + d._users,
    deposits: acc.deposits + d._depositAmount,
    orders: acc.orders + d._orders,
    profit: acc.profit + d._profit,
    visits: acc.visits + d._visits,
  }), { users: 0, deposits: 0, orders: 0, profit: 0, visits: 0 }), [combinedData]);

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" /> Combined Analytics
        </h3>
        <div className="flex gap-2 text-[10px] flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Users (×{USER_VALUE})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Deposits (×{DEPOSIT_VALUE})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> Orders (×{ORDER_VALUE})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary" /> Profit (×{PROFIT_VALUE})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8b5cf6' }} /> Visits (×{VISIT_VALUE})</span>
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={combinedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={{ stroke: 'hsl(var(--border))' }} width={40} />
            <Tooltip content={<CustomCombinedTooltip />} />
            <Line type="monotone" dataKey="userJoined" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="deposit" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="order" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="profitGiven" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="visits" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-5 gap-2 mt-3 pt-3 border-t border-border">
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{totals.users}</p>
          <p className="text-[10px] text-muted-foreground">New Users</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-success">₹{totals.deposits.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Deposits</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-accent">{totals.orders}</p>
          <p className="text-[10px] text-muted-foreground">Orders</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-secondary-foreground">₹{totals.profit.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Profit Given</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: '#8b5cf6' }}>{totals.visits}</p>
          <p className="text-[10px] text-muted-foreground">Visits</p>
        </div>
      </div>
    </div>
  );
};
