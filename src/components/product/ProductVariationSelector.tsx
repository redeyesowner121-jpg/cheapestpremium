import React from 'react';
import { Check, TrendingUp } from 'lucide-react';
import { calculateFinalPrice, RankTier } from '@/lib/ranks';

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  original_price?: number | null;
  reseller_price?: number | null;
  description?: string | null;
  is_active: boolean;
}

interface ProductVariationSelectorProps {
  variations: ProductVariation[];
  selectedVariation: ProductVariation | null;
  onSelect: (variation: ProductVariation) => void;
  userRank: RankTier;
  isReseller: boolean;
  onViewPriceHistory?: (variationId: string) => void;
}

const ProductVariationSelector: React.FC<ProductVariationSelectorProps> = ({
  variations,
  selectedVariation,
  onSelect,
  userRank,
  isReseller,
  onViewPriceHistory,
}) => {
  if (variations.length === 0) return null;

  return (
    <div className="animate-in fade-in duration-200">
      <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-primary rounded-full"></span>
        Select Duration
      </p>
      <div className="grid grid-cols-3 gap-2">
        {variations.map((variation) => {
          const varResellerPrice = variation.reseller_price || null;
          const { finalPrice: varFinalPrice } = calculateFinalPrice(
            variation.price,
            varResellerPrice,
            userRank,
            isReseller
          );
          const hasDiscount = varFinalPrice < variation.price;
          const hasOriginalDiscount = variation.original_price && variation.original_price > variation.price;
          const isSelected = selectedVariation?.id === variation.id;
          
          return (
            <div
              key={variation.id}
              onClick={() => onSelect(variation)}
              className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer active:scale-95 ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-lg'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <span className="block text-sm font-semibold text-foreground">{variation.name}</span>
              {variation.description && (
                <span className="block text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{variation.description}</span>
              )}
              <div className="mt-0.5">
                <span className="block text-lg font-bold text-primary">₹{Math.round(varFinalPrice)}</span>
                {hasOriginalDiscount && (
                  <span className="text-xs text-muted-foreground line-through">₹{variation.original_price}</span>
                )}
                {hasDiscount && !hasOriginalDiscount && (
                  <span className="text-xs text-muted-foreground line-through">₹{variation.price}</span>
                )}
              </div>
              {onViewPriceHistory && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewPriceHistory(variation.id);
                  }}
                  className="mt-1 text-xs text-primary flex items-center gap-0.5 hover:underline cursor-pointer"
                >
                  <TrendingUp className="w-3 h-3" />
                  History
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductVariationSelector;
