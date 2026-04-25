import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const useGiveawayBotData = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [giveawayProducts, setGiveawayProducts] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [pointsPerReferral, setPointsPerReferral] = useState('2');

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariation, setSelectedVariation] = useState('');
  const [pointsRequired, setPointsRequired] = useState('10');
  const [stock, setStock] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, gpRes, redemRes, settingsRes, pointsRes, referralsRes] = await Promise.all([
        supabase.from('products').select('id, name, image_url').order('name'),
        supabase.from('giveaway_products' as any).select('*, product:products(name, image_url), variation:product_variations(name)').order('created_at', { ascending: false }),
        supabase.from('giveaway_redemptions' as any).select('*, giveaway_product:giveaway_products(product:products(name))').order('created_at', { ascending: false }).limit(50),
        supabase.from('giveaway_settings' as any).select('*'),
        supabase.from('giveaway_points' as any).select('telegram_id, points, total_referrals').order('points', { ascending: false }),
        supabase.from('giveaway_referrals' as any).select('id', { count: 'exact', head: true }),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (gpRes.data) setGiveawayProducts(gpRes.data as any);
      if (redemRes.data) setRedemptions(redemRes.data as any);

      const allPoints = (pointsRes.data as any[]) || [];
      const totalPoints = allPoints.reduce((s: number, p: any) => s + (p.points || 0), 0);
      const totalReferrals = (referralsRes as any).count || 0;
      const activeProducts = (gpRes.data as any[])?.filter((g: any) => g.is_active).length || 0;

      setStats({
        totalUsers: allPoints.length,
        totalPoints, totalReferrals,
        totalRedemptions: (redemRes.data as any[])?.length || 0,
        activeProducts,
      });

      const top15 = allPoints.slice(0, 15);
      const enriched = [];
      for (const u of top15) {
        const { data: userInfo } = await supabase.from('telegram_bot_users' as any)
          .select('username, first_name').eq('telegram_id', u.telegram_id).maybeSingle();
        enriched.push({
          ...u,
          name: (userInfo as any)?.username ? `@${(userInfo as any).username}` : (userInfo as any)?.first_name || String(u.telegram_id),
        });
      }
      setTopUsers(enriched);

      if (settingsRes.data) {
        const ppr = (settingsRes.data as any[]).find((s: any) => s.key === 'points_per_referral');
        if (ppr) setPointsPerReferral(ppr.value || '2');
      }
    } catch { toast.error('Failed to fetch data'); }
    setLoading(false);
  };

  const fetchVariations = async (productId: string) => {
    const { data } = await supabase.from('product_variations').select('id, name, price').eq('product_id', productId).eq('is_active', true);
    setVariations(data || []);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedProduct) fetchVariations(selectedProduct); else setVariations([]); }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  const selectedProductName = useMemo(
    () => products.find(p => p.id === selectedProduct)?.name || '',
    [products, selectedProduct]
  );

  const addGiveawayProduct = async () => {
    if (!selectedProduct) { toast.error('Select a product'); return; }
    await supabase.from('giveaway_products' as any).insert({
      product_id: selectedProduct,
      variation_id: selectedVariation || null,
      points_required: parseInt(pointsRequired) || 10,
      stock: stock ? parseInt(stock) : null,
    } as any);
    toast.success('✅ Giveaway product added!');
    setSelectedProduct(''); setSelectedVariation(''); setPointsRequired('10'); setStock('');
    fetchData();
  };

  const removeGiveawayProduct = async (id: string) => {
    await supabase.from('giveaway_products' as any).delete().eq('id', id);
    toast.success('Removed!'); fetchData();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('giveaway_products' as any).update({ is_active: !current } as any).eq('id', id);
    fetchData();
  };

  const savePointsPerReferral = async () => {
    await supabase.from('giveaway_settings' as any).upsert(
      { key: 'points_per_referral', value: pointsPerReferral, updated_at: new Date().toISOString() } as any,
      { onConflict: 'key' }
    );
    toast.success('Points per referral updated!');
  };

  const viewUserDetail = async (tgId: number) => {
    const [pointsRes, referralsRes, redemptionsRes, userRes] = await Promise.all([
      supabase.from('giveaway_points' as any).select('*').eq('telegram_id', tgId).maybeSingle(),
      supabase.from('giveaway_referrals' as any).select('referred_telegram_id, points_awarded, created_at')
        .eq('referrer_telegram_id', tgId).order('created_at', { ascending: false }).limit(10),
      supabase.from('giveaway_redemptions' as any).select('*, giveaway_product:giveaway_products(product:products(name))')
        .eq('telegram_id', tgId).order('created_at', { ascending: false }).limit(10),
      supabase.from('telegram_bot_users' as any).select('username, first_name, telegram_id').eq('telegram_id', tgId).maybeSingle(),
    ]);
    return {
      ...((userRes.data as any) || {}),
      points: (pointsRes.data as any),
      referrals: (referralsRes.data as any[]) || [],
      redemptions: (redemptionsRes.data as any[]) || [],
    };
  };

  return {
    products, variations, giveawayProducts, redemptions, loading, stats, topUsers,
    pointsPerReferral, setPointsPerReferral,
    selectedProduct, setSelectedProduct,
    selectedVariation, setSelectedVariation,
    pointsRequired, setPointsRequired,
    stock, setStock,
    productSearch, setProductSearch,
    productDropdownOpen, setProductDropdownOpen,
    filteredProducts, selectedProductName,
    fetchData, addGiveawayProduct, removeGiveawayProduct, toggleActive,
    savePointsPerReferral, viewUserDetail,
  };
};
