import React, { useEffect, useState, memo, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { Clock, Zap, ShoppingBag, Ticket, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import 'swiper/css';

interface FlashSaleItem {
  id: string;
  productId?: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  image: string;
  endTime: number;
  productData?: any;
  variationName?: string | null;
}

interface FlashSaleCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  flash_sale_id: string;
}

interface FlashSaleSliderProps {
  items?: FlashSaleItem[];
  onItemClick?: (item: FlashSaleItem) => void;
}

const FlashSaleSlider: React.FC<FlashSaleSliderProps> = memo(({ 
  items,
  onItemClick 
}) => {
  const [coupons, setCoupons] = useState<Record<string, FlashSaleCoupon>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { formatPrice } = useCurrencyFormat();

  useEffect(() => {
    if (items && items.length > 0) {
      loadFlashSaleCoupons();
    }
  }, [items]);

  const loadFlashSaleCoupons = async () => {
    if (!items) return;
    
    const flashSaleIds = items.map(item => item.id);
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .in('flash_sale_id', flashSaleIds)
      .eq('is_active', true);
    
    if (data) {
      const couponMap: Record<string, FlashSaleCoupon> = {};
      data.forEach(coupon => {
        if (coupon.flash_sale_id) {
          couponMap[coupon.flash_sale_id] = coupon;
        }
      });
      setCoupons(couponMap);
    }
  };

  const handleCopyCoupon = useCallback((e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon "${code}" copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const calculateDiscount = useCallback((original: number, sale: number) => {
    return Math.round(((original - sale) / original) * 100);
  }, []);

  if (!items || items.length === 0) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 gradient-accent rounded-xl">
              <Zap className="w-5 h-5 text-accent-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Flash Sale</h2>
          </div>
        </div>
        <div className="rounded-2xl h-32 flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(38 95% 54% / 0.12) 0%, hsl(15 90% 56% / 0.12) 100%)' }}>
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-accent/10 blur-2xl" />
          <ShoppingBag className="w-10 h-10 mb-2 text-accent/40" />
          <p className="text-sm text-muted-foreground font-medium">No flash sales right now</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 gradient-accent rounded-xl">
            <Zap className="w-5 h-5 text-accent-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Flash Sale</h2>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Limited Time</span>
        </div>
      </div>

      <Swiper
        modules={[Autoplay]}
        spaceBetween={12}
        slidesPerView={2.3}
        autoplay={{ delay: 3000, disableOnInteraction: false }}
        className="overflow-visible"
      >
        {items.map((item) => {
          const coupon = coupons[item.id];
          return (
            <SwiperSlide key={item.id}>
              <div
                onClick={() => onItemClick?.(item)}
                className="bg-card rounded-2xl overflow-hidden shadow-card active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 gradient-accent px-2 py-0.5 rounded-full">
                    <span className="text-xs font-bold text-accent-foreground">
                      -{calculateDiscount(item.originalPrice, item.salePrice)}%
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-foreground truncate">{item.name}</h3>
                  {item.variationName && (
                    <span className="inline-block mt-0.5 text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                      {item.variationName}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-primary font-bold">{formatPrice(item.salePrice)}</span>
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(item.originalPrice)}
                    </span>
                  </div>
                  
                  {coupon && (
                    <button
                      onClick={(e) => handleCopyCoupon(e, coupon.code)}
                      className="mt-2 w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg hover:from-amber-500/30 hover:to-orange-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <Ticket className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          {coupon.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80">
                          {coupon.discount_type === 'percentage' 
                            ? `${coupon.discount_value}% OFF` 
                            : `${formatPrice(coupon.discount_value)} OFF`}
                        </span>
                        {copiedCode === coupon.code ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
});

FlashSaleSlider.displayName = 'FlashSaleSlider';

export default FlashSaleSlider;
