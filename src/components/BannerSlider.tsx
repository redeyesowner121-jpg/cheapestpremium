import React, { memo, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
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

const BannerSlider: React.FC<BannerSliderProps> = memo(({ banners }) => {
  const handleBannerClick = useCallback((link?: string) => {
    if (link) {
      if (link.startsWith('http')) {
        window.open(link, '_blank');
      } else {
        window.location.href = link;
      }
    }
  }, []);

  if (!banners || banners.length === 0) {
    return (
      <div className="w-full">
        <div className="bg-card rounded-2xl h-40 md:h-52 flex flex-col items-center justify-center text-muted-foreground">
          <ImageOff className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">No banners available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
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
            <div 
              className="relative h-40 md:h-52 cursor-pointer"
              onClick={() => handleBannerClick(banner.link)}
            >
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white font-bold text-lg">{banner.title}</h3>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
});

BannerSlider.displayName = 'BannerSlider';

export default BannerSlider;
