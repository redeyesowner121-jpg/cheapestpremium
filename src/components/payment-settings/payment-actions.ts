import { supabase } from '@/integrations/supabase/client';

export interface PaymentSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  is_enabled: boolean;
}

export async function loadPaymentSettings(): Promise<PaymentSetting[]> {
  const { data } = await supabase.from('payment_settings').select('*');
  return data || [];
}

export async function upsertSetting(
  settings: PaymentSetting[],
  key: string,
  value: string | null,
  isEnabled?: boolean
) {
  const existing = settings.find(s => s.setting_key === key);
  if (existing) {
    await supabase.from('payment_settings').update({
      setting_value: value,
      ...(isEnabled !== undefined && { is_enabled: isEnabled })
    }).eq('id', existing.id);
  } else {
    await supabase.from('payment_settings').insert({
      setting_key: key,
      setting_value: value,
      is_enabled: isEnabled ?? true,
    });
  }
}

export async function uploadPaymentQR(file: File): Promise<string> {
  const fileName = `payment-qr-${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('payment-assets').upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('payment-assets').getPublicUrl(fileName);
  return publicUrl;
}
