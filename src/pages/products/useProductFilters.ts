import { useState, useMemo } from 'react';

export interface ProductFilters {
  priceMin: number;
  priceMax: number;
  availability: 'all' | 'in-stock' | 'instant';
  sortBy: 'newest' | 'price-low' | 'price-high' | 'popular';
}

export const DEFAULT_FILTERS: ProductFilters = {
  priceMin: 0,
  priceMax: 50000,
  availability: 'all',
  sortBy: 'newest',
};

export function useProductFilters(filteredProducts: any[]) {
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);

  const maxPrice = useMemo(() => {
    if (filteredProducts.length === 0) return 50000;
    return Math.max(...filteredProducts.map(p => p.price), 1000);
  }, [filteredProducts]);

  const displayProducts = useMemo(() => {
    let result = [...filteredProducts];
    result = result.filter(p => p.price >= filters.priceMin && p.price <= filters.priceMax);
    if (filters.availability === 'in-stock') {
      result = result.filter(p => p.stock === null || p.stock === undefined || p.stock > 0);
    } else if (filters.availability === 'instant') {
      result = result.filter(p => !!p.access_link);
    }
    if (filters.sortBy === 'price-low') result.sort((a, b) => a.price - b.price);
    else if (filters.sortBy === 'price-high') result.sort((a, b) => b.price - a.price);
    else if (filters.sortBy === 'popular') result.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
    return result;
  }, [filteredProducts, filters]);

  const activeFiltersCount = [
    filters.priceMin > 0 || filters.priceMax < maxPrice,
    filters.availability !== 'all',
    filters.sortBy !== 'newest',
  ].filter(Boolean).length;

  return { filters, setFilters, maxPrice, displayProducts, activeFiltersCount };
}
