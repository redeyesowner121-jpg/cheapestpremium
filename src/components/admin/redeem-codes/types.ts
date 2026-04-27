export interface RedeemCode {
  id: string;
  code: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  usage_limit: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}
