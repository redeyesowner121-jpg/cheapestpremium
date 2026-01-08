export interface RankTier {
  name: string;
  minBalance: number;
  discount: number;
  color: string;
  bgColor: string;
  icon: string;
  usesResellerPrice: boolean;
  titanBonus: boolean;
}

export const RANK_TIERS: RankTier[] = [
  { name: 'Bronze', minBalance: 0, discount: 0, color: 'text-amber-700', bgColor: 'bg-amber-100', icon: '🥉', usesResellerPrice: false, titanBonus: false },
  { name: 'Silver', minBalance: 50, discount: 0.5, color: 'text-slate-500', bgColor: 'bg-slate-100', icon: '🥈', usesResellerPrice: false, titanBonus: false },
  { name: 'Gold', minBalance: 500, discount: 1, color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: '🥇', usesResellerPrice: false, titanBonus: false },
  { name: 'Platinum', minBalance: 2000, discount: 2, color: 'text-cyan-600', bgColor: 'bg-cyan-100', icon: '💠', usesResellerPrice: false, titanBonus: false },
  { name: 'Diamond', minBalance: 5000, discount: 0, color: 'text-blue-500', bgColor: 'bg-blue-100', icon: '💎', usesResellerPrice: true, titanBonus: false },
  { name: 'Crystal', minBalance: 10000, discount: 5, color: 'text-purple-500', bgColor: 'bg-purple-100', icon: '🔮', usesResellerPrice: false, titanBonus: false },
  { name: 'Heroic', minBalance: 25000, discount: 7, color: 'text-red-500', bgColor: 'bg-red-100', icon: '⚔️', usesResellerPrice: false, titanBonus: false },
  { name: 'Master', minBalance: 50000, discount: 8, color: 'text-orange-500', bgColor: 'bg-orange-100', icon: '👑', usesResellerPrice: false, titanBonus: false },
  { name: 'Grand Master', minBalance: 75000, discount: 9, color: 'text-pink-500', bgColor: 'bg-pink-100', icon: '🏆', usesResellerPrice: false, titanBonus: false },
  { name: 'Titan', minBalance: 100000, discount: 0, color: 'text-indigo-600', bgColor: 'bg-gradient-to-r from-indigo-100 to-purple-100', icon: '⚡', usesResellerPrice: true, titanBonus: true },
];

export function getUserRank(rankBalance: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (rankBalance >= RANK_TIERS[i].minBalance) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

export function getNextRank(rankBalance: number): RankTier | null {
  const current = getUserRank(rankBalance);
  const idx = RANK_TIERS.findIndex(r => r.name === current.name);
  return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

export function getProgressToNextRank(rankBalance: number): { progress: number; remaining: number } {
  const current = getUserRank(rankBalance);
  const next = getNextRank(rankBalance);
  
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

export function calculateFinalPrice(
  basePrice: number,
  resellerPrice: number | null | undefined,
  rank: RankTier,
  isReseller: boolean
): { finalPrice: number; savings: number; discountType: string } {
  
  // 1. Reseller gets reseller price
  if (isReseller && resellerPrice) {
    return { 
      finalPrice: resellerPrice, 
      savings: basePrice - resellerPrice,
      discountType: 'Reseller' 
    };
  }
  
  // 2. Titan rank: Reseller price + 20% extra
  if (rank.titanBonus && resellerPrice) {
    const resellerDiscount = basePrice - resellerPrice;
    const extraDiscount = resellerDiscount * 0.2;
    const finalPrice = resellerPrice - extraDiscount;
    return { 
      finalPrice: Math.round(finalPrice * 100) / 100, 
      savings: Math.round((basePrice - finalPrice) * 100) / 100,
      discountType: 'Titan (Reseller +20%)' 
    };
  }
  
  // 3. Diamond rank: Same as reseller price
  if (rank.usesResellerPrice && resellerPrice) {
    return { 
      finalPrice: resellerPrice, 
      savings: basePrice - resellerPrice,
      discountType: 'Diamond (Reseller Price)' 
    };
  }
  
  // 4. Normal percentage discount
  const discountAmount = basePrice * (rank.discount / 100);
  return { 
    finalPrice: Math.round((basePrice - discountAmount) * 100) / 100, 
    savings: Math.round(discountAmount * 100) / 100,
    discountType: rank.discount > 0 ? `${rank.name} (${rank.discount}% off)` : 'No discount'
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
