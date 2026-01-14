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
  
  useEffect(() => {
    if (open) {
      fetchRanks().then(setRanks);
    }
  }, [open]);

  const currentRank = getUserRank(rankBalance, ranks);
  const nextRank = getNextRank(rankBalance, ranks);
  const { progress, remaining } = getProgressToNextRank(rankBalance, ranks);
  const decayAmount = getDecayAmount(rankBalance);
  const nextDecayDate = getNextDecayDate();

  // Get discount description
  const getDiscountText = (tier: RankTier) => {
    if (tier.discountType === 'reseller_extra' && tier.resellerDiscountPercent > 0) {
      return `Reseller Price + ${tier.resellerDiscountPercent}% Extra`;
    } else if (tier.discountType === 'reseller') {
      return 'Reseller Price পাবেন';
    } else if (tier.discount > 0) {
      return `${tier.discount}% ছাড়`;
    }
    return 'কোন ছাড় নেই';
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
            র‍্যাঙ্ক সিস্টেম
          </DialogTitle>
        </DialogHeader>

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
                    আপনার বর্তমান র‍্যাঙ্ক
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">₹{rankBalance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">র‍্যাঙ্ক ব্যালেন্স</p>
              </div>
            </div>

            {/* Progress to next rank */}
            {nextRank && (
              <div className="mt-3 pt-3 border-t border-current/20">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>পরবর্তী: {nextRank.icon} {nextRank.name}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{remaining.toLocaleString()} আরও ডিপোজিট করুন
                </p>
              </div>
            )}

            {!nextRank && (
              <div className="mt-3 pt-3 border-t border-current/20">
                <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  সর্বোচ্চ র‍্যাঙ্কে পৌঁছে গেছেন! 🎉
                </p>
              </div>
            )}
          </div>

          {/* Decay Warning */}
          <div className="bg-destructive/10 rounded-xl p-3 flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">মাসিক Decay সিস্টেম</p>
              <p className="text-xs text-muted-foreground">
                প্রতি মাসের ১ তারিখে আপনার র‍্যাঙ্ক ব্যালেন্স থেকে ৩০% কাটা হবে।
              </p>
              <p className="text-xs font-medium mt-1">
                পরবর্তী decay: {format(nextDecayDate, 'dd MMM yyyy')} 
                {rankBalance > 0 && <span className="text-destructive"> (-₹{decayAmount.toLocaleString()})</span>}
              </p>
            </div>
          </div>

          {/* All Ranks List */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full"></span>
              সকল র‍্যাঙ্ক ও বেনিফিট
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
                                বর্তমান
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
            <p><strong>💎 Diamond:</strong> রিসেলারদের সমান দাম পাবেন</p>
            <p><strong>⚔️ Heroic+:</strong> রিসেলার দাম + অতিরিক্ত % ছাড়</p>
            <p><strong>⚡ Titan:</strong> সর্বোচ্চ ছাড় (Reseller + 1% extra)</p>
            <p className="text-[10px] italic pt-1 border-t border-border">
              রিসেলাররা সবসময় রিসেলার প্রাইস পাবেন। Crystal এর উপরে থাকলে অতিরিক্ত ছাড় যোগ হবে।
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
