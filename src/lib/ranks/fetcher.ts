// Rank fetching and caching logic

import { supabase } from '@/integrations/supabase/client';
import { RankTier, DEFAULT_RANKS } from './types';

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

// Clear cache function for when ranks are updated
export function clearRanksCache(): void {
  cachedRanks = null;
  lastFetchTime = 0;
}
