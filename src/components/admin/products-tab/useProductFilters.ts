import { useMemo } from 'react';

interface FilterArgs {
  products: any[];
  categoryFilter: string;
  searchQuery: string;
  priceRange: { min: string; max: string };
  stockFilter: string;
  sortBy: string;
}

export const useProductFilters = ({
  products, categoryFilter, searchQuery, priceRange, stockFilter, sortBy,
}: FilterArgs) =>
  useMemo(() => {
    let result = products;

    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.name?.toLowerCase().includes(query) || p.category?.toLowerCase().includes(query)
      );
    }

    if (priceRange.min) result = result.filter((p) => p.price >= parseFloat(priceRange.min));
    if (priceRange.max) result = result.filter((p) => p.price <= parseFloat(priceRange.max));

    if (stockFilter !== 'all') {
      result = result.filter((p) => {
        const stock = p.stock ?? null;
        if (stockFilter === 'in_stock') return stock === null || stock > 10;
        if (stockFilter === 'low_stock') return stock !== null && stock > 0 && stock <= 10;
        if (stockFilter === 'out_of_stock') return stock === 0;
        return true;
      });
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price_high':
          return b.price - a.price;
        case 'price_low':
          return a.price - b.price;
        case 'sales':
          return (b.sold_count || 0) - (a.sold_count || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [products, categoryFilter, searchQuery, priceRange, stockFilter, sortBy]);
