import React from 'react';
import { Heart, Ticket, Check, X, Loader2, User, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { AppliedCoupon, BULK_THRESHOLD } from './types';

interface DetailsScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { name: string; image_url?: string; image?: string };
  selectedVariation: { name: string } | null;
  currentPrice: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  currentStock: number | null;
  exceedsStock: boolean;
  userNote: string;
  onUserNoteChange: (note: string) => void;
  totalPrice: number;
  walletBalance: number;
  isLoggedIn: boolean;
  loading: boolean;
  // Guest
  guestName: string; setGuestName: (v: string) => void;
  guestEmail: string; setGuestEmail: (v: string) => void;
  guestPhone: string; setGuestPhone: (v: string) => void;
  guestErrors: { name?: string; email?: string; phone?: string };
  setGuestErrors: (v: any) => void;
  // Coupon
  couponCode: string; setCouponCode: (v: string) => void;
  appliedCoupon: AppliedCoupon | null;
  couponLoading: boolean;
  couponError: string; setCouponError: (v: string) => void;
  onValidateCoupon: () => void;
  onRemoveCoupon: () => void;
  // Donation
  donationEnabled: boolean; setDonationEnabled: (v: boolean) => void;
  donationAmount: string; setDonationAmount: (v: string) => void;
  // Discounts
  isBulkOrder: boolean;
  bulkDiscountAmount: number;
  couponDiscountAmount: number;
  donation: number;
  finalTotal: number;
  // Action
  onProceed: () => void;
}

const DetailsScreen: React.FC<DetailsScreenProps> = ({
  open, onOpenChange, product, selectedVariation, currentPrice,
  quantity, onQuantityChange, currentStock, exceedsStock,
  userNote, onUserNoteChange, totalPrice, walletBalance, isLoggedIn, loading,
  guestName, setGuestName, guestEmail, setGuestEmail, guestPhone, setGuestPhone,
  guestErrors, setGuestErrors,
  couponCode, setCouponCode, appliedCoupon, couponLoading, couponError, setCouponError,
  onValidateCoupon, onRemoveCoupon,
  donationEnabled, setDonationEnabled, donationAmount, setDonationAmount,
  isBulkOrder, bulkDiscountAmount, couponDiscountAmount, donation, finalTotal,
  onProceed
}) => {
  const { formatPrice } = useCurrencyFormat();

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
              {selectedVariation && <p className="text-sm text-muted-foreground">{selectedVariation.name}</p>}
              <p className="text-primary font-bold">{formatPrice(currentPrice)}</p>
            </div>
          </div>

          {/* Guest Details */}
          {!isLoggedIn && (
            <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" /> Your Details
              </h4>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Name *</label>
                </div>
                <Input placeholder="Enter your name" value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setGuestErrors((prev: any) => ({ ...prev, name: undefined })); }}
                  className="h-9 rounded-lg" />
                {guestErrors.name && <p className="text-xs text-destructive mt-1">{guestErrors.name}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Email *</label>
                </div>
                <Input type="email" placeholder="Enter your email" value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setGuestErrors((prev: any) => ({ ...prev, email: undefined })); }}
                  className="h-9 rounded-lg" />
                {guestErrors.email && <p className="text-xs text-destructive mt-1">{guestErrors.email}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Phone *</label>
                </div>
                <Input type="tel" placeholder="10-digit phone number" value={guestPhone}
                  onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); setGuestPhone(value); setGuestErrors((prev: any) => ({ ...prev, phone: undefined })); }}
                  className="h-9 rounded-lg" />
                {guestErrors.phone && <p className="text-xs text-destructive mt-1">{guestErrors.phone}</p>}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Quantity</label>
              {currentStock !== null && <span className="text-xs text-muted-foreground">{currentStock} available</span>}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Button size="sm" variant="outline" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>-</Button>
              <span className="font-bold text-lg">{quantity}</span>
              <Button size="sm" variant="outline"
                onClick={() => onQuantityChange(currentStock !== null ? Math.min(currentStock, 20, quantity + 1) : Math.min(20, quantity + 1))}
                disabled={quantity >= 20 || (currentStock !== null && quantity >= currentStock)}>+</Button>
            </div>
            {exceedsStock && <p className="text-xs text-destructive mt-1">Maximum {currentStock} items available</p>}
            {isBulkOrder && <p className="text-xs text-green-600 mt-1 font-medium">🎉 Bulk discount applied: 8% OFF!</p>}
            {!isBulkOrder && quantity >= 3 && <p className="text-xs text-muted-foreground mt-1">💡 Order {BULK_THRESHOLD - quantity} more for 8% bulk discount!</p>}
          </div>

          {/* Coupon */}
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Have a coupon?</span>
            </div>
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">{appliedCoupon.code}</span>
                  <span className="text-xs text-green-600 dark:text-green-500">
                    ({appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}% OFF` : `${formatPrice(appliedCoupon.discount_value)} OFF`})
                  </span>
                </div>
                <button onClick={onRemoveCoupon} className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full transition-colors">
                  <X className="w-4 h-4 text-green-700 dark:text-green-400" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input placeholder="Enter coupon code" value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                    className="h-9 uppercase" />
                  <Button size="sm" variant="secondary" onClick={onValidateCoupon} disabled={couponLoading} className="px-4">
                    {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
              </>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-sm text-muted-foreground">Note (optional)</label>
            <Input placeholder="Add a note for the seller..." value={userNote}
              onChange={(e) => onUserNoteChange(e.target.value)} className="mt-1 rounded-xl" />
          </div>

          {/* Donation */}
          <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 rounded-xl border border-pink-200 dark:border-pink-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">Support Us</span>
              </div>
              <Switch checked={donationEnabled} onCheckedChange={setDonationEnabled} />
            </div>
            {donationEnabled && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <Input type="number" min="1" value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)} className="h-8 rounded-lg" placeholder="1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Min ₹1 • Your donation helps us improve our services ❤️</p>
              </div>
            )}
          </div>

          {/* Price Summary */}
          <div className="space-y-2 p-3 bg-muted rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
            {isBulkOrder && bulkDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Bulk Discount (8%)</span>
                <span className="text-green-600">-{formatPrice(bulkDiscountAmount)}</span>
              </div>
            )}
            {appliedCoupon && couponDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Coupon Discount</span>
                <span className="text-green-600">-{formatPrice(couponDiscountAmount)}</span>
              </div>
            )}
            {donationEnabled && donation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-pink-500">Donation</span>
                <span className="text-pink-500">{formatPrice(donation)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">{formatPrice(finalTotal)}</span>
            </div>
          </div>

          {isLoggedIn && (
            <div className="text-sm text-muted-foreground text-center">
              Wallet Balance: {formatPrice(walletBalance || 0)}
            </div>
          )}

          <Button
            className="w-full btn-gradient rounded-xl h-12"
            onClick={onProceed}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Proceed to Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DetailsScreen;
