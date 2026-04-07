import React from 'react';
import { ArrowLeft, Star, Share2, Heart, Edit, Tag, Package, Link as LinkIcon, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductVariationSelector, ProductFeatures } from '@/components/product';
import ShareButtons from '@/components/ShareButtons';
import AddToCartButton from '@/components/AddToCartButton';

interface ProductDetailUIProps {
  displayProduct: any;
  currentPrice: number;
  basePrice: number;
  savings: number;
  discountType: string;
  actualFlashSalePrice: number | null;
  formatPrice: (price: number) => string;
  profile: any;
  currentStock: number | null;
  isOutOfStock: boolean;
  variations: any[];
  selectedVariation: any;
  onSelectVariation: (v: any) => void;
  userRank: any;
  isReseller: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onShare: () => void;
  onEdit: () => void;
  isAdmin: boolean;
  isTempAdmin: boolean;
  settings: any;
}

export const ProductHeader: React.FC<Pick<ProductDetailUIProps, 'onBack' | 'isAdmin' | 'isTempAdmin' | 'onEdit' | 'isFavorite' | 'onToggleFavorite' | 'onShare'>> = ({
  onBack, isAdmin, isTempAdmin, onEdit, isFavorite, onToggleFavorite, onShare
}) => (
  <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
    <div className="max-w-lg mx-auto flex items-center justify-between">
      <button onClick={onBack} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
      <h1 className="text-lg font-bold">Product Details</h1>
      <div className="flex items-center gap-1">
        {(isAdmin || isTempAdmin) && (
          <button onClick={onEdit} className="p-2 bg-primary/10 rounded-lg"><Edit className="w-5 h-5 text-primary" /></button>
        )}
        <button onClick={onToggleFavorite} className="p-2">
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
        <button onClick={onShare} className="p-2"><Share2 className="w-5 h-5" /></button>
      </div>
    </div>
  </header>
);

export const ProductImage: React.FC<Pick<ProductDetailUIProps, 'displayProduct' | 'currentPrice' | 'basePrice' | 'savings' | 'discountType' | 'actualFlashSalePrice' | 'formatPrice' | 'profile'>> = ({
  displayProduct, currentPrice, basePrice, savings, discountType, actualFlashSalePrice, formatPrice, profile
}) => (
  <div className="relative overflow-hidden">
    <img src={displayProduct.image_url || displayProduct.image || 'https://via.placeholder.com/400'} alt={displayProduct.name} className="w-full h-80 object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    <div className="absolute bottom-4 left-4 right-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-primary">{formatPrice(currentPrice)}</span>
              {!actualFlashSalePrice && savings > 0 && <span className="text-sm text-muted-foreground line-through">{formatPrice(basePrice)}</span>}
              {actualFlashSalePrice && basePrice > actualFlashSalePrice && <span className="text-sm text-muted-foreground line-through">{formatPrice(basePrice)}</span>}
            </div>
            {!actualFlashSalePrice && savings > 0 && profile && (
              <div className="flex items-center gap-1 mt-1">
                <Tag className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-600 font-medium">{discountType} - {formatPrice(savings)} saved</span>
              </div>
            )}
            {actualFlashSalePrice && (
              <div className="flex items-center gap-1 mt-1">
                <Tag className="w-3 h-3 text-orange-600" />
                <span className="text-xs text-orange-600 font-medium">Flash Sale - {formatPrice(basePrice - actualFlashSalePrice)} saved</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-lg">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-yellow-700">{displayProduct.rating || 4.5}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ProductInfo: React.FC<Pick<ProductDetailUIProps, 'displayProduct' | 'currentStock' | 'isOutOfStock' | 'variations' | 'selectedVariation' | 'onSelectVariation' | 'userRank' | 'isReseller'>> = ({
  displayProduct, currentStock, isOutOfStock, variations, selectedVariation, onSelectVariation, userRank, isReseller
}) => (
  <div className="px-4 py-6 space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-foreground">{displayProduct.name}</h1>
      <div className="flex items-center gap-3 mt-2">
        <Badge variant="secondary" className="text-xs">{displayProduct.category}</Badge>
        <span className="text-sm text-muted-foreground">{displayProduct.sold_count || 0} sold</span>
        {currentStock !== null && (
          <span className={`text-sm font-medium flex items-center gap-1 ${isOutOfStock ? 'text-destructive' : currentStock <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
            <Package className="w-4 h-4" />
            {isOutOfStock ? 'Out of Stock' : currentStock <= 5 ? `Only ${currentStock} left!` : `${currentStock} available`}
          </span>
        )}
      </div>
    </div>
    <ProductVariationSelector variations={variations} selectedVariation={selectedVariation} onSelect={onSelectVariation} userRank={userRank} isReseller={isReseller} />
    {displayProduct.description && (
      <div className="bg-muted/50 rounded-2xl p-4">
        <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full"></span>About this product
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{displayProduct.description}</p>
      </div>
    )}
    <ProductFeatures />
  </div>
);

export const ProductBottomBar: React.FC<{ displayProduct: any; currentPrice: number; formatPrice: (p: number) => string; settings: any; selectedVariation: any; isOutOfStock: boolean; isReseller?: boolean; onResell?: () => void }> = ({
  displayProduct, currentPrice, formatPrice, settings, selectedVariation, isOutOfStock, isReseller, onResell
}) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buyingNow, setBuyingNow] = React.useState(false);

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate('/auth'); return; }
    setBuyingNow(true);
    const success = await addToCart(displayProduct.id, selectedVariation?.id, 1);
    setBuyingNow(false);
    if (success) {
      navigate('/cart?checkout=1');
    }
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 glass border-t border-border p-4">
      <div className="max-w-lg mx-auto flex items-center gap-2">
        <ShareButtons text={`Check out ${displayProduct?.name} at ${settings.app_name}! Only ${formatPrice(currentPrice)}`} url={`${settings.app_url}/product/${displayProduct?.slug || displayProduct?.id}`} size="sm" />
        {isReseller && onResell ? (
          <button
            onClick={onResell}
            className="flex-1 h-12 bg-accent text-accent-foreground rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <LinkIcon className="w-5 h-5" />
            Resell
          </button>
        ) : (
          <>
            <AddToCartButton productId={displayProduct.id} variationId={selectedVariation?.id} disabled={isOutOfStock} className="flex-1 h-12" />
            <Button
              onClick={handleBuyNow}
              disabled={isOutOfStock || buyingNow}
              className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
            >
              <Zap className="w-5 h-5 mr-1" />
              {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
