import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  TrendingUp, 
  Award,
  Wallet,
  ShoppingBag,
  Crown,
  ChevronRight,
  Sparkles,
  Flame
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BlueTick from './BlueTick';
import { RankBadgeInline } from './RankBadge';
import { getUserRank, getNextRank, getProgressToNextRank, fetchRanks, getRanksSync, RankTier } from '@/lib/ranks';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import SavingsHistoryModal from './SavingsHistoryModal';

const QuickStats: React.FC = React.memo(() => {
  const { profile, user } = useAuth();
  const [fetchedRanks, setFetchedRanks] = useState<RankTier[]>(getRanksSync());
  
  useEffect(() => {
    fetchRanks().then(setFetchedRanks);
  }, []);
  const [totalSavings, setTotalSavings] = useState<number | null>(null);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const walletBalance = Number(profile?.wallet_balance ?? 0);
  const totalDeposit = Number(profile?.total_deposit ?? 0);
  const totalOrders = Number(profile?.total_orders ?? 0);
  const rankBalance = Number(profile?.rank_balance ?? 0);
  const blueTickProgress = Math.min(100, (totalDeposit / 1000) * 100);

  const fetchSavings = async () => {
    if (!user || savingsLoading || totalSavings !== null) return;
    setSavingsLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('total_price, product_id, quantity')
        .eq('user_id', user.id);

      if (orders) {
        const productIds = [...new Set(orders.map(o => o.product_id).filter(Boolean))];
        const { data: products } = await supabase
          .from('products')
          .select('id, original_price, price')
          .in('id', productIds.length > 0 ? productIds : ['none']);

        const productMap = new Map(products?.map(p => [p.id, p]) || []);

        const sum = orders.reduce((acc, o) => {
          const product = o.product_id ? productMap.get(o.product_id) : null;
          const originalPrice = product?.original_price || product?.price || o.total_price;
          const qty = o.quantity || 1;
          const saving = (originalPrice * qty) - o.total_price;
          return acc + (saving > 0 ? saving : 0);
        }, 0);
        setTotalSavings(sum);
      }
    } catch (error) {
      console.error('Error fetching savings:', error);
    } finally {
      setSavingsLoading(false);
    }
  };

  const handleSavingsClick = () => {
    if (totalSavings === null) fetchSavings();
    setShowSavingsModal(true);
  };

  const rank = getUserRank(rankBalance);
  const nextRank = getNextRank(rankBalance);
  const { progress, remaining } = getProgressToNextRank(rankBalance);

  const stats = [
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Balance',
      value: `₹${walletBalance.toFixed(2)}`,
      gradient: 'gradient-primary',
      shadow: 'shadow-colored-primary',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Deposited',
      value: `₹${totalDeposit.toFixed(0)}`,
      gradient: 'gradient-success',
      shadow: 'shadow-colored-success',
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      label: 'Orders',
      value: totalOrders,
      gradient: 'gradient-warm',
      shadow: 'shadow-colored-accent',
    },
    {
      icon: <Crown className="w-5 h-5" />,
      label: 'Rank',
      value: <RankBadgeInline rankBalance={rankBalance} size="sm" clickable={true} />,
      gradient: 'gradient-cool',
      shadow: 'shadow-colored-primary',
    },
  ];

  return (
    <div className="w-full animate-fade-in">
      {/* Stylish section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 gradient-primary rounded-lg shadow-colored-primary">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-foreground font-display tracking-tight">
              Your Stats
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Dashboard Overview</p>
          </div>
        </div>
        {profile?.has_blue_check && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10">
            <BlueTick size="sm" />
            <span className="text-xs font-bold text-primary">Verified</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative bg-card rounded-2xl p-4 shadow-card overflow-hidden group hover:shadow-card-hover transition-shadow duration-300"
          >
            <div className={`inline-flex p-2.5 rounded-xl ${stat.gradient} ${stat.shadow} mb-2.5`}>
              <div className="text-white">{stat.icon}</div>
            </div>
            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{stat.label}</p>
            <p className="text-xl font-extrabold text-foreground font-display tracking-tight mt-0.5">{stat.value}</p>
            {/* Decorative corner */}
            <div className={`absolute -top-6 -right-6 w-16 h-16 ${stat.gradient} rounded-full opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`} />
          </div>
        ))}
      </div>

      {/* Rank Progress */}
      {nextRank && (
        <div className="mt-4 relative overflow-hidden rounded-2xl p-4 card-gradient-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 gradient-primary rounded-xl shadow-colored-primary">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-foreground text-sm font-display tracking-tight">
                Next: {nextRank.icon} {nextRank.name}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                Deposit <span className="font-bold text-primary">₹{remaining.toLocaleString()}</span> more
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary font-display tracking-tighter">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={progress} className="h-2.5" />
          </div>
        </div>
      )}

      {/* Total Savings */}
      <div
        className="mt-4 relative overflow-hidden gradient-success rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform shadow-colored-success"
        onClick={handleSavingsClick}
      >
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <TrendingUp className="w-5 h-5 text-success-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-success-foreground text-sm font-display tracking-tight">Total Savings 🎉</p>
            <p className="text-[11px] text-success-foreground/75 font-medium">
              {savingsLoading ? 'Calculating...' : 'Tap to see your savings!'}
            </p>
          </div>
          <div className="text-right flex items-center gap-1">
            <p className="text-2xl font-black text-success-foreground font-display tracking-tighter">
              {totalSavings !== null ? `₹${totalSavings.toFixed(0)}` : '—'}
            </p>
            <ChevronRight className="w-4 h-4 text-success-foreground/60" />
          </div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
      </div>

      <SavingsHistoryModal
        open={showSavingsModal}
        onOpenChange={setShowSavingsModal}
        totalSavings={totalSavings || 0}
      />

      {!profile?.has_blue_check && (
        <div className="mt-4 relative overflow-hidden gradient-cool rounded-2xl p-4 shadow-colored-primary">
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-white text-sm font-display tracking-tight">Get Blue Tick!</p>
              <p className="text-[11px] text-white/75 font-medium">
                Deposit ₹1000 total to unlock
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-white font-display tracking-tighter">
                {blueTickProgress.toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-3 h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${blueTickProgress}%` }}
            />
          </div>
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
        </div>
      )}

      {/* Special Offer */}
      {!profile?.has_blue_check && (
        <div className="mt-4 gradient-sunset rounded-2xl p-4 shadow-colored-secondary relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-white/20 rounded-xl animate-float">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-white text-sm font-display tracking-tight">Special Offer! ✨</p>
              <p className="text-[11px] text-white/80 font-medium leading-relaxed">
                Deposit ₹1000 at once → <span className="font-bold">₹100 bonus</span> + Blue Tick!
              </p>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/10 rounded-full" />
        </div>
      )}
    </div>
  );
});

QuickStats.displayName = 'QuickStats';

export default QuickStats;
