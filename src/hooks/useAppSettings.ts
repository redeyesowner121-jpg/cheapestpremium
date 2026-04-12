import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
  app_name: string;
  app_language: string;
  currency_symbol: string;
  contact_whatsapp: string;
  contact_email: string;
  min_deposit: number;
  payment_qr_code: string;
  login_bonus: number;
  daily_bonus_min: number;
  daily_bonus_max: number;
  referral_bonus: number;
  blue_tick_threshold: number;
  single_deposit_bonus_threshold: number;
  single_deposit_bonus_amount: number;
  low_stock_threshold: number;
  maintenance_mode: boolean;
  allow_registration: boolean;
  auto_approve_orders: boolean;
  notification_enabled: boolean;
  razorpay_enabled: boolean;
  google_login_enabled: boolean;
  blue_tick_price: number;
  app_url: string;
  binance_id: string;
  binance_contact_message: string;
  app_tagline: string;
  usd_conversion_rate: number;
  foreign_deposit_fee_percent: number;
  payment_link: string;
  app_logo: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  app_name: 'RKR Premium Store',
  app_language: 'English',
  currency_symbol: '₹',
  contact_whatsapp: '+918900684167',
  contact_email: '',
  min_deposit: 10,
  payment_qr_code: '',
  login_bonus: 0,
  daily_bonus_min: 0.10,
  daily_bonus_max: 1.00,
  referral_bonus: 10,
  blue_tick_threshold: 1000,
  single_deposit_bonus_threshold: 1000,
  single_deposit_bonus_amount: 100,
  low_stock_threshold: 5,
  maintenance_mode: false,
  allow_registration: true,
  auto_approve_orders: false,
  notification_enabled: true,
  razorpay_enabled: true,
  google_login_enabled: false,
  blue_tick_price: 0,
  app_url: 'https://cheapest-premiums.in',
  binance_id: '1178303416',
  binance_contact_message: "You don't have Binance? Contact seller on WhatsApp for alternative payment.",
  app_tagline: 'Premium Digital Products',
  usd_conversion_rate: 95,
  foreign_deposit_fee_percent: 10,
  payment_link: 'https://razorpay.me/@asifikbalrubaiulislam',
  app_logo: '',
};

// Parse value based on expected type
const parseSettingValue = (key: keyof AppSettings, value: string | null): any => {
  if (value === null || value === undefined) return DEFAULT_SETTINGS[key];
  
  const booleanKeys = [
    'maintenance_mode', 'allow_registration', 'auto_approve_orders',
    'notification_enabled', 'razorpay_enabled', 'google_login_enabled'
  ];
  
  const numberKeys = [
    'min_deposit', 'login_bonus', 'daily_bonus_min', 'daily_bonus_max',
    'referral_bonus', 'blue_tick_threshold', 'single_deposit_bonus_threshold',
    'single_deposit_bonus_amount', 'low_stock_threshold', 'blue_tick_price',
    'usd_conversion_rate', 'foreign_deposit_fee_percent'
  ];
  
  if (booleanKeys.includes(key)) {
    return value === 'true';
  }
  
  if (numberKeys.includes(key)) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? DEFAULT_SETTINGS[key] : parsed;
  }
  
  return value || DEFAULT_SETTINGS[key];
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('key, value');
      
      if (fetchError) throw fetchError;
      
      const newSettings = { ...DEFAULT_SETTINGS };
      
      data?.forEach(({ key, value }) => {
        if (key in DEFAULT_SETTINGS) {
          (newSettings as any)[key] = parseSettingValue(key as keyof AppSettings, value);
        }
      });
      
      setSettings(newSettings);
      setError(null);
    } catch (err) {
      console.error('Failed to load app settings:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings'
        },
        (payload) => {
          console.log('Settings changed:', payload);
          loadSettings();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSettings]);

  return { settings, loading, error, refetch: loadSettings };
};

// For getting a single setting value with caching
export const getAppSetting = async (key: keyof AppSettings): Promise<any> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  
  if (error || !data) {
    return DEFAULT_SETTINGS[key];
  }
  
  return parseSettingValue(key, data.value);
};
