import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  wallet_balance: number;
  total_deposit: number;
  total_orders: number;
  total_savings: number;
  has_blue_check: boolean;
  referral_code: string;
  referred_by?: string;
  notifications_enabled: boolean;
  last_daily_bonus?: string;
  created_at: string;
  rank_balance: number;
  is_reseller: boolean;
  last_rank_decay?: string;
  display_currency: string;
}

const parseNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
};

const parseString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

export const normalizeProfile = (data: any): UserProfile => ({
  id: parseString(data?.id),
  email: parseString(data?.email),
  name: parseString(data?.name, 'User'),
  phone: typeof data?.phone === 'string' ? data.phone : undefined,
  avatar_url: typeof data?.avatar_url === 'string' ? data.avatar_url : undefined,
  wallet_balance: parseNumber(data?.wallet_balance),
  total_deposit: parseNumber(data?.total_deposit),
  total_orders: parseNumber(data?.total_orders),
  total_savings: parseNumber(data?.total_savings),
  has_blue_check: parseBoolean(data?.has_blue_check),
  referral_code: parseString(data?.referral_code),
  referred_by: typeof data?.referred_by === 'string' ? data.referred_by : undefined,
  notifications_enabled: parseBoolean(data?.notifications_enabled, true),
  last_daily_bonus: typeof data?.last_daily_bonus === 'string' ? data.last_daily_bonus : undefined,
  created_at: parseString(data?.created_at),
  rank_balance: parseNumber(data?.rank_balance),
  is_reseller: parseBoolean(data?.is_reseller),
  last_rank_decay: typeof data?.last_rank_decay === 'string' ? data.last_rank_decay : undefined,
  display_currency: parseString(data?.display_currency, 'INR'),
});

export const fetchUserProfile = async (
  userId: string,
  userMeta?: Record<string, any>
): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load profile:', error);
    return null;
  }
  if (!data) return null;

  const normalizedProfile = normalizeProfile(data);

  // Check if blue tick has expired using already-available metadata
  if (normalizedProfile.has_blue_check && userMeta) {
    const blueTickExpiry = userMeta.blue_tick_expiry;
    if (blueTickExpiry && new Date(blueTickExpiry) < new Date()) {
      await supabase.from('profiles').update({ has_blue_check: false }).eq('id', userId);
      normalizedProfile.has_blue_check = false;
    }
  }
  return normalizedProfile;
};

export interface AdminRoleInfo {
  isAdmin: boolean;
  isTempAdmin: boolean;
  tempAdminExpiry?: string;
}

export const fetchAdminRole = async (userId: string): Promise<AdminRoleInfo> => {
  const { data } = await supabase
    .from('user_roles')
    .select('role, temp_admin_expiry')
    .eq('user_id', userId);

  if (!data) return { isAdmin: false, isTempAdmin: false };

  const adminRole = data.find(r => r.role === 'admin');
  const tempAdminRole = data.find(r => r.role === 'temp_admin');

  let isTempAdmin = false;
  let tempAdminExpiry: string | undefined;
  if (tempAdminRole) {
    const expiry = tempAdminRole.temp_admin_expiry;
    if (expiry && new Date(expiry) > new Date()) {
      isTempAdmin = true;
      tempAdminExpiry = expiry;
    }
  }

  return { isAdmin: !!adminRole, isTempAdmin, tempAdminExpiry };
};
