import React from 'react';
import { motion } from 'framer-motion';
import { 
  Gift, 
  Users, 
  TrendingUp, 
  Award,
  Wallet,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BlueTick from './BlueTick';

const QuickStats: React.FC = () => {
  const { userData } = useAuth();

  const stats = [
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Balance',
      value: `₹${userData?.walletBalance?.toFixed(2) || '0.00'}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Total Deposit',
      value: `₹${userData?.totalDeposit?.toFixed(2) || '0.00'}`,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      label: 'Orders',
      value: userData?.totalOrders || 0,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Referrals',
      value: '0',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Your Stats</h2>
        {userData?.hasBlueCheck && (
          <div className="flex items-center gap-1 text-sm text-primary">
            <BlueTick size="sm" />
            <span className="font-medium">Verified</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="bg-card rounded-2xl p-4 shadow-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className={`inline-flex p-2 rounded-xl ${stat.bgColor} mb-2`}>
              <div className={stat.color}>{stat.icon}</div>
            </div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Blue Tick Progress */}
      {!userData?.hasBlueCheck && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 gradient-primary rounded-xl">
              <Award className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">Get Blue Tick!</p>
              <p className="text-xs text-muted-foreground">
                Deposit ₹1000 total to get free Blue Tick
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-bold text-primary">
                {Math.min(100, ((userData?.totalDeposit || 0) / 1000) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full gradient-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ 
                width: `${Math.min(100, ((userData?.totalDeposit || 0) / 1000) * 100)}%` 
              }}
              transition={{ delay: 0.5, duration: 0.8 }}
            />
          </div>
        </motion.div>
      )}

      {/* Special Offer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-4 gradient-accent rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Gift className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-bold text-accent-foreground text-sm">Special Offer!</p>
            <p className="text-xs text-accent-foreground/80">
              Deposit ₹1000 at once → Get ₹100 bonus + Blue Tick!
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QuickStats;
