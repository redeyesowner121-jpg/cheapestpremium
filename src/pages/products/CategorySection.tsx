import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, LucideIcon } from 'lucide-react';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { Product } from './types';

interface CategorySectionProps {
  title: string;
  icon: LucideIcon;
  iconColorClass: string;
  gradientClass: string;
  categoryId: string;
  products: Product[];
  onCategorySelect: (cat: string) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  title, icon: Icon, iconColorClass, gradientClass, categoryId, products, onCategorySelect
}) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrencyFormat();

  if (products.length === 0) return null;

  return (
    <div className={`rounded-2xl p-4 ${gradientClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-white/80 ${iconColorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        <button
          onClick={() => onCategorySelect(categoryId)}
          className={`flex items-center gap-1 text-sm font-medium ${iconColorClass}`}
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {products.map((product) => {
          const productForDetail = {
            ...product,
            image: product.image_url,
            soldCount: product.sold_count || 0,
            originalPrice: product.original_price,
          };
          return (
            <div
              key={product.id}
              onClick={() => navigate(`/product/${product.id}`, { state: { product: productForDetail } })}
              className="flex-shrink-0 w-36 bg-card rounded-xl overflow-hidden shadow-card active:scale-[0.98] transition-transform cursor-pointer"
            >
              <img src={product.image_url} alt={product.name} className="w-full h-20 object-cover" loading="lazy" />
              <div className="p-2">
                <h4 className="font-medium text-xs text-foreground truncate">{product.name}</h4>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                  <span className="text-[10px] text-muted-foreground">{product.rating}</span>
                </div>
                <span className="text-primary font-bold text-sm">{formatPrice(product.price)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySection;
