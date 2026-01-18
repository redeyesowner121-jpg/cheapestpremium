import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  IndianRupee, 
  TrendingUp, 
  Calendar, 
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  growthPercent: string;
  todayRevenue: number;
  todayOrders: number;
  avgOrderValue: number;
  conversionRate: string;
  uniqueCustomers: number;
}

interface MetricsGridProps {
  revenueStats: RevenueStats;
}

const MetricsGrid: React.FC<MetricsGridProps> = ({ revenueStats }) => {
  const isGrowthPositive = parseFloat(revenueStats.growthPercent) >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4 relative overflow-hidden"
      >
        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-primary/10">
          <IndianRupee className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
        <p className="text-xl font-bold text-foreground">
          ₹{revenueStats.totalRevenue.toLocaleString()}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Avg: ₹{revenueStats.avgOrderValue.toFixed(0)}/order
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-br from-success/20 to-success/5 rounded-2xl p-4 relative overflow-hidden"
      >
        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-success/10">
          <TrendingUp className="w-4 h-4 text-success" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">This Month</p>
        <p className="text-xl font-bold text-foreground">
          ₹{revenueStats.monthlyRevenue.toLocaleString()}
        </p>
        <div className={`flex items-center gap-1 mt-1 ${isGrowthPositive ? 'text-success' : 'text-destructive'}`}>
          {isGrowthPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          <span className="text-[10px] font-medium">{revenueStats.growthPercent}% vs last month</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl p-4 relative overflow-hidden"
      >
        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-accent/10">
          <Calendar className="w-4 h-4 text-accent" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">Today</p>
        <p className="text-xl font-bold text-foreground">
          ₹{revenueStats.todayRevenue.toLocaleString()}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {revenueStats.todayOrders} orders today
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-2xl p-4 relative overflow-hidden"
      >
        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-secondary/10">
          <Target className="w-4 h-4 text-secondary-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">Conversion</p>
        <p className="text-xl font-bold text-foreground">
          {revenueStats.conversionRate}%
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {revenueStats.uniqueCustomers} customers
        </p>
      </motion.div>
    </div>
  );
};

export default memo(MetricsGrid);