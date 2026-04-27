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

const cacheKey = (uid: string) => `orders_cache_${uid}`;
const readOrderCache = (uid: string): Order[] | null => {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > 5 * 60 * 1000) return null;
    return parsed.d;
  } catch { return null; }
};
const writeOrderCache = (uid: string, d: Order[]) => {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify({ t: Date.now(), d })); } catch {}
};

export function useOrders(user: any, profile: any) {
  const initialCache = user ? readOrderCache(user.id) : null;
  const [orders, setOrders] = useState<Order[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    if (!initialCache) setLoading(true);

    // Run orders fetch immediately; do telegram claim in parallel (non-blocking)
    const ordersPromise = supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    // Fire-and-forget telegram claim — don't block orders display
    (async () => {
      try {
        const tgId =
          (profile as any)?.telegram_id ??
          (user as any)?.user_metadata?.telegram_id ??
          null;
        if (tgId) {
          await supabase.rpc('claim_telegram_orders', { _telegram_id: Number(tgId) });
        }
      } catch (e) {
        console.warn('claim_telegram_orders failed (non-fatal):', e);
      }
    })();

    const { data } = await ordersPromise;
    if (data) {
      setOrders(data as Order[]);
      writeOrderCache(user.id, data as Order[]);
    }
    setLoading(false);
  }, [user, (profile as any)?.telegram_id]);

  useEffect(() => {
    if (user) loadOrders();
    else setLoading(false);
  }, [user, loadOrders]);

  return { orders, loading, loadOrders };
}
