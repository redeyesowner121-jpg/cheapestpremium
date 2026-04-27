import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PRODUCT_COLS = 'id,name,price,original_price,reseller_price,image_url,sold_count,rating,slug,category,created_at,product_variations(id,price,reseller_price,is_active,created_at)';

const mapProduct = (p: any) => {
  const vars = (p.product_variations || [])
    .filter((v: any) => v.is_active !== false)
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const firstVar = vars[0];
  return {
    id: p.id, name: p.name,
    price: firstVar ? firstVar.price : p.price,
    originalPrice: p.original_price,
    image: p.image_url || 'https://via.placeholder.com/200',
    rating: p.rating || 4.5, soldCount: p.sold_count || 0,
    reseller_price: p.reseller_price, created_at: p.created_at,
    slug: p.slug,
  };
};

export function useHomeData() {
  const [banners, setBanners] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [methodsProducts, setMethodsProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const dataLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [bannersRes, productsRes, categoriesRes] = await Promise.all([
        supabase.from('banners').select('id,image_url,title,link').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('products').select(PRODUCT_COLS).eq('is_active', true).order('sold_count', { ascending: false }).limit(14),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (bannersRes.data?.length) {
        setBanners(bannersRes.data.map(b => ({ id: b.id, image: b.image_url, title: b.title, link: b.link })));
      }
      if (productsRes.data) {
        const all = productsRes.data;
        setProducts(all.slice(0, 8).map(mapProduct));
        const methods = all.filter((p: any) => /methods/i.test(p.category || '')).slice(0, 6);
        if (methods.length) setMethodsProducts(methods.map(mapProduct));
      }

      // Deferred non-critical fetches
      setTimeout(async () => {
        const { data: flashRes } = await supabase
          .from('flash_sales')
          .select('id,product_id,sale_price,end_time,variation_name,products(id,name,price,image_url)')
          .eq('is_active', true)
          .gt('end_time', new Date().toISOString());
        if (flashRes) {
          setFlashSales(flashRes.map((fs: any) => ({
            id: fs.id, productId: fs.product_id,
            name: fs.products?.name || 'Product',
            originalPrice: fs.products?.price || 0,
            salePrice: fs.sale_price,
            image: fs.products?.image_url || 'https://via.placeholder.com/200',
            endTime: new Date(fs.end_time).getTime(),
            productData: fs.products,
            variationName: fs.variation_name || null,
          })));
        }
        setMethodsProducts((prev) => {
          if (prev.length) return prev;
          supabase.from('products').select(PRODUCT_COLS).eq('is_active', true).ilike('category', '%methods%').limit(6)
            .then(({ data }) => data && setMethodsProducts(data.map(mapProduct)));
          return prev;
        });
      }, 300);
    } catch (error) {
      console.error('Error loading home data:', error);
    }
  }, []);

  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      loadData();
    }
  }, [loadData]);

  return { banners, flashSales, products, methodsProducts, categories };
}
