import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  AlertCircle
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

const ProductDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  
  const product = location.state?.product;
  const flashSale = location.state?.flashSale;
  
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentStock, setCurrentStock] = useState<number | null>(null);

  const displayProduct = flashSale?.productData || product;
  const isOutOfStock = currentStock !== null && currentStock <= 0;

  useEffect(() => {
    if (!displayProduct) {
      navigate('/products');
      return;
    }
    loadVariations();
    // Initialize stock from product data
    setCurrentStock(displayProduct.stock ?? null);
  }, [displayProduct]);

  const loadVariations = async () => {
    if (!displayProduct?.id) return;
    
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', displayProduct.id)
      .eq('is_active', true);
    
    if (data) {
      setVariations(data);
    }
  };

  // Check if quantity exceeds available stock
  const exceedsStock = currentStock !== null && quantity > currentStock;

  const currentPrice = flashSale 
    ? flashSale.salePrice 
    : (selectedVariation?.price || displayProduct?.price || 0);

  const totalPrice = currentPrice * quantity;

  const handleShare = async () => {
    const shareData = {
      title: displayProduct?.name,
      text: `Check out ${displayProduct?.name} at RKR Premium Store! Only ₹${currentPrice}`,
      url: window.location.href,
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

      toast.success('Order placed successfully!');
      setShowPurchaseModal(false);
      await refreshProfile();
      navigate('/orders');
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!displayProduct) {
    return null;
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
          <button onClick={handleShare} className="p-2">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="pt-16 max-w-lg mx-auto">
        {/* Product Image */}
        <div className="relative">
          <img
            src={displayProduct.image_url || displayProduct.image || 'https://via.placeholder.com/400'}
            alt={displayProduct.name}
            className="w-full h-72 object-cover"
          />
          {flashSale && (
            <div className="absolute top-4 left-4 gradient-accent px-3 py-1 rounded-full">
              <span className="text-sm font-bold text-accent-foreground">
                Flash Sale!
              </span>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute top-4 right-4">
              <Badge variant="destructive" className="text-sm font-bold px-3 py-1">
                <AlertCircle className="w-4 h-4 mr-1" />
                Out of Stock
              </Badge>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="px-4 py-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{displayProduct.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{displayProduct.category}</p>
          </div>

          {/* Rating & Stock */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-medium">{displayProduct.rating || 4.5}</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{displayProduct.sold_count || 0} sold</span>
            {currentStock !== null && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className={`font-medium ${isOutOfStock ? 'text-destructive' : currentStock <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                  <Package className="w-4 h-4 inline mr-1" />
                  {isOutOfStock ? 'Out of Stock' : currentStock <= 5 ? `Only ${currentStock} left` : `${currentStock} in stock`}
                </span>
              </>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">₹{currentPrice}</span>
            {(flashSale || displayProduct.original_price) && (
              <span className="text-lg text-muted-foreground line-through">
                ₹{flashSale ? displayProduct.price : displayProduct.original_price}
              </span>
            )}
            {flashSale && (
              <span className="px-2 py-0.5 bg-destructive/10 text-destructive text-sm font-medium rounded">
                -{Math.round(((displayProduct.price - flashSale.salePrice) / displayProduct.price) * 100)}%
              </span>
            )}
          </div>

          {/* Variations */}
          {variations.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Select Variation</p>
              <div className="flex flex-wrap gap-2">
                {variations.map((variation) => (
                  <button
                    key={variation.id}
                    onClick={() => setSelectedVariation(variation)}
                    className={`px-4 py-2 rounded-xl border transition-all ${
                      selectedVariation?.id === variation.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    <span className="block text-sm font-medium">{variation.name}</span>
                    <span className="block text-xs text-muted-foreground">₹{variation.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {displayProduct.description && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Description</p>
              <p className="text-sm text-muted-foreground">{displayProduct.description}</p>
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 py-4">
            <div className="flex flex-col items-center gap-1 p-3 bg-muted rounded-xl">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-xs text-center text-muted-foreground">100% Secure</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-muted rounded-xl">
              <Truck className="w-5 h-5 text-primary" />
              <span className="text-xs text-center text-muted-foreground">Fast Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-muted rounded-xl">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="text-xs text-center text-muted-foreground">24/7 Support</span>
            </div>
          </div>
        </div>
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

      <BottomNav />
    </div>
  );
};

export default ProductDetailPage;
