import React, { memo, useCallback, useMemo } from 'react';
import { Star, Share2, Package, Tag, Sparkles, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import AddToCartButton from '@/components/AddToCartButton';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';

const getNewTagLabel = (createdAt?: string): string | null => {
  if (!createdAt) return null;
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours > 72) return null;
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

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
  created_at?: string;
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
  formatPrice: (inrAmount: number, decimals?: number) => string;
  onProductClick?: (product: Product) => void;
  onBuyClick?: (product: Product) => void;
}>(({ product, userRank, isReseller, currencySymbol, appName, formatPrice, onProductClick, onBuyClick }) => {
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const productUrl = `${window.location.origin}/product/${(product as any).slug || product.id}`;
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} at ${appName}! Only ${formatPrice(product.price)}`,
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
  }, [product, appName, formatPrice]);

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
      className="bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover active:scale-[0.97] transition-all duration-300 cursor-pointer group"
    >
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        {(() => {
          const newLabel = getNewTagLabel(product.created_at);
          return newLabel ? (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-colored-success">
              <Sparkles className="w-2.5 h-2.5 text-white" />
              <span className="text-[9px] font-extrabold text-white tracking-wide uppercase">{newLabel}</span>
            </div>
          ) : product.originalPrice ? (
            <div className="absolute top-2 left-2 gradient-accent px-2.5 py-1 rounded-full shadow-colored-accent">
              <span className="text-[10px] font-extrabold text-accent-foreground tracking-wide">
                -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
              </span>
            </div>
          ) : null;
        })()}
        <button
          onClick={handleShare}
          className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
        >
          <Share2 className="w-3.5 h-3.5 text-foreground" />
        </button>
      </div>
      
      <div className="p-3">
        <h3 className="font-bold text-sm text-foreground truncate font-display tracking-tight">{product.name}</h3>
        
        <div className="flex items-center gap-1 mt-1.5">
          <Star className="w-3.5 h-3.5 text-accent fill-accent" />
          <span className="text-[11px] text-foreground font-bold">{product.rating}</span>
          <span className="text-[10px] text-muted-foreground font-medium">({product.soldCount} sold)</span>
        </div>
        
        <div className="flex items-center justify-between mt-2.5">
          <div>
            <span className="text-primary font-extrabold text-base font-display tracking-tight">{formatPrice(priceInfo.finalPrice)}</span>
            {(priceInfo.hasRankDiscount || product.originalPrice) && (
              <span className="text-[10px] text-muted-foreground line-through ml-1 font-medium">
                {formatPrice(priceInfo.hasRankDiscount ? product.price : (product.originalPrice || 0))}
              </span>
            )}
            {priceInfo.hasRankDiscount && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Tag className="w-2.5 h-2.5 text-success" />
                <span className="text-[9px] text-success font-bold">{userRank.icon}</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="h-8 px-4 text-xs btn-gradient rounded-xl font-bold tracking-wide"
            onClick={(e) => {
              e.stopPropagation();
              onBuyClick?.(product);
            }}
          >
            Buy
          </Button>
          <AddToCartButton productId={product.id} size="sm" />
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
  const { formatPrice } = useCurrencyFormat();
  
  const userRank = useMemo(() => getUserRank(profile?.rank_balance || 0), [profile?.rank_balance]);
  const isReseller = profile?.is_reseller || false;

  if (!products || products.length === 0) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-1.5 gradient-warm rounded-lg shadow-colored-accent">
            <Flame className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-foreground font-display tracking-tight">Popular Products</h2>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Trending Now</p>
          </div>
        </div>
        <div className="rounded-2xl h-48 flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(250 89% 63% / 0.1) 0%, hsl(280 80% 58% / 0.1) 100%)' }}>
          <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-primary/10 blur-2xl" />
          <Package className="w-12 h-12 mb-3 text-primary/30" />
          <p className="text-sm font-bold text-foreground">No products available</p>
          <p className="text-xs mt-1 text-muted-foreground font-medium">Check back later for new items</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-1.5 gradient-warm rounded-lg shadow-colored-accent">
          <Flame className="w-4 h-4 text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-foreground font-display tracking-tight">
            Popular Products
          </h2>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Trending Now</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            userRank={userRank}
            isReseller={isReseller}
            currencySymbol={settings.currency_symbol}
            appName={settings.app_name}
            formatPrice={formatPrice}
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
