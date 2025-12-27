import React from 'react';
import { motion } from 'framer-motion';
import { Star, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  soldCount: number;
  category?: string;
  hasAccessLink?: boolean;
}

const defaultProducts: Product[] = [
  {
    id: '1',
    name: 'Netflix Premium 1 Month',
    description: 'Ultra HD, 4 Screens',
    price: 79,
    originalPrice: 199,
    image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=400&fit=crop',
    rating: 4.8,
    soldCount: 1250,
    category: 'ott',
  },
  {
    id: '2',
    name: 'Spotify Premium',
    description: 'Ad-free music streaming',
    price: 29,
    originalPrice: 119,
    image: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=400&fit=crop',
    rating: 4.9,
    soldCount: 2340,
    category: 'music',
  },
  {
    id: '3',
    name: 'ChatGPT Plus',
    description: 'GPT-4 Access',
    price: 399,
    originalPrice: 1650,
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop',
    rating: 4.7,
    soldCount: 890,
    category: 'tools',
  },
  {
    id: '4',
    name: 'Canva Pro',
    description: 'Design tools unlimited',
    price: 99,
    originalPrice: 999,
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop',
    rating: 4.6,
    soldCount: 567,
    category: 'tools',
  },
  {
    id: '5',
    name: 'YouTube Premium',
    description: 'Ad-free videos + Music',
    price: 49,
    originalPrice: 179,
    image: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=400&fit=crop',
    rating: 4.8,
    soldCount: 3420,
    category: 'ott',
  },
  {
    id: '6',
    name: 'Amazon Prime',
    description: 'Video + Shopping Benefits',
    price: 149,
    originalPrice: 299,
    image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=400&h=400&fit=crop',
    rating: 4.5,
    soldCount: 1890,
    category: 'ott',
  },
];

interface ProductGridProps {
  products?: Product[];
  onProductClick?: (product: Product) => void;
  onBuyClick?: (product: Product) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ 
  products = defaultProducts,
  onProductClick,
  onBuyClick
}) => {
  const handleShare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} at RKR Premium Store!`,
        url: window.location.href,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <h2 className="text-lg font-bold text-foreground mb-4">Popular Products</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            onClick={() => onProductClick?.(product)}
            className="bg-card rounded-2xl overflow-hidden shadow-card card-hover cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-28 object-cover"
              />
              {product.originalPrice && (
                <div className="absolute top-2 left-2 gradient-accent px-2 py-0.5 rounded-full">
                  <span className="text-[10px] font-bold text-accent-foreground">
                    -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                  </span>
                </div>
              )}
              <button
                onClick={(e) => handleShare(e, product)}
                className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full"
              >
                <Share2 className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>
            
            <div className="p-3">
              <h3 className="font-semibold text-sm text-foreground truncate">{product.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{product.description}</p>
              
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="w-3 h-3 text-accent fill-accent" />
                <span className="text-xs text-foreground font-medium">{product.rating}</span>
                <span className="text-xs text-muted-foreground">({product.soldCount})</span>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div>
                  <span className="text-primary font-bold">₹{product.price}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through ml-1">
                      ₹{product.originalPrice}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs btn-gradient rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBuyClick?.(product);
                  }}
                >
                  Buy
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ProductGrid;
