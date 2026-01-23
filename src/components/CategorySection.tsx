import React, { memo, useMemo } from 'react';
import { Star, Share2, Tag, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
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
  reseller_price?: number;
}

interface CategorySectionProps {
  title: string;
  icon: React.ReactNode;
  products: Product[];
  onProductClick: (product: Product) => void;
  onViewAll: () => void;
  bgColor?: string;
  accentColor?: string;
}

const CategoryProductCard = memo<{
  product: Product;
  userRank: ReturnType<typeof getUserRank>;
  isReseller: boolean;
  onClick: () => void;
}>(({ product, userRank, isReseller, onClick }) => {
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
      onClick={onClick}
      className="flex-shrink-0 w-36 bg-card rounded-xl overflow-hidden shadow-card active:scale-[0.98] transition-transform cursor-pointer"
    >
      <img
        src={product.image}
        alt={product.name}
        className="w-full h-20 object-cover"
        loading="lazy"
      />
      <div className="p-2">
        <h4 className="font-medium text-xs text-foreground truncate">{product.name}</h4>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-2.5 h-2.5 text-accent fill-accent" />
          <span className="text-[10px] text-muted-foreground">{product.rating}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div>
            <span className="text-primary font-bold text-sm">₹{Math.round(priceInfo.finalPrice)}</span>
            {priceInfo.hasRankDiscount && (
              <span className="text-[10px] text-muted-foreground line-through ml-1">₹{product.price}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

CategoryProductCard.displayName = 'CategoryProductCard';

const CategorySection: React.FC<CategorySectionProps> = memo(({
  title,
  icon,
  products,
  onProductClick,
  onViewAll,
  bgColor = 'bg-gradient-to-r from-orange-50 to-amber-50',
  accentColor = 'text-orange-600'
}) => {
  const { profile } = useAuth();
  const userRank = useMemo(() => getUserRank(profile?.rank_balance || 0), [profile?.rank_balance]);
  const isReseller = profile?.is_reseller || false;

  if (products.length === 0) return null;

  return (
    <div className={`w-full rounded-2xl p-4 ${bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-white/80 ${accentColor}`}>
            {icon}
          </div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        <button 
          onClick={onViewAll}
          className={`flex items-center gap-1 text-sm font-medium ${accentColor}`}
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {products.slice(0, 6).map((product) => (
          <CategoryProductCard
            key={product.id}
            product={product}
            userRank={userRank}
            isReseller={isReseller}
            onClick={() => onProductClick(product)}
          />
        ))}
      </div>
    </div>
  );
});

CategorySection.displayName = 'CategorySection';

export default CategorySection;
