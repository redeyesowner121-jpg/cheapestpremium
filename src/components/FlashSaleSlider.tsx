import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { motion } from 'framer-motion';
import { Clock, Zap, ShoppingBag } from 'lucide-react';
import 'swiper/css';

interface FlashSaleItem {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  image: string;
  endTime: number;
}

interface FlashSaleSliderProps {
  items?: FlashSaleItem[];
  onItemClick?: (item: FlashSaleItem) => void;
}

const FlashSaleSlider: React.FC<FlashSaleSliderProps> = ({ 
  items,
  onItemClick 
}) => {
  const calculateDiscount = (original: number, sale: number) => {
    return Math.round(((original - sale) / original) * 100);
  };

  // If no flash sales from database, show empty state
  if (!items || items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 gradient-accent rounded-xl">
              <Zap className="w-5 h-5 text-accent-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Flash Sale</h2>
          </div>
        </div>
        <div className="bg-card rounded-2xl h-32 flex flex-col items-center justify-center text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">No flash sales right now</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
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
        {items.map((item) => (
          <SwiperSlide key={item.id}>
            <motion.div
              onClick={() => onItemClick?.(item)}
              className="bg-card rounded-2xl overflow-hidden shadow-card card-hover cursor-pointer"
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute top-2 right-2 gradient-accent px-2 py-0.5 rounded-full">
                  <span className="text-xs font-bold text-accent-foreground">
                    -{calculateDiscount(item.originalPrice, item.salePrice)}%
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm text-foreground truncate">{item.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-primary font-bold">₹{item.salePrice}</span>
                  <span className="text-xs text-muted-foreground line-through">
                    ₹{item.originalPrice}
                  </span>
                </div>
              </div>
            </motion.div>
          </SwiperSlide>
        ))}
      </Swiper>
    </motion.div>
  );
};

export default FlashSaleSlider;
