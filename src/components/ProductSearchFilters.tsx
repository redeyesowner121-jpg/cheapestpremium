import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SlidersHorizontal, X, ChevronDown, Check,
  Package, Tag, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface ProductFilters {
  priceMin: number;
  priceMax: number;
  availability: 'all' | 'in-stock' | 'instant';
  sortBy: 'newest' | 'price-low' | 'price-high' | 'popular';
}

interface ProductSearchFiltersProps {
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  maxPrice?: number;
}

const ProductSearchFilters: React.FC<ProductSearchFiltersProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  filters,
  onFiltersChange,
  maxPrice = 10000
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleResetFilters = () => {
    const defaultFilters: ProductFilters = {
      priceMin: 0,
      priceMax: maxPrice,
      availability: 'all',
      sortBy: 'newest'
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const activeFiltersCount = [
    filters.priceMin > 0 || filters.priceMax < maxPrice,
    filters.availability !== 'all',
    filters.sortBy !== 'newest'
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Category Pills */}
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'gradient-primary text-primary-foreground shadow-card'
                  : 'bg-card text-foreground hover:bg-muted'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl relative"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center justify-between">
              <span>Filters & Sort</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleResetFilters}
                className="text-muted-foreground"
              >
                Reset All
              </Button>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 overflow-y-auto pb-20">
            {/* Price Range */}
            <div className="space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Price Range
              </h4>
              <div className="px-2">
                <Slider
                  value={[localFilters.priceMin, localFilters.priceMax]}
                  max={maxPrice}
                  step={10}
                  onValueChange={([min, max]) => 
                    setLocalFilters(prev => ({ ...prev, priceMin: min, priceMax: max }))
                  }
                  className="mb-4"
                />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Min</span>
                    <Input
                      type="number"
                      value={localFilters.priceMin}
                      onChange={(e) => setLocalFilters(prev => ({ 
                        ...prev, 
                        priceMin: Math.max(0, parseInt(e.target.value) || 0)
                      }))}
                      className="h-8"
                    />
                  </div>
                  <span className="text-muted-foreground mt-4">-</span>
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Max</span>
                    <Input
                      type="number"
                      value={localFilters.priceMax}
                      onChange={(e) => setLocalFilters(prev => ({ 
                        ...prev, 
                        priceMax: Math.min(maxPrice, parseInt(e.target.value) || maxPrice)
                      }))}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-3">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Availability
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'in-stock', label: 'In Stock' },
                  { id: 'instant', label: 'Instant Delivery' }
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setLocalFilters(prev => ({ 
                      ...prev, 
                      availability: option.id as ProductFilters['availability']
                    }))}
                    className={`p-3 rounded-xl border text-sm transition-all ${
                      localFilters.availability === option.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div className="space-y-3">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Sort By
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'newest', label: 'Newest First' },
                  { id: 'popular', label: 'Most Popular' },
                  { id: 'price-low', label: 'Price: Low to High' },
                  { id: 'price-high', label: 'Price: High to Low' }
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setLocalFilters(prev => ({ 
                      ...prev, 
                      sortBy: option.id as ProductFilters['sortBy']
                    }))}
                    className={`p-3 rounded-xl border text-sm text-left transition-all flex items-center justify-between ${
                      localFilters.sortBy === option.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option.label}
                    {localFilters.sortBy === option.id && (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
            <Button 
              onClick={handleApplyFilters}
              className="w-full rounded-xl h-12"
            >
              Apply Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProductSearchFilters;
