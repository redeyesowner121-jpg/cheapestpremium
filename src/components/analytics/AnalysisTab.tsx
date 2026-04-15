import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Users, ShoppingBag, IndianRupee, Gift, Package,
  Star, Award, BarChart3, Clock, Percent, Layers, ArrowUpRight, Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyticsData } from './types';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--destructive))', '#f59e0b', '#8b5cf6', '#ec4899'];

const USER_VALUE = 10;
const DEPOSIT_VALUE = 1;
const ORDER_VALUE = 5;
const PROFIT_VALUE = 0.5;
const VISIT_VALUE = 0.2;

const AnalysisTab: React.FC<AnalyticsData> = ({ orders, products, users, transactions, selectedPeriod = '7d' }) => {
  const [searchLogs, setSearchLogs] = useState<{ created_at: string }[]>([]);

  useEffect(() => {
    const fetchSearchLogs = async () => {
      const { data } = await supabase.from('search_logs').select('created_at').order('created_at', { ascending: true });
      if (data) setSearchLogs(data);
    };
    fetchSearchLogs();
  }, []);

  // Combined graph data
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
      const visitCount = searchLogs.filter(s => s.created_at?.split('T')[0] === dateStr).length;

      return {
        date: new Date(dateStr).toLocaleDateString('en-US', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: days > 7 ? 'short' : undefined }),
        userJoined: newUsers * USER_VALUE,
        deposit: depositAmount * DEPOSIT_VALUE,
        order: orderCount * ORDER_VALUE,
        profitGiven: profitGiven * PROFIT_VALUE,
        visits: visitCount * VISIT_VALUE,
        // Raw counts
        _users: newUsers,
        _depositAmount: depositAmount,
        _orders: orderCount,
        _profit: profitGiven,
        _visits: visitCount,
      };
    });
  }, [orders, users, transactions, searchLogs, selectedPeriod]);

  // Totals for bottom summary
  const totals = useMemo(() => {
    return combinedData.reduce((acc, d) => ({
      users: acc.users + d._users,
      deposits: acc.deposits + d._depositAmount,
      orders: acc.orders + d._orders,
      profit: acc.profit + d._profit,
    }), { users: 0, deposits: 0, orders: 0, profit: 0 });
  }, [combinedData]);

  // --- 10 Additional Analytics Modules ---

  // 1. Top Selling Products
  const topProducts = useMemo(() =>
    [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 5),
  [products]);

  // 2. Category Distribution
  const categoryDist = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => { map[p.category] = (map[p.category] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [products]);

  // 3. Order Status Distribution
  const orderStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // 4. Revenue by Category
  const revByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status === 'completed' || o.status === 'delivered').forEach(o => {
      const product = products.find(p => p.id === o.product_id);
      const cat = product?.category || 'Unknown';
      map[cat] = (map[cat] || 0) + o.total_price;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [orders, products]);

  // 5. User Growth Trend
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

  // 6. Discount/Coupon Usage
  const totalDiscounts = useMemo(() => orders.reduce((s, o) => s + (o.discount_applied || 0), 0), [orders]);
  const ordersWithDiscount = useMemo(() => orders.filter(o => (o.discount_applied || 0) > 0).length, [orders]);

  // 7. Peak Hours
  const peakHours = useMemo(() => {
    const hours: number[] = new Array(24).fill(0);
    orders.forEach(o => { hours[new Date(o.created_at).getHours()]++; });
    return hours.map((count, hour) => ({ hour: `${hour}:00`, orders: count }));
  }, [orders]);

  // 8. Avg Order per User
  const avgOrderPerUser = useMemo(() => {
    return users.length > 0 ? (orders.length / users.length).toFixed(1) : '0';
  }, [orders, users]);

  // 9. Top Depositors
  const topDepositors = useMemo(() => {
    return [...users].sort((a, b) => (b.total_deposit || 0) - (a.total_deposit || 0)).slice(0, 5);
  }, [users]);

  // 10. Stock Health
  const stockHealth = useMemo(() => {
    const outOfStock = products.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 0).length;
    const lowStock = products.filter(p => p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 5).length;
    const healthy = products.length - outOfStock - lowStock;
    return [
      { name: 'Healthy', value: healthy },
      { name: 'Low Stock', value: lowStock },
      { name: 'Out of Stock', value: outOfStock },
    ].filter(d => d.value > 0);
  }, [products]);

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
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Combined Analytics Graph */}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Actual Numbers Summary */}
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
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
        </div>
      </div>

      {/* Module Grid: 10 additional analytics */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 1. Top Products */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-accent" /> Top Selling Products
          </h3>
          <div className="space-y-2">
            {topProducts.length > 0 ? topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                <p className="text-xs font-medium text-foreground flex-1 truncate">{p.name}</p>
                <span className="text-xs text-muted-foreground">{p.sold_count} sold</span>
              </div>
            )) : <p className="text-xs text-muted-foreground text-center py-4">No products yet</p>}
          </div>
        </div>

        {/* 2. Category Distribution */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Layers className="w-4 h-4 text-primary" /> Category Distribution
          </h3>
          {categoryDist.length > 0 ? (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryDist.slice(0, 6)}>
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={30} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground text-center py-4">No data</p>}
        </div>

        {/* 3. Order Status */}
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

        {/* 4. Revenue by Category */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <IndianRupee className="w-4 h-4 text-success" /> Revenue by Category
          </h3>
          <div className="space-y-2">
            {revByCategory.length > 0 ? revByCategory.slice(0, 5).map(c => (
              <div key={c.name} className="flex items-center justify-between bg-muted/40 rounded-lg p-2">
                <span className="text-xs text-foreground">{c.name}</span>
                <span className="text-xs font-bold text-success">₹{c.value.toLocaleString()}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground text-center py-4">No revenue data</p>}
          </div>
        </div>

        {/* 5. User Growth */}
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

        {/* 6. Discount Stats */}
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

        {/* 7. Peak Hours */}
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

        {/* 8. Avg Orders per User */}
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

        {/* 9. Top Depositors */}
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

        {/* 10. Stock Health */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-primary" /> Stock Health
          </h3>
          {stockHealth.length > 0 ? (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stockHealth} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value">
                      <Cell fill="hsl(var(--success))" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="hsl(var(--destructive))" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3">
                {stockHealth.map((item, i) => (
                  <span key={item.name} className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ['hsl(var(--success))', '#f59e0b', 'hsl(var(--destructive))'][i] }} />{item.name}: {item.value}
                  </span>
                ))}
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground text-center py-4">No stock data</p>}
        </div>
      </div>
    </div>
  );
};

export default AnalysisTab;
