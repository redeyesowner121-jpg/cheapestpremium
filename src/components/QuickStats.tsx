import React from 'react';
import { motion } from 'framer-motion';
import { 
  Gift, 
  Users, 
  TrendingUp, 
  Award,
  Wallet,
  ShoppingBag,
  Crown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BlueTick from './BlueTick';
import { RankBadgeInline } from './RankBadge';
import { getUserRank, getNextRank, getProgressToNextRank } from '@/lib/ranks';
import { Progress } from '@/components/ui/progress';

const QuickStats: React.FC = () => {
  const { profile } = useAuth();
  const rankBalance = profile?.rank_balance || 0;
  const rank = getUserRank(rankBalance);
  const nextRank = getNextRank(rankBalance);
  const { progress, remaining } = getProgressToNextRank(rankBalance);

  const stats = [
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Balance',
      value: `₹${profile?.wallet_balance?.toFixed(2) || '0.00'}`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Total Deposit',
      value: `₹${profile?.total_deposit?.toFixed(2) || '0.00'}`,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      label: 'Orders',
      value: profile?.total_orders || 0,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: <Crown className="w-5 h-5" />,
      label: 'Rank',
      value: <RankBadgeInline rankBalance={rankBalance} size="sm" />,
      color: rank.color,
      bgColor: rank.bgColor,
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
        {profile?.has_blue_check && (
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

      {/* Rank Progress */}
      {nextRank && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 gradient-primary rounded-xl">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">
                Next: {nextRank.icon} {nextRank.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Deposit ₹{remaining.toLocaleString()} more to upgrade
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-bold text-primary">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
          </div>
        </motion.div>
      )}

      {/* Blue Tick Progress */}
      {!profile?.has_blue_check && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Award className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">Get Blue Tick!</p>
              <p className="text-xs text-muted-foreground">
                Deposit ₹1000 total to get free Blue Tick
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-bold text-blue-500">
                {Math.min(100, ((profile?.total_deposit || 0) / 1000) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ 
                width: `${Math.min(100, ((profile?.total_deposit || 0) / 1000) * 100)}%` 
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
