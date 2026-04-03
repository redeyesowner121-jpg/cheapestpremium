import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, CategoryItem } from './types';

export function useProductsData() {
  const { user } = useAuth();
  const location = useLocation();
  const initialCategory = location.state?.category?.toLowerCase() || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([{ id: 'all', name: 'All' }]);
  const [loading, setLoading] = useState(true);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    if (location.state?.category) {
      setSelectedCategory(location.state.category.toLowerCase());
    }
  }, [location.state?.category]);

  // Log search queries (debounced)
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);

    if (searchQuery.trim().length >= 2) {
      const timeout = setTimeout(async () => {
        const resultsCount = products.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).length;

        await supabase.from('search_logs').insert({
          user_id: user?.id || null,
          search_term: searchQuery.trim().toLowerCase(),
          results_count: resultsCount
        });
      }, 1000);

      setSearchTimeout(timeout);
    }

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchQuery, products, user]);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*, product_variations(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      const enriched = data.map(p => {
        const vars = (p.product_variations || [])
          .filter((v: any) => v.is_active !== false)
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const firstVar = vars[0];
        return {
          ...p,
          price: firstVar ? firstVar.price : p.price,
          product_variations: undefined
        };
      });
      setProducts(enriched);
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (data) {
      setCategories([
        { id: 'all', name: 'All' },
        ...data.map(c => ({ id: c.name.toLowerCase(), name: c.name }))
      ]);
    }
  };

  const filteredProducts = useMemo(() => products.filter((product) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      product.name.toLowerCase().includes(query) ||
      (product.description && product.description.toLowerCase().includes(query)) ||
      (product.seo_tags && product.seo_tags.toLowerCase().includes(query));
    const matchesCategory = selectedCategory === 'all' ||
      product.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  }), [products, searchQuery, selectedCategory]);

  const methodsProducts = useMemo(() =>
    products.filter(p => p.category?.toLowerCase() === 'methods').slice(0, 6),
    [products]
  );

  const coursesProducts = useMemo(() =>
    products.filter(p => p.category?.toLowerCase() === 'courses').slice(0, 6),
    [products]
  );

  return {
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    products, categories, loading,
    filteredProducts, methodsProducts, coursesProducts,
    loadProducts,
  };
}
