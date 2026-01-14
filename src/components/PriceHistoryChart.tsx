import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface PriceHistoryEntry {
  id: string;
  product_id: string | null;
  variation_id: string | null;
  price: number;
  reseller_price: number | null;
  recorded_at: string;
}

interface PriceHistoryChartProps {
  productId?: string;
  variationId?: string;
  variationName?: string;
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ 
  productId, 
  variationId,
  variationName 
}) => {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPriceHistory();
  }, [productId, variationId]);

  const loadPriceHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('price_history')
        .select('*')
        .order('recorded_at', { ascending: true })
        .limit(50);

      if (variationId) {
        query = query.eq('variation_id', variationId);
      } else if (productId) {
        query = query.eq('product_id', productId).is('variation_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading price history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-muted/50 rounded-xl p-4 animate-pulse">
        <div className="h-40 bg-muted rounded-lg"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-muted/50 rounded-xl p-4 text-center">
        <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No price history available yet</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = history.map(h => ({
    date: format(new Date(h.recorded_at), 'MMM dd'),
    fullDate: format(new Date(h.recorded_at), 'MMM dd, yyyy HH:mm'),
    price: Number(h.price),
    resellerPrice: h.reseller_price ? Number(h.reseller_price) : null,
  }));

  // Calculate price trend
  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const priceChange = lastPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? ((priceChange / firstPrice) * 100).toFixed(1) : 0;

  const TrendIcon = priceChange > 0 ? TrendingUp : priceChange < 0 ? TrendingDown : Minus;
  const trendColor = priceChange > 0 ? 'text-red-500' : priceChange < 0 ? 'text-green-500' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-muted/50 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            📈 Price History
            {variationName && (
              <span className="text-xs text-muted-foreground">({variationName})</span>
            )}
          </h4>
          <p className="text-xs text-muted-foreground">Track price changes over time</p>
        </div>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {priceChange > 0 ? '+' : ''}{priceChangePercent}%
          </span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
              formatter={(value: number, name: string) => [
                `₹${value}`, 
                name === 'price' ? 'Price' : 'Reseller Price'
              ]}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => value === 'price' ? 'Price' : 'Reseller Price'}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
            />
            {chartData.some(d => d.resellerPrice !== null) && (
              <Line 
                type="monotone" 
                dataKey="resellerPrice" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price summary */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
        <span>First: ₹{firstPrice}</span>
        <span>Current: ₹{lastPrice}</span>
        <span className={trendColor}>
          Change: {priceChange > 0 ? '+' : ''}₹{priceChange.toFixed(2)}
        </span>
      </div>
    </motion.div>
  );
};

export default PriceHistoryChart;
