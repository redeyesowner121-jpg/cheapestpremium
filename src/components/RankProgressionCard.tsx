import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Award, ChevronRight, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  getUserRank, 
  getNextRank, 
  getProgressToNextRank, 
  getDecayAmount, 
  getNextDecayDate,
  fetchRanks,
  getRanksSync,
  RankTier 
} from '@/lib/ranks';
import { RankInfoModal } from './RankInfoModal';

interface RankProgressionCardProps {
  rankBalance: number;
  className?: string;
  compact?: boolean;
}

export function RankProgressionCard({ 
  rankBalance, 
  className,
  compact = false 
}: RankProgressionCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [ranks, setRanks] = useState<RankTier[]>(getRanksSync());
  
  useEffect(() => {
    fetchRanks().then(setRanks);
  }, []);

  const currentRank = getUserRank(rankBalance, ranks);
  const nextRank = getNextRank(rankBalance, ranks);
  const { progress, remaining } = getProgressToNextRank(rankBalance, ranks);
  const decayAmount = getDecayAmount(rankBalance);
  const nextDecayDate = getNextDecayDate();

  // Find previous rank for context
  const currentIndex = ranks.findIndex(r => r.id === currentRank.id);
  const previousRank = currentIndex > 0 ? ranks[currentIndex - 1] : null;

  if (compact) {
    return (
      <>
        <motion.div 
          className={cn(
            "p-4 rounded-2xl bg-card shadow-card cursor-pointer",
            className
          )}
          onClick={() => setShowModal(true)}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentRank.icon}</span>
              <div>
                <p className={cn("font-semibold", currentRank.color)}>{currentRank.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentRank.discount > 0 ? `${currentRank.discount}% discount` : 'No discount'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {nextRank && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress to {nextRank.name}</span>
                <span className="font-medium text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                ₹{remaining.toLocaleString()} more needed
              </p>
            </div>
          )}
        </motion.div>

        <RankInfoModal 
          open={showModal} 
          onOpenChange={setShowModal} 
          rankBalance={rankBalance} 
        />
      </>
    );
  }

  return (
    <>
      <motion.div 
        className={cn(
          "p-5 rounded-2xl bg-card shadow-card",
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Rank Progress</h3>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            View All Ranks
            <Info className="w-3 h-3" />
          </button>
        </div>

        {/* Current Rank Display */}
        <div className={cn(
          "flex items-center gap-4 p-4 rounded-xl mb-4",
          currentRank.bgColor
        )}>
          <span className="text-4xl">{currentRank.icon}</span>
          <div className="flex-1">
            <p className={cn("text-lg font-bold", currentRank.color)}>
              {currentRank.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Rank Balance: ₹{rankBalance.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            {currentRank.discountType === 'percentage' && currentRank.discount > 0 && (
              <div className="bg-success/10 text-success text-sm font-semibold px-3 py-1 rounded-full">
                {currentRank.discount}% OFF
              </div>
            )}
            {currentRank.discountType === 'reseller' && (
              <div className="bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-full">
                Reseller Price
              </div>
            )}
            {currentRank.discountType === 'reseller_extra' && (
              <div className="bg-accent/10 text-accent text-sm font-semibold px-3 py-1 rounded-full">
                RP +{currentRank.resellerDiscountPercent}%
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {nextRank ? (
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{currentRank.icon}</span>
                  <span className={cn("text-sm font-medium", currentRank.color)}>
                    {currentRank.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-medium", nextRank.color)}>
                    {nextRank.name}
                  </span>
                  <span className="text-lg">{nextRank.icon}</span>
                </div>
              </div>
              
              <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white drop-shadow-md">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-success mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">To Next Rank</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  ₹{remaining.toLocaleString()}
                </p>
              </div>
              
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-accent mb-1">
                  <Award className="w-4 h-4" />
                  <span className="text-xs font-medium">Next Discount</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {nextRank.discountType === 'percentage' 
                    ? `${nextRank.discount}%` 
                    : nextRank.discountType === 'reseller' 
                      ? 'RP' 
                      : `RP+${nextRank.resellerDiscountPercent}%`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">🏆</div>
            <p className="font-semibold text-success">Highest Rank Achieved!</p>
            <p className="text-sm text-muted-foreground">
              You're at the top with maximum benefits
            </p>
          </div>
        )}

        {/* Decay Warning */}
        {decayAmount > 0 && (
          <motion.div 
            className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-start gap-2">
              <TrendingDown className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Monthly Decay Warning</p>
                <p className="text-xs text-muted-foreground">
                  Your rank balance will decrease by ₹{decayAmount.toLocaleString()} on{' '}
                  {nextDecayDate.toLocaleDateString('en-IN', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Make deposits to maintain your rank!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      <RankInfoModal 
        open={showModal} 
        onOpenChange={setShowModal} 
        rankBalance={rankBalance} 
      />
    </>
  );
}

export default RankProgressionCard;
