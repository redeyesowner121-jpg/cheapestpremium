import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { readCache, writeCache } from '@/lib/persistentCache';

export interface AdminData {
  users: any[];
  orders: any[];
  products: any[];
  banners: any[];
  flashSales: any[];
  announcements: any[];
  tempAdmins: any[];
  categories: { id: string; name: string }[];
  settings: Record<string, string>;
  transactions: any[];
  depositRequests: any[];
}

export interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalOrders: number;
  pendingOrders: number;
  pendingDeposits: number;
  blueTickUsers: number;
  todayOrders: number;
  lowStockProducts: any[];
  outOfStockProducts: any[];
}

const EMPTY_DATA: AdminData = {
  users: [], orders: [], products: [], banners: [], flashSales: [],
  announcements: [], tempAdmins: [], categories: [], settings: {},
  transactions: [], depositRequests: []
};

const ADMIN_CACHE_KEY = 'admin_data_v1';

export const useAdminData = (isAdmin: boolean, isTempAdmin: boolean) => {
  // Hydrate instantly from cache so admin UI renders without a spinner on revisits
  const cached = readCache<AdminData>(ADMIN_CACHE_KEY, 5 * 60 * 1000);
  const [data, setData] = useState<AdminData>(cached || EMPTY_DATA);
  const [loading, setLoading] = useState(!cached);

  const loadData = useCallback(async () => {
    if (!cached) setLoading(true);

    // Run all top-level queries IN PARALLEL — was sequential before (8 awaits = slow)
    const [
      usersRes, ordersRes, productsRes, bannersRes, flashSalesRes,
      announcementsRes, tempAdminsRes, categoriesRes, settingsRes,
      transactionsRes, depositRequestsRes
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('banners').select('*').order('sort_order', { ascending: true }),
      supabase.from('flash_sales').select('*, products(name, image_url)').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      isAdmin
        ? supabase.from('user_roles').select('*').eq('role', 'temp_admin')
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('app_settings').select('*'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('manual_deposit_requests').select('*').order('created_at', { ascending: false }),
    ]);

    const ordersData = ordersRes.data || [];
    const tempAdminsData = (tempAdminsRes as any).data || [];
    const depositRequestsData = depositRequestsRes.data || [];

    // Collect all profile-id lookups into ONE query
    const lookupIds = new Set<string>();
    ordersData.forEach((o: any) => o.user_id && lookupIds.add(o.user_id));
    tempAdminsData.forEach((ta: any) => ta.user_id && lookupIds.add(ta.user_id));
    depositRequestsData.forEach((r: any) => r.user_id && lookupIds.add(r.user_id));

    let profilesMap = new Map<string, any>();
    if (lookupIds.size > 0) {
      const { data: lookupProfiles } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', Array.from(lookupIds));
      lookupProfiles?.forEach((p: any) => profilesMap.set(p.id, p));
    }

    const ordersWithProfiles = ordersData.map((order: any) => ({
      ...order,
      profiles: order.user_id ? profilesMap.get(order.user_id) || null : null
    }));

    const tempAdminsWithProfiles = tempAdminsData.map((ta: any) => ({
      ...ta,
      profiles: profilesMap.get(ta.user_id)
    }));

    const depositRequestsWithProfiles = depositRequestsData.map((req: any) => ({
      ...req,
      profiles: profilesMap.get(req.user_id)
    }));

    const settingsObj: Record<string, string> = {};
    settingsRes.data?.forEach((s: any) => { settingsObj[s.key] = s.value || ''; });

    const next: AdminData = {
      users: usersRes.data || [],
      orders: ordersWithProfiles,
      products: productsRes.data || [],
      banners: bannersRes.data || [],
      flashSales: flashSalesRes.data || [],
      announcements: announcementsRes.data || [],
      tempAdmins: tempAdminsWithProfiles,
      categories: categoriesRes.data || [],
      settings: settingsObj,
      transactions: transactionsRes.data || [],
      depositRequests: depositRequestsWithProfiles
    };

    setData(next);
    writeCache(ADMIN_CACHE_KEY, next);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || isTempAdmin) {
      loadData();
    }
  }, [isAdmin, isTempAdmin, loadData]);

  // Calculate stats
  const stats: AdminStats = {
    totalUsers: data.users.length,
    totalDeposits: data.users.reduce((sum, u) => sum + (u.total_deposit || 0), 0),
    totalOrders: data.orders.length,
    pendingOrders: data.orders.filter(o => o.status === 'pending').length,
    pendingDeposits: data.depositRequests.filter(r => r.status === 'pending').length,
    blueTickUsers: data.users.filter(u => u.has_blue_check).length,
    todayOrders: data.orders.filter(o => {
      const orderDate = new Date(o.created_at);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length,
    lowStockProducts: data.products.filter(p =>
      p.stock !== null && p.stock <= 5 && p.stock > 0
    ),
    outOfStockProducts: data.products.filter(p =>
      p.stock !== null && p.stock <= 0
    )
  };

  return { data, stats, loading, loadData, setData };
};
