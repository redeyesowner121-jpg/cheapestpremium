import React from 'react';
import { motion } from 'framer-motion';
import { Check, TrendingUp } from 'lucide-react';
import { calculateFinalPrice, RankTier } from '@/lib/ranks';

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  reseller_price?: number | null;
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-primary rounded-full"></span>
        Select Duration
      </p>
      <div className="grid grid-cols-3 gap-2">
        {variations.map((variation, index) => {
          const varResellerPrice = variation.reseller_price || null;
          const { finalPrice: varFinalPrice } = calculateFinalPrice(
            variation.price,
            varResellerPrice,
            userRank,
            isReseller
          );
          const hasDiscount = varFinalPrice < variation.price;
          
          return (
            <motion.button
              key={variation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => onSelect(variation)}
              className={`relative p-3 rounded-xl border-2 transition-all ${
                selectedVariation?.id === variation.id
                  ? 'border-primary bg-primary/10 shadow-lg'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              {selectedVariation?.id === variation.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
              <span className="block text-sm font-semibold text-foreground">{variation.name}</span>
              <div className="mt-0.5">
                <span className="block text-lg font-bold text-primary">₹{Math.round(varFinalPrice)}</span>
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">₹{variation.price}</span>
                )}
              </div>
              {onViewPriceHistory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewPriceHistory(variation.id);
                  }}
                  className="mt-1 text-xs text-primary flex items-center gap-0.5 hover:underline"
                >
                  <TrendingUp className="w-3 h-3" />
                  History
                </button>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ProductVariationSelector;
