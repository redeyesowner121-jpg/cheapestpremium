// Rank calculations - user rank, progress, and pricing

import { RankTier } from './types';
import { getRanksSync } from './fetcher';

export function getUserRank(rankBalance: number, ranks?: RankTier[]): RankTier {
  const rankList = ranks || getRanksSync();
  for (let i = rankList.length - 1; i >= 0; i--) {
    if (rankBalance >= rankList[i].minBalance) {
      return rankList[i];
    }
  }
  return rankList[0];
}

export function getNextRank(rankBalance: number, ranks?: RankTier[]): RankTier | null {
  const rankList = ranks || getRanksSync();
  const current = getUserRank(rankBalance, rankList);
  const idx = rankList.findIndex(r => r.name === current.name);
  return idx < rankList.length - 1 ? rankList[idx + 1] : null;
}

export function getProgressToNextRank(rankBalance: number, ranks?: RankTier[]): { progress: number; remaining: number } {
  const rankList = ranks || getRanksSync();
  const current = getUserRank(rankBalance, rankList);
  const next = getNextRank(rankBalance, rankList);
  
  if (!next) {
    return { progress: 100, remaining: 0 };
  }
  
  const currentMin = current.minBalance;
  const nextMin = next.minBalance;
  const range = nextMin - currentMin;
  const progressAmount = rankBalance - currentMin;
  
  return {
    progress: Math.min(100, (progressAmount / range) * 100),
    remaining: nextMin - rankBalance
  };
}

// Find Crystal rank to determine threshold
function getCrystalRankThreshold(ranks: RankTier[]): number {
  const crystalRank = ranks.find(r => r.name === 'Crystal');
  return crystalRank?.minBalance || 10000;
}

export function calculateFinalPrice(
  basePrice: number,
  resellerPrice: number | null | undefined,
  rank: RankTier,
  isReseller: boolean,
  ranks?: RankTier[]
): { finalPrice: number; savings: number; discountType: string } {
  const rankList = ranks || getRanksSync();
  const crystalThreshold = getCrystalRankThreshold(rankList);
  const userRankBalance = rank.minBalance;
  
  // 1. If user is a reseller
  if (isReseller) {
    // If reseller is below Crystal rank, they get reseller price only
    if (userRankBalance < crystalThreshold) {
      if (resellerPrice) {
        return { 
          finalPrice: resellerPrice, 
          savings: basePrice - resellerPrice,
          discountType: 'Reseller' 
        };
      }
    } else {
      // If reseller is at or above Crystal, they get reseller + extra based on rank
      if (resellerPrice && rank.discountType === 'reseller_extra') {
        const extraDiscountPercent = rank.resellerDiscountPercent;
        const extraDiscount = basePrice * (extraDiscountPercent / 100);
        const finalPrice = resellerPrice - extraDiscount;
        return { 
          finalPrice: Math.round(Math.max(0, finalPrice) * 100) / 100, 
          savings: Math.round((basePrice - finalPrice) * 100) / 100,
          discountType: `Reseller + ${extraDiscountPercent}% extra` 
        };
      } else if (resellerPrice) {
        return { 
          finalPrice: resellerPrice, 
          savings: basePrice - resellerPrice,
          discountType: 'Reseller' 
        };
      }
    }
  }
  
  // 2. Non-reseller logic based on rank discount type
  switch (rank.discountType) {
    case 'reseller':
      // Diamond rank: Same as reseller price
      if (resellerPrice) {
        return { 
          finalPrice: resellerPrice, 
          savings: basePrice - resellerPrice,
          discountType: `${rank.name} (Reseller Price)` 
        };
      }
      break;
      
    case 'reseller_extra':
      // Heroic, Master, Grand Master, Titan: Reseller price + extra discount
      if (resellerPrice) {
        const extraDiscountPercent = rank.resellerDiscountPercent;
        const extraDiscount = basePrice * (extraDiscountPercent / 100);
        const finalPrice = resellerPrice - extraDiscount;
        return { 
          finalPrice: Math.round(Math.max(0, finalPrice) * 100) / 100, 
          savings: Math.round((basePrice - finalPrice) * 100) / 100,
          discountType: `${rank.name} (Reseller + ${extraDiscountPercent}%)` 
        };
      }
      break;
      
    case 'percentage':
    default:
      // Normal percentage discount
      if (rank.discount > 0) {
        const discountAmount = basePrice * (rank.discount / 100);
        return { 
          finalPrice: Math.round((basePrice - discountAmount) * 100) / 100, 
          savings: Math.round(discountAmount * 100) / 100,
          discountType: `${rank.name} (${rank.discount}% off)` 
        };
      }
  }
  
  // No discount
  return { 
    finalPrice: basePrice, 
    savings: 0,
    discountType: 'No discount'
  };
}

export function getDecayAmount(rankBalance: number): number {
  return Math.round(rankBalance * 0.30 * 100) / 100;
}

export function getNextDecayDate(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
}
