import React, { memo, useCallback, useMemo } from 'react';
import { Star, Share2, Package, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  soldCount: number;
  category?: string;
  hasAccessLink?: boolean;
  reseller_price?: number;
}

interface ProductGridProps {
  products?: Product[];
  onProductClick?: (product: Product) => void;
  onBuyClick?: (product: Product) => void;
}

const ProductCard = memo<{
  product: Product;
  userRank: ReturnType<typeof getUserRank>;
  isReseller: boolean;
  currencySymbol: string;
  appName: string;
  onProductClick?: (product: Product) => void;
  onBuyClick?: (product: Product) => void;
}>(({ product, userRank, isReseller, currencySymbol, appName, onProductClick, onBuyClick }) => {
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const productUrl = `${window.location.origin}/product/${product.id}`;
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} at ${appName}! Only ${currencySymbol}${product.price}`,
      url: productUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      }
    } catch (error) {
      // Silent fail
    }
  }, [product, appName, currencySymbol]);

  const priceInfo = useMemo(() => {
    const { finalPrice, savings } = calculateFinalPrice(
      product.price,
      product.reseller_price || null,
      userRank,
      isReseller
    );
    return { finalPrice, savings, hasRankDiscount: savings > 0 };
  }, [product.price, product.reseller_price, userRank, isReseller]);

  return (
    <div
      onClick={() => onProductClick?.(product)}
      className="bg-card rounded-2xl overflow-hidden shadow-card active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-28 object-cover"
          loading="lazy"
        />
        {product.originalPrice && (
          <div className="absolute top-2 left-2 gradient-accent px-2 py-0.5 rounded-full">
            <span className="text-[10px] font-bold text-accent-foreground">
              -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
            </span>
          </div>
        )}
        <button
          onClick={handleShare}
          className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full"
        >
          <Share2 className="w-3.5 h-3.5 text-foreground" />
        </button>
      </div>
      
      <div className="p-3">
        <h3 className="font-semibold text-sm text-foreground truncate">{product.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{product.description}</p>
        
        <div className="flex items-center gap-1 mt-1.5">
          <Star className="w-3 h-3 text-accent fill-accent" />
          <span className="text-xs text-foreground font-medium">{product.rating}</span>
          <span className="text-xs text-muted-foreground">({product.soldCount})</span>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-primary font-bold">{currencySymbol}{Math.round(priceInfo.finalPrice * 100) / 100}</span>
            {(priceInfo.hasRankDiscount || product.originalPrice) && (
              <span className="text-xs text-muted-foreground line-through ml-1">
                {currencySymbol}{priceInfo.hasRankDiscount ? product.price : product.originalPrice}
              </span>
            )}
            {priceInfo.hasRankDiscount && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Tag className="w-2.5 h-2.5 text-green-600" />
                <span className="text-[9px] text-green-600">{userRank.icon}</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="h-7 px-3 text-xs btn-gradient rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              onBuyClick?.(product);
            }}
          >
            Buy
          </Button>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

const ProductGrid: React.FC<ProductGridProps> = memo(({ 
  products,
  onProductClick,
  onBuyClick
}) => {
  const { profile } = useAuth();
  const { settings } = useAppSettingsContext();
  
  const userRank = useMemo(() => getUserRank(profile?.rank_balance || 0), [profile?.rank_balance]);
  const isReseller = profile?.is_reseller || false;

  if (!products || products.length === 0) {
    return (
      <div className="w-full">
        <h2 className="text-lg font-bold text-foreground mb-4">Popular Products</h2>
        <div className="bg-card rounded-2xl h-48 flex flex-col items-center justify-center text-muted-foreground">
          <Package className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">No products available</p>
          <p className="text-xs mt-1">Check back later for new items</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-lg font-bold text-foreground mb-4">Popular Products</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            userRank={userRank}
            isReseller={isReseller}
            currencySymbol={settings.currency_symbol}
            appName={settings.app_name}
            onProductClick={onProductClick}
            onBuyClick={onBuyClick}
          />
        ))}
      </div>
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;
