import { useState, useEffect } from 'react';
import { getUserRank, getNextRank, getProgressToNextRank, getRanksSync, fetchRanks, RankTier } from '@/lib/ranks';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { RankInfoModal } from './RankInfoModal';

interface RankBadgeProps {
  rankBalance: number;
  showProgress?: boolean;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  clickable?: boolean;
}

export function RankBadge({ 
  rankBalance, 
  showProgress = false, 
  showDetails = false,
  size = 'md',
  className,
  clickable = false
}: RankBadgeProps) {
  const [showModal, setShowModal] = useState(false);
  const [ranks, setRanks] = useState<RankTier[]>(getRanksSync());
  
  useEffect(() => {
    fetchRanks().then(setRanks);
  }, []);

  const rank = getUserRank(rankBalance, ranks);
  const nextRank = getNextRank(rankBalance, ranks);
  const { progress, remaining } = getProgressToNextRank(rankBalance, ranks);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const handleClick = () => {
    if (clickable) {
      setShowModal(true);
    }
  };

  // Get discount display text
  const getDiscountDisplay = (r: RankTier) => {
    if (r.discountType === 'reseller_extra' && r.resellerDiscountPercent > 0) {
      return `(RP+${r.resellerDiscountPercent}%)`;
    } else if (r.discountType === 'reseller') {
      return '(RP)';
    } else if (r.discount > 0) {
      return `(${r.discount}%)`;
    }
    return '';
  };

  return (
    <>
      <div 
        className={cn('inline-flex flex-col', clickable && 'cursor-pointer', className)}
        onClick={handleClick}
      >
        <div className={cn(
          'inline-flex items-center gap-1 rounded-full font-medium transition-transform',
          rank.bgColor,
          rank.color,
          sizeClasses[size],
          clickable && 'hover:scale-105 active:scale-95'
        )}>
          <span className={iconSizes[size]}>{rank.icon}</span>
          <span>{rank.name}</span>
          {getDiscountDisplay(rank) && (
            <span className="opacity-75 text-[10px]">{getDiscountDisplay(rank)}</span>
          )}
        </div>

        {showProgress && nextRank && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Next: {nextRank.icon} {nextRank.name}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              ₹{remaining.toLocaleString()} more to upgrade
            </p>
          </div>
        )}

        {showProgress && !nextRank && (
          <p className="mt-1 text-xs text-green-600 font-medium">
            🏆 Highest rank achieved!
          </p>
        )}

        {showDetails && (
          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            <p>Balance: ₹{rankBalance.toLocaleString()}</p>
            {rank.discountType === 'percentage' && rank.discount > 0 && (
              <p>Discount: {rank.discount}%</p>
            )}
            {rank.discountType === 'reseller' && (
              <p>Gets: Reseller Price</p>
            )}
            {rank.discountType === 'reseller_extra' && (
              <p>Gets: Reseller + {rank.resellerDiscountPercent}% Extra</p>
            )}
          </div>
        )}
      </div>

      {clickable && (
        <RankInfoModal 
          open={showModal} 
          onOpenChange={setShowModal} 
          rankBalance={rankBalance} 
        />
      )}
    </>
  );
}

export function RankBadgeInline({ 
  rankBalance, 
  size = 'sm',
  clickable = false 
}: { 
  rankBalance: number; 
  size?: 'sm' | 'md';
  clickable?: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const [ranks, setRanks] = useState<RankTier[]>(getRanksSync());
  
  useEffect(() => {
    fetchRanks().then(setRanks);
  }, []);

  const rank = getUserRank(rankBalance, ranks);
  
  return (
    <>
      <span 
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full font-medium transition-transform',
          rank.bgColor,
          rank.color,
          size === 'sm' ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5',
          clickable && 'cursor-pointer hover:scale-105 active:scale-95'
        )}
        onClick={() => clickable && setShowModal(true)}
      >
        <span>{rank.icon}</span>
        <span>{rank.name}</span>
      </span>

      {clickable && (
        <RankInfoModal 
          open={showModal} 
          onOpenChange={setShowModal} 
          rankBalance={rankBalance} 
        />
      )}
    </>
  );
}
