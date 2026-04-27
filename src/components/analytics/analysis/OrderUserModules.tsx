// ===== Order/User analytics modules: Status, Growth, Discounts, Hours, Engagement, Depositors =====

import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingBag, Users, Percent, Clock, BarChart3, Award } from 'lucide-react';
import { COLORS } from './shared';
import type { AnalyticsData } from '../types';

interface Props {
  orders: AnalyticsData['orders'];
  users: AnalyticsData['users'];
  selectedPeriod: string;
}

export const OrderUserModules: React.FC<Props> = ({ orders, users, selectedPeriod }) => {
  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const userGrowth = useMemo(() => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const count = users.filter(u => u.created_at?.split('T')[0] === dateStr).length;
      return { date: new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), users: count };
    });
  }, [users, selectedPeriod]);

  const totalDiscounts = useMemo(() => orders.reduce((s, o) => s + (o.discount_applied || 0), 0), [orders]);
  const ordersWithDiscount = useMemo(() => orders.filter(o => (o.discount_applied || 0) > 0).length, [orders]);

  const peakHours = useMemo(() => {
    const hours: number[] = new Array(24).fill(0);
    orders.forEach(o => { hours[new Date(o.created_at).getHours()]++; });
    return hours.map((count, hour) => ({ hour: `${hour}:00`, orders: count }));
  }, [orders]);

  const avgOrderPerUser = useMemo(() => users.length > 0 ? (orders.length / users.length).toFixed(1) : '0', [orders, users]);
  const topDepositors = useMemo(() => [...users].sort((a, b) => (b.total_deposit || 0) - (a.total_deposit || 0)).slice(0, 5), [users]);

  return (
    <>
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <ShoppingBag className="w-4 h-4 text-accent" /> Order Status
        </h3>
        {orderStatusDist.length > 0 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={orderStatusDist} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2} dataKey="value">
                  {orderStatusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-1">
              {orderStatusDist.map((item, i) => (
                <span key={item.name} className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{item.name}: {item.value}
                </span>
              ))}
            </div>
          </div>
        ) : <p className="text-xs text-muted-foreground text-center py-4">No orders</p>}
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-primary" /> User Growth
        </h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userGrowth}>
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={25} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <Percent className="w-4 h-4 text-accent" /> Discount Usage
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">₹{totalDiscounts.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Discounts</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">{ordersWithDiscount}</p>
            <p className="text-[10px] text-muted-foreground">Orders w/ Discount</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-primary" /> Peak Order Hours
        </h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHours}>
              <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 7 }} interval={3} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={20} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              <Bar dataKey="orders" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4 text-success" /> User Engagement
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">{avgOrderPerUser}</p>
            <p className="text-[10px] text-muted-foreground">Avg Orders/User</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">
              {users.length > 0 ? `₹${Math.round(users.reduce((s, u) => s + (u.total_deposit || 0), 0) / users.length)}` : '₹0'}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg Deposit/User</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <Award className="w-4 h-4 text-accent" /> Top Depositors
        </h3>
        <div className="space-y-2">
          {topDepositors.filter(u => (u.total_deposit || 0) > 0).length > 0 ? topDepositors.filter(u => (u.total_deposit || 0) > 0).map((u, i) => (
            <div key={u.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
              <p className="text-xs text-foreground flex-1 truncate">{u.name || u.email}</p>
              <span className="text-xs font-bold text-success">₹{(u.total_deposit || 0).toLocaleString()}</span>
            </div>
          )) : <p className="text-xs text-muted-foreground text-center py-4">No deposits yet</p>}
        </div>
      </div>
    </>
  );
};
