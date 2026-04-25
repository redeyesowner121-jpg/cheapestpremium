import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Check, DollarSign, Package, Tag, SlidersHorizontal } from 'lucide-react';
import { type ProductFilters, DEFAULT_FILTERS } from './useProductFilters';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: ProductFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProductFilters>>;
  maxPrice: number;
  activeFiltersCount: number;
}

const ProductFilterSheet: React.FC<Props> = ({ open, onOpenChange, filters, setFilters, maxPrice, activeFiltersCount }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetTrigger asChild>
      <button className="absolute right-4 top-1/2 -translate-y-1/2">
        <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
        {activeFiltersCount > 0 && (
          <span className="absolute -top-2 -right-2 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
      </button>
    </SheetTrigger>
    <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl">
      <SheetHeader className="mb-4">
        <SheetTitle className="flex items-center justify-between">
          <span>Filters & Sort</span>
          <Button variant="ghost" size="sm"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-muted-foreground">Reset</Button>
        </SheetTitle>
      </SheetHeader>
      <div className="space-y-6 overflow-y-auto pb-20">
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Price Range
          </h4>
          <Slider value={[filters.priceMin, filters.priceMax]} max={maxPrice} step={10}
            onValueChange={([min, max]) => setFilters(f => ({ ...f, priceMin: min, priceMax: max }))} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>₹{filters.priceMin}</span><span>₹{filters.priceMax}</span>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Availability
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {([['all','All'],['in-stock','In Stock'],['instant','Instant']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFilters(f => ({ ...f, availability: id }))}
                className={`p-3 rounded-xl border text-sm transition-all ${
                  filters.availability === id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                }`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" /> Sort By
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {([['newest','Newest'],['popular','Popular'],['price-low','Price ↑'],['price-high','Price ↓']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFilters(f => ({ ...f, sortBy: id }))}
                className={`p-3 rounded-xl border text-sm flex items-center justify-between transition-all ${
                  filters.sortBy === id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                }`}>
                {label}
                {filters.sortBy === id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl h-12">Apply Filters</Button>
      </div>
    </SheetContent>
  </Sheet>
);

export default ProductFilterSheet;
