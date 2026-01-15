import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProductImageSectionProps {
  imageUrl: string;
  name: string;
  flashSale?: boolean;
  originalPrice?: number;
  currentPrice?: number;
  isOutOfStock: boolean;
  rating: number;
  savings: number;
  discountType: string;
  hasProfile: boolean;
}

const ProductImageSection: React.FC<ProductImageSectionProps> = ({
  imageUrl,
  name,
  flashSale,
  originalPrice,
  currentPrice,
  isOutOfStock,
  rating,
  savings,
  discountType,
  hasProfile,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative overflow-hidden"
    >
      <motion.img
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5 }}
        src={imageUrl || 'https://via.placeholder.com/400'}
        alt={name}
        className="w-full h-80 object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      
      {/* Badges */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        {flashSale && (
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="gradient-accent px-3 py-1.5 rounded-full shadow-lg"
          >
            <span className="text-sm font-bold text-accent-foreground">⚡ Flash Sale!</span>
          </motion.div>
        )}
        {originalPrice && !flashSale && currentPrice && (
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-destructive px-3 py-1.5 rounded-full shadow-lg"
          >
            <span className="text-sm font-bold text-destructive-foreground">
              -{Math.round(((originalPrice - currentPrice) / originalPrice) * 100)}% OFF
            </span>
          </motion.div>
        )}
      </div>
      
      {isOutOfStock && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-4 right-4"
        >
          <Badge variant="destructive" className="text-sm font-bold px-3 py-1.5 shadow-lg">
            <AlertCircle className="w-4 h-4 mr-1" />
            Out of Stock
          </Badge>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProductImageSection;
