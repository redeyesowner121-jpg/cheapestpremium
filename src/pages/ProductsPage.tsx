import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  SlidersHorizontal,
  Star,
  Share2,
  ShoppingCart,
  Heart,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  soldCount: number;
  category: string;
  hasAccessLink?: boolean;
  accessLink?: string;
}

const allProducts: Product[] = [
  { id: '1', name: 'Netflix Premium 1 Month', description: 'Ultra HD, 4 Screens', price: 79, originalPrice: 199, image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400', rating: 4.8, soldCount: 1250, category: 'ott' },
  { id: '2', name: 'Spotify Premium', description: 'Ad-free music streaming', price: 29, originalPrice: 119, image: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400', rating: 4.9, soldCount: 2340, category: 'music' },
  { id: '3', name: 'ChatGPT Plus', description: 'GPT-4 Access', price: 399, originalPrice: 1650, image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400', rating: 4.7, soldCount: 890, category: 'tools' },
  { id: '4', name: 'Canva Pro', description: 'Design tools unlimited', price: 99, originalPrice: 999, image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400', rating: 4.6, soldCount: 567, category: 'tools' },
  { id: '5', name: 'YouTube Premium', description: 'Ad-free videos + Music', price: 49, originalPrice: 179, image: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400', rating: 4.8, soldCount: 3420, category: 'ott' },
  { id: '6', name: 'Amazon Prime', description: 'Video + Shopping Benefits', price: 149, originalPrice: 299, image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=400', rating: 4.5, soldCount: 1890, category: 'ott' },
  { id: '7', name: 'Discord Nitro', description: 'Premium Discord features', price: 199, originalPrice: 449, image: 'https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?w=400', rating: 4.4, soldCount: 678, category: 'gaming' },
  { id: '8', name: 'Xbox Game Pass', description: '100+ games included', price: 299, originalPrice: 699, image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=400', rating: 4.7, soldCount: 456, category: 'gaming' },
  { id: '9', name: 'Coursera Plus', description: 'Unlimited learning', price: 499, originalPrice: 2999, image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=400', rating: 4.6, soldCount: 234, category: 'education' },
  { id: '10', name: 'Google One 100GB', description: 'Cloud storage', price: 130, originalPrice: 180, image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400', rating: 4.5, soldCount: 890, category: 'cloud' },
  { id: '11', name: 'Free Trading Course', description: 'Learn stock trading', price: 0, image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400', rating: 4.3, soldCount: 5670, category: 'free', hasAccessLink: true, accessLink: 'https://example.com/course' },
  { id: '12', name: 'Refer & Earn', description: 'Earn by referring friends', price: 0, image: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400', rating: 4.9, soldCount: 12340, category: 'earning' },
];

const categories = [
  { id: 'all', name: 'All' },
  { id: 'ott', name: 'OTT' },
  { id: 'music', name: 'Music' },
  { id: 'gaming', name: 'Gaming' },
  { id: 'tools', name: 'Tools' },
  { id: 'education', name: 'Education' },
  { id: 'cloud', name: 'Cloud' },
  { id: 'free', name: 'Free' },
  { id: 'earning', name: 'Earning' },
];

const ProductsPage: React.FC = () => {
  const { userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState('');

  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBuy = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setOrderNote('');
    setShowBuyModal(true);
  };

  const handleConfirmOrder = () => {
    if (!userData) {
      toast.error('Please login to place order');
      return;
    }

    const totalPrice = (selectedProduct?.price || 0) * quantity;
    
    if ((userData.walletBalance || 0) < totalPrice) {
      toast.error('Insufficient wallet balance');
      return;
    }

    toast.success('Order placed successfully!');
    setShowBuyModal(false);
  };

  const handleShare = (product: Product) => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} at RKR Premium Store for just ₹${product.price}!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-4"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-12 h-12 rounded-xl bg-card border-0 shadow-card"
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2">
            <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 -mx-4 px-4 overflow-x-auto no-scrollbar"
        >
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'gradient-primary text-primary-foreground shadow-card'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.03 }}
              className="bg-card rounded-2xl overflow-hidden shadow-card card-hover"
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
                  onClick={() => handleShare(product)}
                  className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full"
                >
                  <Share2 className="w-3.5 h-3.5 text-foreground" />
                </button>
                {product.price === 0 && (
                  <div className="absolute bottom-2 left-2 gradient-success px-2 py-0.5 rounded-full">
                    <span className="text-[10px] font-bold text-success-foreground">FREE</span>
                  </div>
                )}
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
                    {product.price === 0 ? (
                      <span className="text-success font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-primary font-bold">₹{product.price}</span>
                        {product.originalPrice && (
                          <span className="text-xs text-muted-foreground line-through ml-1">
                            ₹{product.originalPrice}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs btn-gradient rounded-lg"
                    onClick={() => handleBuy(product)}
                  >
                    {product.price === 0 ? 'Get' : 'Buy'}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No products found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </main>

      {/* Buy Modal */}
      <Dialog open={showBuyModal} onOpenChange={setShowBuyModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
            <DialogDescription>
              Review your order before placing
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-semibold text-foreground">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
                  <p className="text-primary font-bold mt-1">
                    ₹{selectedProduct.price} each
                  </p>
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <span className="font-medium text-foreground">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg bg-card flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="font-bold text-foreground w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-lg bg-card flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Order Note */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Note for Admin (Optional)
                </label>
                <Textarea
                  placeholder="Any special instructions..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="rounded-xl"
                  rows={3}
                />
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-4 gradient-primary rounded-xl">
                <span className="font-medium text-primary-foreground">Total</span>
                <span className="text-2xl font-bold text-primary-foreground">
                  ₹{selectedProduct.price * quantity}
                </span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Processing may take up to 24 hours
              </p>

              <Button
                className="w-full h-12 btn-gradient rounded-xl"
                onClick={handleConfirmOrder}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Place Order
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default ProductsPage;
