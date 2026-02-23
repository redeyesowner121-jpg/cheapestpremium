import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Star, 
  Share2, 
  ShoppingCart, 
  Heart,
  Package,
  Edit,
  Tag
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BottomNav from '@/components/BottomNav';
import OrderSuccessModal from '@/components/OrderSuccessModal';

import ShareButtons from '@/components/ShareButtons';
import { ProductVariationSelector, ProductFeatures, PurchaseModal } from '@/components/product';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { useCart } from '@/hooks/useCart';
import AddToCartButton from '@/components/AddToCartButton';

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
  const { settings } = useAppSettingsContext();
  const stateProduct = location.state?.product;
  const flashSalePrice = location.state?.flashSalePrice;
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
  const exceedsStock = currentStock !== null && quantity > currentStock;

  const userRank = getUserRank(profile?.rank_balance || 0);
  const isReseller = profile?.is_reseller || false;
  
  const variationResellerPrice = selectedVariation?.reseller_price || null;
  const productResellerPrice = displayProduct?.reseller_price || null;
  
  // Determine base price - prioritize flash sale price
  const actualFlashSalePrice = flashSalePrice || flashSale?.salePrice;
  const basePrice = selectedVariation?.price || displayProduct?.price || 0;
  const applicableResellerPrice = selectedVariation ? variationResellerPrice : productResellerPrice;
  
  // If flash sale, use flash sale price directly without rank discounts
  const { finalPrice: rankDiscountedPrice, savings, discountType } = calculateFinalPrice(
    actualFlashSalePrice || basePrice,
    actualFlashSalePrice ? null : applicableResellerPrice,
    userRank,
    isReseller
  );

  // For flash sale, use the sale price directly
  const currentPrice = actualFlashSalePrice || rankDiscountedPrice;
  const totalPrice = currentPrice * quantity;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/products');
    }
  };

  const handleShare = async () => {
    const productUrl = `${settings.app_url}/product/${displayProduct?.id}`;
    const shareText = `Check out ${displayProduct?.name} at ${settings.app_name}! Only ${settings.currency_symbol}${currentPrice}`;

    // Try native share first (works on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: displayProduct?.name,
          text: shareText,
          url: productUrl,
        });
        return;
      } catch (error) {
        // User cancelled or share failed, fall through to clipboard
        if ((error as Error).name === 'AbortError') return;
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText}\n${productUrl}`);
      toast.success('Link copied to clipboard!');
    } catch (e) {
      toast.error('Failed to share');
    }
  };

  const handleBuyClick = () => {
    setShowPurchaseModal(true);
  };

  const handleBuy = async (
    donationAmount: number = 0, 
    discount: number = 0, 
    appliedCouponId?: string,
    guestDetails?: { name: string; email: string; phone: string }
  ) => {
    const isGuestCheckout = !user && guestDetails;
    
    // For logged in users, validate profile
    if (user && profile) {
      if (!profile.phone) {
        toast.error('Please add your phone number to place an order');
        navigate('/profile/edit');
        return;
      }
    }

    if (isOutOfStock) {
      toast.error('This product is out of stock');
      return;
    }

    if (exceedsStock) {
      toast.error(`Only ${currentStock} items available in stock`);
      return;
    }

    const finalTotal = totalPrice - discount + donationAmount;
    
    // Only check wallet balance for logged in users
    if (user && profile) {
      if ((profile.wallet_balance || 0) < finalTotal) {
        toast.error('Insufficient wallet balance');
        navigate('/wallet');
        return;
      }
    }

    setLoading(true);

    try {
      // Deduct from wallet only for logged in users
      if (user && profile) {
        const newBalance = (profile.wallet_balance || 0) - finalTotal;
        await supabase
          .from('profiles')
          .update({ 
            wallet_balance: newBalance,
            total_orders: (profile.total_orders || 0) + 1
          })
          .eq('id', user.id);
      }

      const productName = selectedVariation 
        ? `${displayProduct.name} - ${selectedVariation.name}` 
        : displayProduct.name;

      // Create order - different for guest vs logged in
      const orderData: any = {
        product_id: displayProduct.id,
        product_name: productName,
        product_image: displayProduct.image_url || displayProduct.image,
        unit_price: currentPrice,
        total_price: totalPrice,
        quantity: quantity,
        user_note: userNote + (donationAmount > 0 ? ` [Donation: ₹${donationAmount}]` : ''),
        status: isGuestCheckout ? 'pending' : 'pending',
        discount_applied: discount
      };
      
      if (isGuestCheckout) {
        orderData.guest_name = guestDetails.name;
        orderData.guest_email = guestDetails.email;
        orderData.guest_phone = guestDetails.phone;
      } else if (user) {
        orderData.user_id = user.id;
      }

      const { error: orderError } = await supabase.from('orders').insert(orderData);

      if (orderError) throw orderError;

      // Only create transaction for logged in users
      if (user) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'purchase',
          amount: -finalTotal,
          status: 'completed',
          description: `Purchase: ${productName}${discount > 0 ? ` (₹${discount} discount)` : ''}${donationAmount > 0 ? ` + ₹${donationAmount} donation` : ''}`
        });
      }

      // Increment coupon used_count atomically if coupon was applied
      if (appliedCouponId) {
        await supabase.rpc('increment_coupon_used_count', { coupon_id: appliedCouponId });
      }

      // Only create notification for logged in users
      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Order Placed',
          message: `Your order for ${productName} has been placed successfully!`,
          type: 'order'
        });
      }

      // Use atomic increment for sold_count and stock update
      const hasStock = currentStock !== null;
      await supabase.rpc('increment_product_sold_count', { 
        product_id: displayProduct.id, 
        qty: quantity,
        has_stock: hasStock
      });

      if (currentStock !== null) {
        setCurrentStock(currentStock - quantity);
      }

      setSuccessOrderData({ productName, totalPrice: finalTotal });
      setShowPurchaseModal(false);
      setShowSuccessModal(true);
      if (user) {
        await refreshProfile();
      }
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
          <button onClick={handleBack} className="p-2">
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
        {/* Product Image */}
        <div className="relative overflow-hidden">
          <img
            src={displayProduct.image_url || displayProduct.image || 'https://via.placeholder.com/400'}
            alt={displayProduct.name}
            className="w-full h-80 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-primary">₹{Math.round(currentPrice * 100) / 100}</span>
                    {!actualFlashSalePrice && savings > 0 && (
                      <span className="text-sm text-muted-foreground line-through">₹{basePrice}</span>
                    )}
                    {actualFlashSalePrice && basePrice > actualFlashSalePrice && (
                      <span className="text-sm text-muted-foreground line-through">₹{basePrice}</span>
                    )}
                  </div>
                  {!actualFlashSalePrice && savings > 0 && profile && (
                    <div className="flex items-center gap-1 mt-1">
                      <Tag className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">
                        {discountType} - ₹{Math.round(savings * 100) / 100} saved
                      </span>
                    </div>
                  )}
                  {actualFlashSalePrice && (
                    <div className="flex items-center gap-1 mt-1">
                      <Tag className="w-3 h-3 text-orange-600" />
                      <span className="text-xs text-orange-600 font-medium">
                        Flash Sale - ₹{Math.round((basePrice - actualFlashSalePrice) * 100) / 100} saved
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
          </div>
        </div>

        {/* Product Info */}
        <div className="px-4 py-6 space-y-5">
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


          {/* Variations */}
          <ProductVariationSelector
            variations={variations}
            selectedVariation={selectedVariation}
            onSelect={setSelectedVariation}
            userRank={userRank}
            isReseller={isReseller}
          />

          {/* Description */}
          {displayProduct.description && (
            <div className="bg-muted/50 rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full"></span>
                About this product
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{displayProduct.description}</p>
            </div>
          )}

          {/* Features */}
          <ProductFeatures />
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 glass border-t border-border p-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <ShareButtons 
            text={`Check out ${displayProduct?.name} at ${settings.app_name}! Only ${settings.currency_symbol}${currentPrice}`}
            url={`${settings.app_url}/product/${displayProduct?.id}`}
            size="sm"
          />
          <AddToCartButton 
            productId={displayProduct.id}
            variationId={selectedVariation?.id}
            disabled={isOutOfStock}
            className="flex-1 h-12"
          />
        </div>
      </div>

      {/* Purchase Modal */}
      <PurchaseModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
        product={displayProduct}
        selectedVariation={selectedVariation}
        currentPrice={currentPrice}
        quantity={quantity}
        onQuantityChange={setQuantity}
        currentStock={currentStock}
        exceedsStock={exceedsStock}
        userNote={userNote}
        onUserNoteChange={setUserNote}
        walletBalance={profile?.wallet_balance || 0}
        totalPrice={totalPrice}
        loading={loading}
        onBuy={handleBuy}
        flashSaleId={flashSale?.id}
        isLoggedIn={!!user}
      />



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
