import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Order {
  id: string;
  product_name: string;
  product_image: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  access_link?: string;
  admin_note?: string;
  user_note?: string;
  seller_id?: string;
  buyer_confirmed?: boolean;
  is_withdrawable?: boolean;
  discount_applied?: number;
}

const ORDER_COLS = 'id,product_name,product_image,unit_price,total_price,quantity,status,created_at,access_link,admin_note,user_note,seller_id,buyer_confirmed,is_withdrawable,discount_applied';

export function useOrders(user: any, profile: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Auto-claim orphaned bot orders for this user's telegram account
    try {
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('telegram_id')
        .eq('id', user.id)
        .maybeSingle();
      const tgId =
        (freshProfile as any)?.telegram_id ??
        (profile as any)?.telegram_id ??
        (user as any)?.user_metadata?.telegram_id ??
        null;
      if (tgId) {
        await supabase.rpc('claim_telegram_orders', { _telegram_id: Number(tgId) });
      }
    } catch (e) {
      console.warn('claim_telegram_orders failed (non-fatal):', e);
    }

    const { data } = await supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }, [user, (profile as any)?.telegram_id]);

  useEffect(() => {
    if (user) loadOrders();
    else setLoading(false);
  }, [user, loadOrders]);

  return { orders, loading, loadOrders };
}
