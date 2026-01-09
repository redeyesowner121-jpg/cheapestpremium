import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { RANK_TIERS, getUserRank, getNextRank, getProgressToNextRank, getDecayAmount, getNextDecayDate } from '@/lib/ranks';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TrendingDown, Check, Crown, Sparkles } from 'lucide-react';

interface RankInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rankBalance: number;
}

export function RankInfoModal({ open, onOpenChange, rankBalance }: RankInfoModalProps) {
  const currentRank = getUserRank(rankBalance);
  const nextRank = getNextRank(rankBalance);
  const { progress, remaining } = getProgressToNextRank(rankBalance);
  const decayAmount = getDecayAmount(rankBalance);
  const nextDecayDate = getNextDecayDate();

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
              {RANK_TIERS.map((tier, index) => {
                const isCurrentRank = tier.name === currentRank.name;
                const isUnlocked = rankBalance >= tier.minBalance;
                
                // Calculate discount description
                let discountText = '';
                if (tier.titanBonus) {
                  discountText = 'Reseller Price - (Reseller Discount × 20%)';
                } else if (tier.usesResellerPrice) {
                  discountText = 'Reseller Price পাবেন';
                } else if (tier.discount > 0) {
                  discountText = `${tier.discount}% ছাড়`;
                } else {
                  discountText = 'কোন ছাড় নেই';
                }

                return (
                  <div
                    key={tier.name}
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
                        <p className={cn(
                          'text-sm font-bold',
                          tier.titanBonus ? 'text-indigo-600' : 
                          tier.usesResellerPrice ? 'text-blue-500' : 
                          tier.discount > 0 ? 'text-green-600' : 'text-muted-foreground'
                        )}>
                          {tier.titanBonus ? '⚡ Max Discount' : 
                           tier.usesResellerPrice ? '💎 RP' : 
                           tier.discount > 0 ? `${tier.discount}%` : '0%'}
                        </p>
                        <p className="text-[10px] text-muted-foreground max-w-[100px] truncate">
                          {discountText}
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
            <p><strong>⚡ Titan:</strong> রিসেলার দাম + রিসেলার ডিসকাউন্টের ২০% অতিরিক্ত ছাড়</p>
            <p className="text-[10px] italic">
              উদাহরণ: ১০০ টাকার প্রোডাক্টে রিসেলার ১০ টাকা ছাড় পেলে, Titan পাবে ১০ + (১০×২০%) = ১২ টাকা ছাড়
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
