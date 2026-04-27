import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useHomeSearch(query: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]); setLoading(false); return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const q = query.trim().toLowerCase();
        const { data: exactData } = await supabase
          .from('products')
          .select('id, name, price, image_url, original_price, reseller_price, sold_count, rating, slug')
          .eq('is_active', true)
          .or(`name.ilike.%${q}%,seo_tags.ilike.%${q}%`)
          .limit(8);

        const map = (items: any[]) => items.map(p => ({
          id: p.id, name: p.name, price: p.price, slug: p.slug,
          image: p.image_url || 'https://via.placeholder.com/200',
          originalPrice: p.original_price, reseller_price: p.reseller_price,
          soldCount: p.sold_count || 0, rating: p.rating || 4.5,
        }));

        if (exactData && exactData.length > 0) {
          setResults(map(exactData));
        } else {
          const { data, error } = await supabase.functions.invoke('smart-search', {
            body: { query: query.trim() },
          });
          if (!error && data?.products?.length) {
            setResults(data.products.map((p: any) => ({
              id: p.id, name: p.name, price: p.price, slug: p.slug,
              image: p.image_url || 'https://via.placeholder.com/200',
              originalPrice: p.original_price, reseller_price: p.reseller_price,
              soldCount: p.sold_count || 0, rating: p.rating || 4.5,
            })));
          } else {
            setResults([]);
          }
        }
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 400);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [query]);

  return { results, loading };
}
