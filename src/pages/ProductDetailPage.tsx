import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Star, 
  Share2, 
  ShoppingCart, 
  Heart,
  Package,
  Shield,
  Truck,
  MessageCircle,
  AlertCircle,
  Edit,
  Check,
  Tag
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BottomNav from '@/components/BottomNav';
import OrderSuccessModal from '@/components/OrderSuccessModal';
import { RankBadgeInline } from '@/components/RankBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  reseller_price?: number | null;
  is_active: boolean;
}

const ProductDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: productId } = useParams();
  const { user, profile, refreshProfile, isAdmin, isTempAdmin } = useAuth();
  
  const stateProduct = location.state?.product;
  const flashSale = location.state?.flashSale;
  
  const [product, setProduct] = useState<any>(stateProduct || null);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState({ productName: '', totalPrice: 0 });
  const [userNote, setUserNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const [currentStock, setCurrentStock] = useState<number | null>(null);

  // Load product from URL param if not passed via state
  useEffect(() => {
    if (!stateProduct && productId) {
      loadProductById(productId);
    } else if (stateProduct) {
      setProduct(flashSale?.productData || stateProduct);
      setCurrentStock(stateProduct.stock ?? null);
      loadVariations(stateProduct.id);
    }
  }, [productId, stateProduct]);

  const loadProductById = async (id: string) => {
    setLoadingProduct(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      toast.error('Product not found');
      navigate('/products');
      return;
    }
    
    setProduct(data);
    setCurrentStock(data.stock ?? null);
    loadVariations(id);
    setLoadingProduct(false);
  };

  const loadVariations = async (id: string) => {
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', id)
      .eq('is_active', true);
    
    if (data) {
      setVariations(data);
    }
  };

  const displayProduct = flashSale?.productData || product;
  const isOutOfStock = currentStock !== null && currentStock <= 0;

  // Check if quantity exceeds available stock
  const exceedsStock = currentStock !== null && quantity > currentStock;

  // Calculate rank-based pricing
  const userRank = getUserRank(profile?.rank_balance || 0);
  const isReseller = profile?.is_reseller || false;
  
  // For variations, use variation's reseller_price if available
  const variationResellerPrice = selectedVariation?.reseller_price || null;
  const productResellerPrice = displayProduct?.reseller_price || null;
  
  // Determine base price and reseller price based on selection
  const basePrice = selectedVariation?.price || displayProduct?.price || 0;
  const applicableResellerPrice = selectedVariation ? variationResellerPrice : productResellerPrice;
  
  // For flash sale, use flash sale price directly
  const priceForCalculation = flashSale ? flashSale.salePrice : basePrice;
  
  // Calculate final price with rank discount (only for non-flash-sale)
  const { finalPrice: rankDiscountedPrice, savings, discountType } = calculateFinalPrice(
    priceForCalculation,
    flashSale ? null : applicableResellerPrice, // No reseller discount on flash sale items
    userRank,
    isReseller
  );

  // For flash sale, use flash sale price directly; otherwise use rank-discounted price
  const currentPrice = flashSale ? flashSale.salePrice : rankDiscountedPrice;
  const totalPrice = currentPrice * quantity;

  const handleShare = async () => {
    const productUrl = `${window.location.origin}/product/${displayProduct?.id}`;
    const shareData = {
      title: displayProduct?.name,
      text: `Check out ${displayProduct?.name} at RKR Premium Store! Only ₹${currentPrice}`,
      url: productUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      // Fallback - copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success('Link copied to clipboard!');
      } catch (e) {
        toast.error('Failed to share');
      }
    }
  };

  const handleBuy = async () => {
    if (!user || !profile) {
      toast.error('Please login to purchase');
      navigate('/auth');
      return;
    }

    if (!profile.phone) {
      toast.error('Please add your phone number to place an order');
      navigate('/profile/edit');
      return;
    }

    if (isOutOfStock) {
      toast.error('This product is out of stock');
      return;
    }

    if (exceedsStock) {
      toast.error(`Only ${currentStock} items available in stock`);
      return;
    }

    if ((profile.wallet_balance || 0) < totalPrice) {
      toast.error('Insufficient wallet balance');
      navigate('/wallet');
      return;
    }

    setLoading(true);

    try {
      // Deduct from wallet
      const newBalance = (profile.wallet_balance || 0) - totalPrice;
      await supabase
        .from('profiles')
        .update({ 
          wallet_balance: newBalance,
          total_orders: (profile.total_orders || 0) + 1
        })
        .eq('id', user.id);

      // Create order
      const productName = selectedVariation 
        ? `${displayProduct.name} - ${selectedVariation.name}` 
        : displayProduct.name;

      const { error: orderError } = await supabase.from('orders').insert({
        user_id: user.id,
        product_id: displayProduct.id,
        product_name: productName,
        product_image: displayProduct.image_url || displayProduct.image,
        unit_price: currentPrice,
        total_price: totalPrice,
        quantity: quantity,
        user_note: userNote,
        status: 'pending'
      });

      if (orderError) throw orderError;

      // Create transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'purchase',
        amount: totalPrice,
        status: 'completed',
        description: `Purchase: ${productName}`
      });

      // Create notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Order Placed',
        message: `Your order for ${productName} has been placed successfully!`,
        type: 'order'
      });

      // Update product sold count and decrease stock
      const updateData: { sold_count: number; stock?: number } = {
        sold_count: (displayProduct.sold_count || 0) + quantity
      };
      
      // Only update stock if it's being tracked (not null)
      if (currentStock !== null) {
        updateData.stock = currentStock - quantity;
      }

      await supabase
        .from('products')
        .update(updateData)
        .eq('id', displayProduct.id);

      // Update local stock state
      if (currentStock !== null) {
        setCurrentStock(currentStock - quantity);
      }

      // Show success modal
      setSuccessOrderData({ productName, totalPrice });
      setShowPurchaseModal(false);
      setShowSuccessModal(true);
      await refreshProfile();
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!displayProduct || loadingProduct) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Product Details</h1>
          <div className="flex items-center gap-1">
            {(isAdmin || isTempAdmin) && (
              <button 
                onClick={() => navigate('/admin', { state: { editProduct: displayProduct } })} 
                className="p-2 bg-primary/10 rounded-lg"
              >
                <Edit className="w-5 h-5 text-primary" />
              </button>
            )}
            <button 
              onClick={() => setIsFavorite(!isFavorite)} 
              className="p-2"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
            <button onClick={handleShare} className="p-2">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16 max-w-lg mx-auto">
        {/* Product Image with enhanced styling */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative overflow-hidden"
        >
          <motion.img
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            src={displayProduct.image_url || displayProduct.image || 'https://via.placeholder.com/400'}
            alt={displayProduct.name}
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
            {displayProduct.original_price && !flashSale && (
              <motion.div 
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-destructive px-3 py-1.5 rounded-full shadow-lg"
              >
                <span className="text-sm font-bold text-destructive-foreground">
                  -{Math.round(((displayProduct.original_price - displayProduct.price) / displayProduct.original_price) * 100)}% OFF
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
          
          {/* Price overlay */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-4 left-4 right-4"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-primary">₹{Math.round(currentPrice * 100) / 100}</span>
                    {!flashSale && savings > 0 && (
                      <span className="text-sm text-muted-foreground line-through">
                        ₹{basePrice}
                      </span>
                    )}
                    {flashSale && (
                      <span className="text-sm text-muted-foreground line-through">
                        ₹{displayProduct.price}
                      </span>
                    )}
                  </div>
                  {/* Rank Discount Badge */}
                  {!flashSale && savings > 0 && profile && (
                    <div className="flex items-center gap-1 mt-1">
                      <Tag className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">
                        {discountType} - ₹{Math.round(savings * 100) / 100} saved
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-yellow-700">{displayProduct.rating || 4.5}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Product Info */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="px-4 py-6 space-y-5"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">{displayProduct.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary" className="text-xs">{displayProduct.category}</Badge>
              <span className="text-sm text-muted-foreground">{displayProduct.sold_count || 0} sold</span>
              {currentStock !== null && (
                <span className={`text-sm font-medium flex items-center gap-1 ${isOutOfStock ? 'text-destructive' : currentStock <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                  <Package className="w-4 h-4" />
                  {isOutOfStock ? 'Out of Stock' : currentStock <= 5 ? `Only ${currentStock} left!` : `${currentStock} available`}
                </span>
              )}
            </div>
          </div>

          {/* Variations with enhanced UI */}
          {variations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full"></span>
                Select Duration
              </p>
              <div className="grid grid-cols-3 gap-2">
                {variations.map((variation, index) => {
                  // Calculate discounted price for this variation
                  const varResellerPrice = variation.reseller_price || null;
                  const { finalPrice: varFinalPrice } = calculateFinalPrice(
                    variation.price,
                    varResellerPrice,
                    userRank,
                    isReseller
                  );
                  const hasDiscount = varFinalPrice < variation.price;
                  
                  return (
                    <motion.button
                      key={variation.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      onClick={() => setSelectedVariation(variation)}
                      className={`relative p-3 rounded-xl border-2 transition-all ${
                        selectedVariation?.id === variation.id
                          ? 'border-primary bg-primary/10 shadow-lg'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      {selectedVariation?.id === variation.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      )}
                      <span className="block text-sm font-semibold text-foreground">{variation.name}</span>
                      <div className="mt-0.5">
                        <span className="block text-lg font-bold text-primary">₹{Math.round(varFinalPrice)}</span>
                        {hasDiscount && (
                          <span className="text-xs text-muted-foreground line-through">₹{variation.price}</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Description */}
          {displayProduct.description && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="bg-muted/50 rounded-2xl p-4"
            >
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full"></span>
                About this product
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{displayProduct.description}</p>
            </motion.div>
          )}

          {/* Features with enhanced styling */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-2xl border border-green-200 dark:border-green-800">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs text-center font-medium text-green-700 dark:text-green-300">Secure Payment</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-2xl border border-blue-200 dark:border-blue-800">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs text-center font-medium text-blue-700 dark:text-blue-300">Instant Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-2xl border border-purple-200 dark:border-purple-800">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs text-center font-medium text-purple-700 dark:text-purple-300">24/7 Support</span>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 glass border-t border-border p-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            className={`flex-1 rounded-xl h-12 ${isOutOfStock ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'btn-gradient'}`}
            onClick={() => !isOutOfStock && setShowPurchaseModal(true)}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? (
              <>
                <AlertCircle className="w-5 h-5 mr-2" />
                Out of Stock
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 mr-2" />
                Buy Now - ₹{currentPrice}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Purchase Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <img
                src={displayProduct.image_url || displayProduct.image || 'https://via.placeholder.com/80'}
                alt={displayProduct.name}
                className="w-20 h-20 rounded-xl object-cover"
              />
              <div>
                <h3 className="font-semibold">{displayProduct.name}</h3>
                {selectedVariation && (
                  <p className="text-sm text-muted-foreground">{selectedVariation.name}</p>
                )}
                <p className="text-primary font-bold">₹{currentPrice}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Quantity</label>
                {currentStock !== null && (
                  <span className="text-xs text-muted-foreground">{currentStock} available</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  -
                </Button>
                <span className="font-bold text-lg">{quantity}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuantity(currentStock !== null ? Math.min(currentStock, quantity + 1) : quantity + 1)}
                  disabled={currentStock !== null && quantity >= currentStock}
                >
                  +
                </Button>
              </div>
              {exceedsStock && (
                <p className="text-xs text-destructive mt-1">
                  Maximum {currentStock} items available
                </p>
              )}
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Note (optional)</label>
              <Input
                placeholder="Add a note for the seller..."
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>

            <div className="flex justify-between items-center p-3 bg-muted rounded-xl">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary">
                ₹{totalPrice}
              </span>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Wallet Balance: ₹{profile?.wallet_balance?.toFixed(2) || '0.00'}
            </div>

            <Button 
              className="w-full btn-gradient rounded-xl h-12" 
              onClick={handleBuy}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay ₹${totalPrice}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        productName={successOrderData.productName}
        totalPrice={successOrderData.totalPrice}
      />

      <BottomNav />
    </div>
  );
};

export default ProductDetailPage;
