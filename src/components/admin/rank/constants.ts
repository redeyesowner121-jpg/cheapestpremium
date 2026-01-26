export const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage Discount' },
  { value: 'reseller', label: 'Reseller Price' },
  { value: 'reseller_extra', label: 'Reseller + Extra Discount' },
];

export const ICON_OPTIONS = ['🥉', '🥈', '🥇', '💠', '💎', '🔮', '⚔️', '👑', '🏆', '⚡', '🌟', '🎖️', '🏅', '🎯'];

export const COLOR_OPTIONS = [
  { value: 'text-amber-700', label: 'Amber' },
  { value: 'text-slate-500', label: 'Slate' },
  { value: 'text-yellow-600', label: 'Yellow' },
  { value: 'text-cyan-600', label: 'Cyan' },
  { value: 'text-blue-500', label: 'Blue' },
  { value: 'text-purple-500', label: 'Purple' },
  { value: 'text-red-500', label: 'Red' },
  { value: 'text-orange-500', label: 'Orange' },
  { value: 'text-pink-500', label: 'Pink' },
  { value: 'text-indigo-600', label: 'Indigo' },
  { value: 'text-green-500', label: 'Green' },
];

export const BG_COLOR_OPTIONS = [
  { value: 'bg-amber-100', label: 'Amber' },
  { value: 'bg-slate-100', label: 'Slate' },
  { value: 'bg-yellow-100', label: 'Yellow' },
  { value: 'bg-cyan-100', label: 'Cyan' },
  { value: 'bg-blue-100', label: 'Blue' },
  { value: 'bg-purple-100', label: 'Purple' },
  { value: 'bg-red-100', label: 'Red' },
  { value: 'bg-orange-100', label: 'Orange' },
  { value: 'bg-pink-100', label: 'Pink' },
  { value: 'bg-indigo-100', label: 'Indigo' },
  { value: 'bg-green-100', label: 'Green' },
  { value: 'bg-gradient-to-r from-indigo-100 to-purple-100', label: 'Gradient' },
];

export interface Rank {
  id: string;
  name: string;
  min_balance: number;
  discount_percent: number;
  color: string;
  bg_color: string;
  icon: string;
  discount_type: string;
  reseller_discount_percent: number;
  sort_order: number;
  is_active: boolean;
}
