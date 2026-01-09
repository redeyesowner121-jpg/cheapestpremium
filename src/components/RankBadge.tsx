import { useState } from 'react';
import { getUserRank, getNextRank, getProgressToNextRank, RANK_TIERS } from '@/lib/ranks';
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
  const rank = getUserRank(rankBalance);
  const nextRank = getNextRank(rankBalance);
  const { progress, remaining } = getProgressToNextRank(rankBalance);

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
          {rank.discount > 0 && !rank.usesResellerPrice && (
            <span className="opacity-75">({rank.discount}%)</span>
          )}
          {rank.usesResellerPrice && !rank.titanBonus && (
            <span className="opacity-75 text-[10px]">(RP)</span>
          )}
          {rank.titanBonus && (
            <span className="opacity-75 text-[10px]">(RP+20%)</span>
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
            {rank.discount > 0 && <p>Discount: {rank.discount}%</p>}
            {rank.usesResellerPrice && !rank.titanBonus && <p>Gets: Reseller Price</p>}
            {rank.titanBonus && <p>Gets: Reseller +20% Extra</p>}
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
  const rank = getUserRank(rankBalance);
  
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
