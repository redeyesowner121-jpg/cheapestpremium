import { supabase } from '@/integrations/supabase/client';

export interface RankTier {
  id: string;
  name: string;
  minBalance: number;
  discount: number;
  color: string;
  bgColor: string;
  icon: string;
  discountType: 'percentage' | 'reseller' | 'reseller_extra';
  resellerDiscountPercent: number;
  sortOrder: number;
}

// Default ranks as fallback
const DEFAULT_RANKS: RankTier[] = [
  { id: '1', name: 'Bronze', minBalance: 0, discount: 0, color: 'text-amber-700', bgColor: 'bg-amber-100', icon: '🥉', discountType: 'percentage', resellerDiscountPercent: 0, sortOrder: 1 },
  { id: '2', name: 'Silver', minBalance: 50, discount: 0.5, color: 'text-slate-500', bgColor: 'bg-slate-100', icon: '🥈', discountType: 'percentage', resellerDiscountPercent: 0, sortOrder: 2 },
  { id: '3', name: 'Gold', minBalance: 500, discount: 1, color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: '🥇', discountType: 'percentage', resellerDiscountPercent: 0, sortOrder: 3 },
  { id: '4', name: 'Platinum', minBalance: 2000, discount: 2, color: 'text-cyan-600', bgColor: 'bg-cyan-100', icon: '💠', discountType: 'percentage', resellerDiscountPercent: 0, sortOrder: 4 },
  { id: '5', name: 'Diamond', minBalance: 5000, discount: 0, color: 'text-blue-500', bgColor: 'bg-blue-100', icon: '💎', discountType: 'reseller', resellerDiscountPercent: 0, sortOrder: 5 },
  { id: '6', name: 'Crystal', minBalance: 10000, discount: 5, color: 'text-purple-500', bgColor: 'bg-purple-100', icon: '🔮', discountType: 'percentage', resellerDiscountPercent: 0, sortOrder: 6 },
  { id: '7', name: 'Heroic', minBalance: 25000, discount: 0, color: 'text-red-500', bgColor: 'bg-red-100', icon: '⚔️', discountType: 'reseller_extra', resellerDiscountPercent: 0.5, sortOrder: 7 },
  { id: '8', name: 'Master', minBalance: 50000, discount: 0, color: 'text-orange-500', bgColor: 'bg-orange-100', icon: '👑', discountType: 'reseller_extra', resellerDiscountPercent: 0.7, sortOrder: 8 },
  { id: '9', name: 'Grand Master', minBalance: 75000, discount: 0, color: 'text-pink-500', bgColor: 'bg-pink-100', icon: '🏆', discountType: 'reseller_extra', resellerDiscountPercent: 0.9, sortOrder: 9 },
  { id: '10', name: 'Titan', minBalance: 100000, discount: 0, color: 'text-indigo-600', bgColor: 'bg-gradient-to-r from-indigo-100 to-purple-100', icon: '⚡', discountType: 'reseller_extra', resellerDiscountPercent: 1, sortOrder: 10 },
];

// Cache for ranks
let cachedRanks: RankTier[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchRanks(): Promise<RankTier[]> {
  const now = Date.now();
  
  // Return cached ranks if still valid
  if (cachedRanks && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedRanks;
  }

  try {
    const { data, error } = await supabase
      .from('ranks')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_RANKS;
    }

    cachedRanks = data.map(r => ({
      id: r.id,
      name: r.name,
      minBalance: r.min_balance,
      discount: r.discount_percent,
      color: r.color || 'text-gray-500',
      bgColor: r.bg_color || 'bg-gray-100',
      icon: r.icon || '🏅',
      discountType: r.discount_type as 'percentage' | 'reseller' | 'reseller_extra',
      resellerDiscountPercent: r.reseller_discount_percent || 0,
      sortOrder: r.sort_order,
    }));
    
    lastFetchTime = now;
    return cachedRanks;
  } catch (error) {
    console.error('Error fetching ranks:', error);
    return DEFAULT_RANKS;
  }
}

// Synchronous version using cached data
export function getRanksSync(): RankTier[] {
  return cachedRanks || DEFAULT_RANKS;
}

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

// Clear cache function for when ranks are updated
export function clearRanksCache(): void {
  cachedRanks = null;
  lastFetchTime = 0;
}
