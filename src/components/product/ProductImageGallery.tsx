import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageGalleryProps {
  images: string[];
  name: string;
}

const isVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({ images, name }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const allImages = images.length > 0 ? images : ['https://via.placeholder.com/400'];

  const goTo = (idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(idx, allImages.length - 1)));
  };

  return (
    <div className="relative overflow-hidden">
      {/* Main Image/Video */}
      <div className="relative w-full h-80">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            {isVideo(allImages[currentIndex]) ? (
              <video
                src={allImages[currentIndex]}
                controls
                className="w-full h-full object-cover"
                poster=""
              />
            ) : (
              <img
                src={allImages[currentIndex]}
                alt={`${name} - ${currentIndex + 1}`}
                className="w-full h-full object-cover"
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Navigation Arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => goTo(currentIndex - 1)}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white transition-opacity",
                currentIndex === 0 ? 'opacity-30 pointer-events-none' : 'opacity-70 hover:opacity-100'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => goTo(currentIndex + 1)}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white transition-opacity",
                currentIndex === allImages.length - 1 ? 'opacity-30 pointer-events-none' : 'opacity-70 hover:opacity-100'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  idx === currentIndex
                    ? 'bg-white w-4'
                    : 'bg-white/50 hover:bg-white/70'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      {allImages.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
          {allImages.map((url, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={cn(
                "w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                idx === currentIndex ? 'border-primary ring-1 ring-primary/30' : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              {isVideo(url) ? (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Play className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <img src={url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;
