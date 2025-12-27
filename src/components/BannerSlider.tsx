import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { motion } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/pagination';

interface Banner {
  id: string;
  image: string;
  title: string;
  link?: string;
}

interface BannerSliderProps {
  banners?: Banner[];
}

const BannerSlider: React.FC<BannerSliderProps> = ({ banners }) => {
  // If no banners from database, show empty state
  if (!banners || banners.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <div className="bg-card rounded-2xl h-40 md:h-52 flex flex-col items-center justify-center text-muted-foreground">
          <ImageOff className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">No banners available</p>
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
      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={16}
        slidesPerView={1}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        className="rounded-2xl overflow-hidden shadow-card"
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.id}>
            <div className="relative h-40 md:h-52">
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white font-bold text-lg">{banner.title}</h3>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </motion.div>
  );
};

export default BannerSlider;
