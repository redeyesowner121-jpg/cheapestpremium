// ===== Product analytics modules: Top Products, Categories, Revenue, Stock Health =====

import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Star, Layers, IndianRupee, Package } from 'lucide-react';
import { COLORS } from './shared';
import type { AnalyticsData } from '../types';

export const ProductModules: React.FC<{ products: AnalyticsData['products']; orders: AnalyticsData['orders'] }> = ({ products, orders }) => {
  const topProducts = useMemo(() => [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 5), [products]);
  const categoryDist = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => { map[p.category] = (map[p.category] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [products]);
  const revByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status === 'completed' || o.status === 'delivered').forEach(o => {
      const product = products.find(p => p.id === o.product_id);
      const cat = product?.category || 'Unknown';
      map[cat] = (map[cat] || 0) + o.total_price;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [orders, products]);
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

  return (
    <>
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
    </>
  );
};

export const _COLORS = COLORS;
