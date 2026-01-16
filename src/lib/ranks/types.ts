// Rank type definitions

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
export const DEFAULT_RANKS: RankTier[] = [
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
