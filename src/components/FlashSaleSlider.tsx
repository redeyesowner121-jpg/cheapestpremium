import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { motion } from 'framer-motion';
import { Clock, Zap } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/pagination';

interface FlashSaleItem {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  image: string;
  endTime: number;
}

const defaultFlashSales: FlashSaleItem[] = [
  {
    id: '1',
    name: 'Netflix Premium',
    originalPrice: 199,
    salePrice: 49,
    image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&h=300&fit=crop',
    endTime: Date.now() + 86400000,
  },
  {
    id: '2',
    name: 'Spotify Premium',
    originalPrice: 119,
    salePrice: 29,
    image: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=300&h=300&fit=crop',
    endTime: Date.now() + 86400000,
  },
  {
    id: '3',
    name: 'YouTube Premium',
    originalPrice: 179,
    salePrice: 39,
    image: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=300&h=300&fit=crop',
    endTime: Date.now() + 86400000,
  },
  {
    id: '4',
    name: 'Amazon Prime',
    originalPrice: 299,
    salePrice: 99,
    image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=300&h=300&fit=crop',
    endTime: Date.now() + 86400000,
  },
];

interface FlashSaleSliderProps {
  items?: FlashSaleItem[];
  onItemClick?: (item: FlashSaleItem) => void;
}

const FlashSaleSlider: React.FC<FlashSaleSliderProps> = ({ 
  items = defaultFlashSales,
  onItemClick 
}) => {
  const calculateDiscount = (original: number, sale: number) => {
    return Math.round(((original - sale) / original) * 100);
  };

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
          <span>Ends in 24h</span>
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
