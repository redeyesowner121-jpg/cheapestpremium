import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { getUserRank, getNextRank, getProgressToNextRank, getDecayAmount, getNextDecayDate, fetchRanks, RankTier } from '@/lib/ranks';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TrendingDown, Check, Crown, Sparkles } from 'lucide-react';

interface RankInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rankBalance: number;
}

export function RankInfoModal({ open, onOpenChange, rankBalance }: RankInfoModalProps) {
  const [ranks, setRanks] = useState<RankTier[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchRanks().then((data) => {
        setRanks(data);
        setLoading(false);
      });
    }
  }, [open]);

  // Only calculate after ranks are loaded
  const currentRank = ranks.length > 0 ? getUserRank(rankBalance, ranks) : null;
  const nextRank = ranks.length > 0 ? getNextRank(rankBalance, ranks) : null;
  const { progress, remaining } = ranks.length > 0 
    ? getProgressToNextRank(rankBalance, ranks) 
    : { progress: 0, remaining: 0 };
  const decayAmount = getDecayAmount(rankBalance);
  const nextDecayDate = getNextDecayDate();

  // Get discount description
  const getDiscountText = (tier: RankTier) => {
    if (tier.discountType === 'reseller_extra' && tier.resellerDiscountPercent > 0) {
      return `Reseller Price + ${tier.resellerDiscountPercent}% Extra`;
    } else if (tier.discountType === 'reseller') {
      return 'Reseller Price';
    } else if (tier.discount > 0) {
      return `${tier.discount}% Discount`;
    }
    return 'No Discount';
  };

  const getDiscountBadge = (tier: RankTier) => {
    if (tier.discountType === 'reseller_extra') {
      return { text: `RP+${tier.resellerDiscountPercent}%`, color: 'text-indigo-600' };
    } else if (tier.discountType === 'reseller') {
      return { text: '💎 RP', color: 'text-blue-500' };
    } else if (tier.discount > 0) {
      return { text: `${tier.discount}%`, color: 'text-green-600' };
    }
    return { text: '0%', color: 'text-muted-foreground' };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Rank System
          </DialogTitle>
        </DialogHeader>

        {loading || !currentRank ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Rank Card */}
            <div className={cn(
              'p-4 rounded-2xl border-2',
              currentRank.bgColor,
              'border-current'
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentRank.icon}</span>
                  <div>
                    <p className={cn('font-bold text-lg', currentRank.color)}>
                      {currentRank.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your Current Rank
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">₹{rankBalance.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Rank Balance</p>
                </div>
              </div>

              {/* Progress to next rank */}
              {nextRank && (
                <div className="mt-3 pt-3 border-t border-current/20">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>Next: {nextRank.icon} {nextRank.name}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Deposit ₹{remaining.toLocaleString()} more
                  </p>
                </div>
              )}

              {!nextRank && (
                <div className="mt-3 pt-3 border-t border-current/20">
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    You've reached the highest rank! 🎉
                  </p>
                </div>
              )}
            </div>

            {/* Decay Warning */}
            <div className="bg-destructive/10 rounded-xl p-3 flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Monthly Decay System</p>
                <p className="text-xs text-muted-foreground">
                  30% of your rank balance will be deducted on the 1st of each month.
                </p>
                <p className="text-xs font-medium mt-1">
                  Next decay: {format(nextDecayDate, 'dd MMM yyyy')} 
                  {rankBalance > 0 && <span className="text-destructive"> (-₹{decayAmount.toLocaleString()})</span>}
                </p>
              </div>
            </div>

            {/* All Ranks List */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full"></span>
                All Ranks & Benefits
              </h3>
              
              <div className="space-y-2">
                {ranks.map((tier) => {
                  const isCurrentRank = tier.name === currentRank.name;
                  const isUnlocked = rankBalance >= tier.minBalance;
                  const badge = getDiscountBadge(tier);

                  return (
                    <div
                      key={tier.id}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all',
                        isCurrentRank 
                          ? `${tier.bgColor} border-primary shadow-md` 
                          : isUnlocked 
                            ? `${tier.bgColor} border-transparent opacity-80` 
                            : 'bg-muted/30 border-transparent opacity-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{tier.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={cn('font-semibold', tier.color)}>{tier.name}</p>
                              {isCurrentRank && (
                                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                                  Current
                                </span>
                              )}
                              {isUnlocked && !isCurrentRank && (
                                <Check className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              ₹{tier.minBalance.toLocaleString()}+
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-bold', badge.color)}>
                            {badge.text}
                          </p>
                          <p className="text-[10px] text-muted-foreground max-w-[100px] truncate">
                            {getDiscountText(tier)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1.5">
              <p><strong>💎 Diamond:</strong> Get reseller pricing</p>
              <p><strong>⚔️ Heroic+:</strong> Reseller price + extra % discount</p>
              <p><strong>⚡ Titan:</strong> Maximum discount (Reseller + 1% extra)</p>
              <p className="text-[10px] italic pt-1 border-t border-border">
                Resellers always get reseller pricing. Above Crystal rank, extra discounts apply.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
