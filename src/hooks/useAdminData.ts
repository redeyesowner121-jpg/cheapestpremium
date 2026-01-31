import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

export interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalOrders: number;
  pendingOrders: number;
  blueTickUsers: number;
  todayOrders: number;
  lowStockProducts: any[];
  outOfStockProducts: any[];
}

export const useAdminData = (isAdmin: boolean, isTempAdmin: boolean) => {
  const [data, setData] = useState<AdminData>({
    users: [],
    orders: [],
    products: [],
    banners: [],
    flashSales: [],
    announcements: [],
    tempAdmins: [],
    categories: [],
    settings: {},
    transactions: []
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Load users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Load orders with profile info
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    let ordersWithProfiles: any[] = [];
    if (ordersData) {
      const userIds = [...new Set(ordersData.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', userIds);
      
      ordersWithProfiles = ordersData.map(order => ({
        ...order,
        profiles: profiles?.find(p => p.id === order.user_id)
      }));
    }

    // Load products
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    // Load banners
    const { data: bannersData } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });
    
    // Load flash sales
    const { data: flashSalesData } = await supabase
      .from('flash_sales')
      .select('*, products(name, image_url)')
      .order('created_at', { ascending: false });

    // Load announcements
    const { data: announcementsData } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    // Load temp admins (only for main admin)
    let tempAdminsWithProfiles: any[] = [];
    if (isAdmin) {
      const { data: tempAdminsData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'temp_admin');
      
      if (tempAdminsData) {
        const userIds = tempAdminsData.map(ta => ta.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        tempAdminsWithProfiles = tempAdminsData.map(ta => ({
          ...ta,
          profiles: profiles?.find(p => p.id === ta.user_id)
        }));
      }
    }

    // Load categories
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // Load settings
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('*');
    const settingsObj: Record<string, string> = {};
    settingsData?.forEach(s => {
      settingsObj[s.key] = s.value || '';
    });

    // Load transactions for analytics
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    setData({
      users: usersData || [],
      orders: ordersWithProfiles,
      products: productsData || [],
      banners: bannersData || [],
      flashSales: flashSalesData || [],
      announcements: announcementsData || [],
      tempAdmins: tempAdminsWithProfiles,
      categories: categoriesData || [],
      settings: settingsObj,
      transactions: transactionsData || []
    });

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
