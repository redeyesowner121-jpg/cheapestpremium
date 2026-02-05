import React, { useState } from 'react';
import { Heart, Ticket, Check, X, Loader2, User, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id?: string;
    name: string;
    image_url?: string;
    image?: string;
  };
  selectedVariation: { name: string } | null;
  currentPrice: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  currentStock: number | null;
  exceedsStock: boolean;
  userNote: string;
  onUserNoteChange: (note: string) => void;
  walletBalance: number;
  totalPrice: number;
  loading: boolean;
  onBuy: (donationAmount: number, discount?: number, appliedCouponId?: string, guestDetails?: GuestDetails) => void;
  flashSaleId?: string;
  isLoggedIn?: boolean;
}

interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
}

interface GuestDetails {
  name: string;
  email: string;
  phone: string;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  open,
  onOpenChange,
  product,
  selectedVariation,
  currentPrice,
  quantity,
  onQuantityChange,
  currentStock,
  exceedsStock,
  userNote,
  onUserNoteChange,
  walletBalance,
  totalPrice,
  loading,
  onBuy,
  flashSaleId,
  isLoggedIn = true,
}) => {
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  // Guest checkout fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestErrors, setGuestErrors] = useState<{name?: string; email?: string; phone?: string}>({});
  
  const donation = donationEnabled ? Math.max(1, parseFloat(donationAmount) || 0) : 0;
  
  // Bulk order discount: 5+ items = 8% off
  const BULK_THRESHOLD = 5;
  const BULK_DISCOUNT_PERCENT = 8;
  const isBulkOrder = quantity >= BULK_THRESHOLD;
  const bulkDiscountAmount = isBulkOrder ? (totalPrice * BULK_DISCOUNT_PERCENT) / 100 : 0;
  
  // Calculate coupon discount (applied after bulk discount)
  const calculateCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    
    const priceAfterBulk = totalPrice - bulkDiscountAmount;
    let discount = 0;
    if (appliedCoupon.discount_type === 'percentage') {
      discount = (priceAfterBulk * appliedCoupon.discount_value) / 100;
      if (appliedCoupon.max_discount && discount > appliedCoupon.max_discount) {
        discount = appliedCoupon.max_discount;
      }
    } else {
      discount = appliedCoupon.discount_value;
    }
    
    return Math.min(discount, priceAfterBulk);
  };
  
  const couponDiscountAmount = calculateCouponDiscount();
  const totalDiscountAmount = bulkDiscountAmount + couponDiscountAmount;
  const finalTotal = totalPrice - totalDiscountAmount + donation;

  const validateGuestDetails = () => {
    const errors: {name?: string; email?: string; phone?: string} = {};
    
    if (!guestName.trim()) {
      errors.name = 'Name is required';
    } else if (guestName.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (!guestEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      errors.email = 'Invalid email address';
    }
    
    if (!guestPhone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^[0-9]{10}$/.test(guestPhone.trim())) {
      errors.phone = 'Enter a valid 10-digit phone number';
    }
    
    setGuestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setCouponLoading(true);
    setCouponError('');

    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!coupon) {
        setCouponError('Invalid coupon code');
        setCouponLoading(false);
        return;
      }

      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        setCouponError('This coupon has expired');
        setCouponLoading(false);
        return;
      }

      // Check start date
      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
        setCouponError('This coupon is not yet active');
        setCouponLoading(false);
        return;
      }

      // Check usage limit
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        setCouponError('This coupon has been fully redeemed');
        setCouponLoading(false);
        return;
      }

      // Check minimum purchase
      if (coupon.min_purchase && totalPrice < coupon.min_purchase) {
        setCouponError(`Minimum purchase of ₹${coupon.min_purchase} required`);
        setCouponLoading(false);
        return;
      }

      // Check product-specific coupon
      if (coupon.product_id && coupon.product_id !== product.id) {
        setCouponError('This coupon is not valid for this product');
        setCouponLoading(false);
        return;
      }

      // Check flash sale specific coupon
      if (coupon.flash_sale_id && coupon.flash_sale_id !== flashSaleId) {
        setCouponError('This coupon is only valid for a specific flash sale');
        setCouponLoading(false);
        return;
      }

      setAppliedCoupon({
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        max_discount: coupon.max_discount,
      });
      setCouponCode('');
      toast.success('Coupon applied successfully!');
    } catch (err) {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  const handleBuy = () => {
    if (!isLoggedIn) {
      if (!validateGuestDetails()) {
        return;
      }
      onBuy(donation, totalDiscountAmount, appliedCoupon?.id, {
        name: guestName.trim(),
        email: guestEmail.trim(),
        phone: guestPhone.trim(),
      });
    } else {
      onBuy(donation, totalDiscountAmount, appliedCoupon?.id);
    }
  };

  const canProceed = isLoggedIn ? finalTotal <= walletBalance : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{isLoggedIn ? 'Confirm Purchase' : 'Guest Checkout'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <img
              src={product.image_url || product.image || 'https://via.placeholder.com/80'}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              {selectedVariation && (
                <p className="text-sm text-muted-foreground">{selectedVariation.name}</p>
              )}
              <p className="text-primary font-bold">₹{currentPrice}</p>
            </div>
          </div>

          {/* Guest Details Form */}
          {!isLoggedIn && (
            <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Your Details
              </h4>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Name *</label>
                </div>
                <Input
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    setGuestErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  className="h-9 rounded-lg"
                />
                {guestErrors.name && (
                  <p className="text-xs text-destructive mt-1">{guestErrors.name}</p>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Email *</label>
                </div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={guestEmail}
                  onChange={(e) => {
                    setGuestEmail(e.target.value);
                    setGuestErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className="h-9 rounded-lg"
                />
                {guestErrors.email && (
                  <p className="text-xs text-destructive mt-1">{guestErrors.email}</p>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Phone *</label>
                </div>
                <Input
                  type="tel"
                  placeholder="10-digit phone number"
                  value={guestPhone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setGuestPhone(value);
                    setGuestErrors(prev => ({ ...prev, phone: undefined }));
                  }}
                  className="h-9 rounded-lg"
                />
                {guestErrors.phone && (
                  <p className="text-xs text-destructive mt-1">{guestErrors.phone}</p>
                )}
              </div>
            </div>
          )}

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
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <span className="font-bold text-lg">{quantity}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuantityChange(currentStock !== null ? Math.min(currentStock, quantity + 1) : quantity + 1)}
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
            {isBulkOrder && (
              <p className="text-xs text-green-600 mt-1 font-medium">
                🎉 Bulk discount applied: 8% OFF!
              </p>
            )}
            {!isBulkOrder && quantity >= 3 && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 Order {BULK_THRESHOLD - quantity} more for 8% bulk discount!
              </p>
            )}
          </div>

          {/* Coupon Code Input */}
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Have a coupon?</span>
            </div>
            
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {appliedCoupon.code}
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-500">
                    ({appliedCoupon.discount_type === 'percentage' 
                      ? `${appliedCoupon.discount_value}% OFF` 
                      : `₹${appliedCoupon.discount_value} OFF`})
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-green-700 dark:text-green-400" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError('');
                    }}
                    className="h-9 uppercase"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={validateCoupon}
                    disabled={couponLoading}
                    className="px-4"
                  >
                    {couponLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-destructive mt-1">{couponError}</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Note (optional)</label>
            <Input
              placeholder="Add a note for the seller..."
              value={userNote}
              onChange={(e) => onUserNoteChange(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>

          {/* Donation Option */}
          <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 rounded-xl border border-pink-200 dark:border-pink-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">Support Us</span>
              </div>
              <Switch
                checked={donationEnabled}
                onCheckedChange={setDonationEnabled}
              />
            </div>
            {donationEnabled && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    min="1"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
                    className="h-8 rounded-lg"
                    placeholder="1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Min ₹1 • Your donation helps us improve our services ❤️
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 p-3 bg-muted rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{totalPrice}</span>
            </div>
            {isBulkOrder && bulkDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Bulk Discount (8%)</span>
                <span className="text-green-600">-₹{bulkDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {appliedCoupon && couponDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Coupon Discount</span>
                <span className="text-green-600">-₹{couponDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {donationEnabled && donation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-pink-500">Donation</span>
                <span className="text-pink-500">₹{donation}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">
                ₹{finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {isLoggedIn && (
            <div className="text-sm text-muted-foreground text-center">
              Wallet Balance: ₹{walletBalance?.toFixed(2) || '0.00'}
            </div>
          )}

          {!isLoggedIn && (
            <div className="text-sm text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-amber-700 dark:text-amber-400 text-xs">
                💳 Payment details will be sent to your email after order placement
              </p>
            </div>
          )}

          <Button 
            className="w-full btn-gradient rounded-xl h-12" 
            onClick={handleBuy}
            disabled={loading || (isLoggedIn && !canProceed)}
          >
            {loading ? 'Processing...' : isLoggedIn ? `Pay ₹${finalTotal.toFixed(2)}` : `Place Order ₹${finalTotal.toFixed(2)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseModal;
