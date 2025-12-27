import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, 
  SlidersHorizontal,
  Star,
  Share2,
  ShoppingCart,
  Filter,
  Download
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  rating: number;
  sold_count: number;
  category: string;
  access_link?: string;
}

interface ProductVariation {
  id: string;
  name: string;
  price: number;
}

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
  const { profile, user, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const flashSale = location.state?.flashSale;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashSalePrice, setFlashSalePrice] = useState<number | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  // Log search queries (debounced)
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (searchQuery.trim().length >= 2) {
      const timeout = setTimeout(async () => {
        const resultsCount = products.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).length;
        
        await supabase.from('search_logs').insert({
          user_id: user?.id || null,
          search_term: searchQuery.trim().toLowerCase(),
          results_count: resultsCount
        });
      }, 1000); // Log after 1 second of no typing
      
      setSearchTimeout(timeout);
    }
    
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchQuery, products, user]);

  // Handle flash sale click
  useEffect(() => {
    if (flashSale && flashSale.productData) {
      const product = {
        id: flashSale.productData.id,
        name: flashSale.productData.name,
        description: flashSale.productData.description || '',
        price: flashSale.salePrice,
        original_price: flashSale.productData.price,
        image_url: flashSale.productData.image_url,
        rating: flashSale.productData.rating || 4.5,
        sold_count: flashSale.productData.sold_count || 0,
        category: flashSale.productData.category,
        access_link: flashSale.productData.access_link
      };
      setSelectedProduct(product as Product);
      setFlashSalePrice(flashSale.salePrice);
      setShowBuyModal(true);
    }
  }, [flashSale]);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBuy = async (product: Product, salePrice?: number) => {
    setSelectedProduct(product);
    setFlashSalePrice(salePrice || null);
    setSelectedVariation(null);
    setQuantity(1);
    setOrderNote('');
    
    // Load variations for this product
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true);
    
    setProductVariations(data || []);
    setShowBuyModal(true);
  };

  const handleConfirmOrder = async () => {
    if (!profile || !user || !selectedProduct) {
      toast.error('Please login to place order');
      return;
    }

    if (!profile.phone) {
      toast.error('Please add your phone number to place an order');
      navigate('/profile/edit');
      return;
    }

    // Use variation price if selected, otherwise flash sale price or regular price
    const priceToUse = selectedVariation?.price || flashSalePrice || selectedProduct.price;
    const totalPrice = priceToUse * quantity;
    
    if ((profile.wallet_balance || 0) < totalPrice) {
      toast.error('Insufficient wallet balance. Please add money first.');
      return;
    }

    try {
      // Deduct from wallet
      const newBalance = (profile.wallet_balance || 0) - totalPrice;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ 
          wallet_balance: newBalance,
          total_orders: (profile.total_orders || 0) + 1
        })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      // Create order
      const productNameWithVariation = selectedVariation 
        ? `${selectedProduct.name} (${selectedVariation.name})`
        : selectedProduct.name;

      const { error: orderError } = await supabase.from('orders').insert({
        user_id: user.id,
        product_id: selectedProduct.id,
        product_name: productNameWithVariation,
        product_image: selectedProduct.image_url,
        quantity,
        unit_price: priceToUse,
        total_price: totalPrice,
        user_note: orderNote || null,
        access_link: selectedProduct.access_link || null,
        status: selectedProduct.access_link ? 'completed' : 'pending'
      });

      if (orderError) throw orderError;

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'purchase',
        amount: -totalPrice,
        status: 'completed',
        description: `Purchased ${productNameWithVariation} x${quantity}`
      });

      // Send notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Order Placed Successfully',
        message: `Your order for ${productNameWithVariation} has been placed.`,
        type: 'order'
      });

      toast.success('Order placed successfully!');
      setShowBuyModal(false);
      refreshProfile();
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    }
  };

  const handleShare = (product: Product) => {
    const shareText = `Check out ${product.name} at RKR Premium Store for just ₹${product.price}!`;
    const shareUrl = `${window.location.origin}/products?id=${product.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: shareText,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
                  src={product.image_url || 'https://via.placeholder.com/200'}
                  alt={product.name}
                  className="w-full h-28 object-cover"
                />
                {product.original_price && product.original_price > product.price && (
                  <div className="absolute top-2 left-2 gradient-accent px-2 py-0.5 rounded-full">
                    <span className="text-[10px] font-bold text-accent-foreground">
                      -{Math.round(((product.original_price - product.price) / product.original_price) * 100)}%
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
                {product.access_link && (
                  <div className="absolute bottom-2 right-2 bg-success/90 px-2 py-0.5 rounded-full">
                    <span className="text-[10px] font-bold text-white flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      Instant
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3">
                <h3 className="font-semibold text-sm text-foreground truncate">{product.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{product.description}</p>

                <div className="flex items-center gap-1 mt-1.5">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  <span className="text-xs text-foreground font-medium">{product.rating || 4.5}</span>
                  <span className="text-xs text-muted-foreground">({product.sold_count || 0})</span>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div>
                    {product.price === 0 ? (
                      <span className="text-success font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-primary font-bold">₹{product.price}</span>
                        {product.original_price && product.original_price > product.price && (
                          <span className="text-xs text-muted-foreground line-through ml-1">
                            ₹{product.original_price}
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
                  src={selectedProduct.image_url || 'https://via.placeholder.com/80'}
                  alt={selectedProduct.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-semibold text-foreground">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
                  <div className="mt-1">
                    {flashSalePrice ? (
                      <div className="flex items-center gap-2">
                        <p className="text-primary font-bold">₹{flashSalePrice} each</p>
                        <span className="text-xs text-muted-foreground line-through">₹{selectedProduct.original_price || selectedProduct.price}</span>
                        <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">FLASH SALE</span>
                      </div>
                    ) : (
                      <p className="text-primary font-bold">₹{selectedProduct.price} each</p>
                    )}
                  </div>
                  {selectedProduct.access_link && (
                    <p className="text-xs text-success flex items-center gap-1 mt-1">
                      <Download className="w-3 h-3" />
                      Instant access after purchase
                    </p>
                  )}
                </div>
              </div>

              {/* Product Variations */}
              {productVariations.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Select Variation
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedVariation(null)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        !selectedVariation
                          ? 'gradient-primary text-primary-foreground'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      Default - ₹{flashSalePrice || selectedProduct.price}
                    </button>
                    {productVariations.map((variation) => (
                      <button
                        key={variation.id}
                        onClick={() => setSelectedVariation(variation)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedVariation?.id === variation.id
                            ? 'gradient-primary text-primary-foreground'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                      >
                        {variation.name} - ₹{variation.price}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                  placeholder="Any special instructions, email for delivery, etc..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="rounded-xl"
                  rows={3}
                />
              </div>

              {/* Wallet Balance */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm text-muted-foreground">Your Balance</span>
                <span className="font-bold text-foreground">₹{profile?.wallet_balance?.toFixed(2) || '0.00'}</span>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-4 gradient-primary rounded-xl">
                <span className="font-medium text-primary-foreground">Total</span>
                <span className="text-2xl font-bold text-primary-foreground">
                  ₹{(selectedVariation?.price || flashSalePrice || selectedProduct.price) * quantity}
                </span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {selectedProduct.access_link 
                  ? '✓ Instant access will be available after purchase'
                  : '⏱ Processing may take up to 24 hours'
                }
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
