import React, { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface Order {
  id: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
}

interface User {
  id: string;
  total_deposit?: number;
  created_at?: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

interface CompoundChartProps {
  orders: Order[];
  users: User[];
  transactions: Transaction[];
  selectedPeriod: '7d' | '30d' | 'all';
}

const USER_VALUE = 10; // 1 new user = ₹10 in graph
const PRODUCT_VALUE = 30; // 1 product sold = ₹30 in graph

const CompoundChart: React.FC<CompoundChartProps> = ({ 
  orders, 
  users, 
  transactions,
  selectedPeriod 
}) => {
  const chartData = useMemo(() => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const periodDays = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return date.toISOString().split('T')[0];
    });

    return periodDays.map(date => {
      // Deposits for this day
      const dayDeposits = transactions.filter(t => 
        t.created_at?.split('T')[0] === date && 
        t.type === 'deposit' && 
        t.status === 'completed'
      );
      const depositAmount = dayDeposits.reduce((sum, t) => sum + (t.amount || 0), 0);

      // Sales (completed orders) for this day
      const dayOrders = orders.filter(o => 
        o.created_at?.split('T')[0] === date && 
        (o.status === 'completed' || o.status === 'delivered')
      );
      const salesAmount = dayOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

      // New users for this day (1 user = ₹10)
      const newUsers = users.filter(u => 
        u.created_at?.split('T')[0] === date
      );
      const userGrowthValue = newUsers.length * USER_VALUE;

      // Products sold (1 product = ₹30)
      const productsSold = dayOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const productSaleValue = productsSold * PRODUCT_VALUE;

      return {
        date: new Date(date).toLocaleDateString('en-US', { 
          weekday: days <= 7 ? 'short' : undefined,
          day: 'numeric',
          month: days > 7 ? 'short' : undefined
        }),
        fullDate: date,
        deposits: depositAmount,
        sales: salesAmount,
        userGrowth: userGrowthValue,
        productSales: productSaleValue,
        // Raw counts for tooltip
        newUsersCount: newUsers.length,
        productsSoldCount: productsSold,
      };
    });
  }, [orders, users, transactions, selectedPeriod]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-success">
              💰 Deposits: ₹{data.deposits.toLocaleString()}
            </p>
            <p className="text-primary">
              📈 Sales: ₹{data.sales.toLocaleString()}
            </p>
            <p className="text-accent">
              👤 New Users: {data.newUsersCount} (₹{data.userGrowth} value)
            </p>
            <p className="text-secondary-foreground">
              📦 Products: {data.productsSoldCount} (₹{data.productSales} value)
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Combined Analytics
        </h3>
        <div className="flex gap-2 text-[10px] flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            Deposits
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Sales
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            Users (₹{USER_VALUE}/user)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            Products (₹{PRODUCT_VALUE}/unit)
          </span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
              tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="deposits"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              dot={false}
              name="Deposits"
            />
            <Line
              type="monotone"
              dataKey="sales"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="Sales"
            />
            <Line
              type="monotone"
              dataKey="userGrowth"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={false}
              name="User Growth"
            />
            <Line
              type="monotone"
              dataKey="productSales"
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              dot={false}
              name="Product Sales"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        User Growth: 1 new user = ₹{USER_VALUE} | Product Sales: 1 unit = ₹{PRODUCT_VALUE}
      </p>
    </div>
  );
};

export default memo(CompoundChart);
