export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_deposit: number;
  total_orders: number;
  has_blue_check: boolean;
  created_at: string;
  rank_balance: number;
  is_reseller: boolean;
}
