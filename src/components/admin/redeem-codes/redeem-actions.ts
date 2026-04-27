import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RedeemCode } from './types';

export async function fetchRedeemCodes(): Promise<RedeemCode[]> {
  const { data } = await supabase
    .from('redeem_codes')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

export interface RedeemCodePayload {
  code: string;
  amount: number;
  description: string | null;
  usage_limit: number;
  is_active: boolean;
  expires_at: string | null;
}

export async function saveRedeemCode(payload: RedeemCodePayload, editingId?: string) {
  if (editingId) {
    const { error } = await supabase.from('redeem_codes').update(payload).eq('id', editingId);
    if (error) { toast.error('Failed to update code'); return false; }
    toast.success('Redeem code updated');
    return true;
  }
  const { error } = await supabase.from('redeem_codes').insert(payload);
  if (error) {
    toast.error(error.code === '23505' ? 'Code already exists' : 'Failed to create code');
    return false;
  }
  toast.success('Redeem code created');
  return true;
}

export async function deleteRedeemCode(id: string): Promise<boolean> {
  const { error } = await supabase.from('redeem_codes').delete().eq('id', id);
  if (error) { toast.error('Failed to delete code'); return false; }
  toast.success('Code deleted');
  return true;
}

export async function toggleRedeemActive(rc: RedeemCode): Promise<boolean> {
  const { error } = await supabase
    .from('redeem_codes')
    .update({ is_active: !rc.is_active })
    .eq('id', rc.id);
  return !error;
}

export function generateRedeemCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'GIFT';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
