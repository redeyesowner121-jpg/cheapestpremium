import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Share2, Download, Tag, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { toast } from 'sonner';
import { Product } from './types';

const getNewTagLabel = (createdAt?: string): string | null => {
  if (!createdAt) return null;
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours > 72) return null;
  if (diffHours < 1) return 'NEW • Just now';
  if (diffHours < 24) return `NEW • ${Math.floor(diffHours)}h ago`;
  return `NEW • ${Math.floor(diffHours / 24)}d ago`;
};

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { profile } = useAuth();
  const { settings } = useAppSettingsContext();
  const { formatPrice } = useCurrencyFormat();
  const navigate = useNavigate();

  const productForDetail = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    originalPrice: product.original_price,
    image: product.image_url,
    image_url: product.image_url,
    rating: product.rating || 4.5,
    soldCount: product.sold_count || 0,
    sold_count: product.sold_count || 0,
    category: product.category,
    access_link: product.access_link,
    reseller_price: product.reseller_price,
    stock: (product as any).stock,
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const appDomain = settings.app_url;
    const shareUrl = `${appDomain}/product/${(product as any).slug || product.id}`;
    const shareText = `Check out ${product.name} at ${settings.app_name} for just ${formatPrice(product.price)}!`;

    if (navigator.share) {
      navigator.share({ title: product.name, text: shareText, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Link copied to clipboard!');
    }
  };

  return (
    <div
      onClick={() => navigate(`/product/${(product as any).slug || product.id}`, { state: { product: productForDetail } })}
      className="bg-card rounded-2xl overflow-hidden shadow-card active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="relative">
        <img
          src={product.image_url || 'https://via.placeholder.com/200'}
          alt={product.name}
          className="w-full h-28 object-cover"
          loading="lazy"
        />
        {(() => {
          const newLabel = getNewTagLabel(product.created_at);
          return newLabel ? (
            <div className="absolute top-2 left-2 bg-emerald-500 px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
              <Sparkles className="w-2.5 h-2.5 text-white" />
              <span className="text-[9px] font-bold text-white">{newLabel}</span>
            </div>
          ) : product.original_price && product.original_price > product.price ? (
            <div className="absolute top-2 left-2 gradient-accent px-2 py-0.5 rounded-full">
              <span className="text-[10px] font-bold text-accent-foreground">
                -{Math.round(((product.original_price - product.price) / product.original_price) * 100)}%
              </span>
            </div>
          ) : null;
        })()}
        <button
          onClick={handleShare}
          className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full"
        >
          <Share2 className="w-3.5 h-3.5 text-foreground" />
        </button>
        {product.price === 0 && (
          <div className="absolute bottom-2 left-2 gradient-success px-2 py-0.5 rounded-full">
            <span className="text-[10px] font-bold text-success-foreground">FREE</span>
          </div>
        )}
        {product.access_link && (
          <div className="absolute bottom-2 right-2 bg-success/90 px-2 py-0.5 rounded-full">
            <span className="text-[10px] font-bold text-success-foreground flex items-center gap-0.5">
              <Download className="w-3 h-3" />
              Instant
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm text-foreground truncate">{product.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{product.description}</p>

        <div className="flex items-center gap-1 mt-1.5">
          <Star className="w-3 h-3 text-accent fill-accent" />
          <span className="text-xs text-foreground font-medium">{product.rating || 4.5}</span>
          <span className="text-xs text-muted-foreground">({product.sold_count || 0})</span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div>
            {product.price === 0 ? (
              <span className="text-success font-bold">Free</span>
            ) : (
              (() => {
                const userRank = getUserRank(profile?.rank_balance || 0);
                const isReseller = profile?.is_reseller || false;
                const { finalPrice, savings } = calculateFinalPrice(
                  product.price,
                  product.reseller_price || null,
                  userRank,
                  isReseller
                );
                const hasRankDiscount = savings > 0;
                return (
                  <>
                    <span className="text-primary font-bold">{formatPrice(finalPrice)}</span>
                    {(hasRankDiscount || (product.original_price && product.original_price > product.price)) && (
                      <span className="text-xs text-muted-foreground line-through ml-1">
                        {formatPrice(hasRankDiscount ? product.price : (product.original_price || 0))}
                      </span>
                    )}
                    {hasRankDiscount && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Tag className="w-2.5 h-2.5 text-green-600" />
                        <span className="text-[9px] text-green-600">{userRank.icon}</span>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
