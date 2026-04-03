import React, { useState } from 'react';
import { Heart, Ticket, Check, X, Loader2, User, Mail, Phone, Wallet, ArrowLeft, Copy, ExternalLink } from 'lucide-react';
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
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';

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

type PaymentStep = 'details' | 'method' | 'binance' | 'razorpay';

const INR_TO_USD_RATE = 60;

function generatePaymentNote(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let note = '';
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 6) {
      note += digits[Math.floor(Math.random() * digits.length)];
    } else {
      note += letters[Math.floor(Math.random() * letters.length)];
    }
  }
  return note;
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
  const { formatPrice } = useCurrencyFormat();
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestErrors, setGuestErrors] = useState<{name?: string; email?: string; phone?: string}>({});
  
  // Payment method state
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('details');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const donation = donationEnabled ? Math.max(1, parseFloat(donationAmount) || 0) : 0;
  
  const BULK_THRESHOLD = 5;
  const BULK_DISCOUNT_PERCENT = 8;
  const isBulkOrder = quantity >= BULK_THRESHOLD;
  const bulkDiscountAmount = isBulkOrder ? (totalPrice * BULK_DISCOUNT_PERCENT) / 100 : 0;
  
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
  const amountUsd = Math.max(0.01, Math.round((finalTotal / INR_TO_USD_RATE) * 100) / 100);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPaymentStep('details');
      setPaymentNote('');
      setPaymentId('');
      setVerifying(false);
    }
    onOpenChange(open);
  };

  const validateGuestDetails = () => {
    const errors: {name?: string; email?: string; phone?: string} = {};
    if (!guestName.trim()) errors.name = 'Name is required';
    else if (guestName.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (!guestEmail.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) errors.email = 'Invalid email address';
    if (!guestPhone.trim()) errors.phone = 'Phone number is required';
    else if (!/^[0-9]{10}$/.test(guestPhone.trim())) errors.phone = 'Enter a valid 10-digit phone number';
    setGuestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) { setCouponError('Please enter a coupon code'); return; }
    setCouponLoading(true);
    setCouponError('');
    try {
      const { data: coupon, error } = await supabase
        .from('coupons').select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true).maybeSingle();
      if (error) throw error;
      if (!coupon) { setCouponError('Invalid coupon code'); setCouponLoading(false); return; }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) { setCouponError('This coupon has expired'); setCouponLoading(false); return; }
      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) { setCouponError('This coupon is not yet active'); setCouponLoading(false); return; }
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) { setCouponError('This coupon has been fully redeemed'); setCouponLoading(false); return; }
      if (coupon.min_purchase && totalPrice < coupon.min_purchase) { setCouponError(`Minimum purchase of ${formatPrice(coupon.min_purchase)} required`); setCouponLoading(false); return; }
      if (coupon.product_id && coupon.product_id !== product.id) { setCouponError('This coupon is not valid for this product'); setCouponLoading(false); return; }
      if (coupon.flash_sale_id && coupon.flash_sale_id !== flashSaleId) { setCouponError('This coupon is only valid for a specific flash sale'); setCouponLoading(false); return; }
      setAppliedCoupon({ id: coupon.id, code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value, max_discount: coupon.max_discount });
      setCouponCode('');
      toast.success('Coupon applied successfully!');
    } catch { setCouponError('Failed to validate coupon'); }
    finally { setCouponLoading(false); }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponError(''); };

  const handleWalletBuy = () => {
    if (!isLoggedIn) {
      if (!validateGuestDetails()) return;
      onBuy(donation, totalDiscountAmount, appliedCoupon?.id, { name: guestName.trim(), email: guestEmail.trim(), phone: guestPhone.trim() });
    } else {
      onBuy(donation, totalDiscountAmount, appliedCoupon?.id);
    }
  };

  const handleProceedToPayment = () => {
    if (!isLoggedIn && !validateGuestDetails()) return;
    setPaymentStep('method');
  };

  const initPayment = async (method: 'binance' | 'razorpay') => {
    const note = generatePaymentNote();
    setPaymentNote(note);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id || 'guest';

      const { data: payment, error } = await supabase.from('payments').insert({
        user_id: userId,
        amount: finalTotal,
        amount_usd: method === 'binance' ? amountUsd : null,
        note,
        status: 'pending',
        payment_method: method === 'binance' ? 'binance' : 'razorpay_upi',
        product_id: product.id || null,
        product_name: selectedVariation ? `${product.name} - ${selectedVariation.name}` : product.name,
      }).select('id').single();

      if (error) throw error;
      setPaymentId(payment.id);
      setPaymentStep(method);
    } catch (err) {
      console.error('Payment init error:', err);
      toast.error('Failed to initialize payment');
    }
  };

  const verifyPayment = async (method: 'binance' | 'razorpay') => {
    setVerifying(true);
    try {
      const functionName = method === 'binance' ? 'verify-binance-payment' : 'verify-razorpay-note';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { note: paymentNote, amount: method === 'binance' ? amountUsd : finalTotal, paymentId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Payment verified! Processing order...');
        // Now place the order via wallet flow (the payment covers it)
        if (!isLoggedIn) {
          onBuy(donation, totalDiscountAmount, appliedCoupon?.id, { name: guestName.trim(), email: guestEmail.trim(), phone: guestPhone.trim() });
        } else {
          onBuy(donation, totalDiscountAmount, appliedCoupon?.id);
        }
      } else {
        toast.error(data?.message || 'Payment not found. Try again after completing payment.');
      }
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const canWalletPay = isLoggedIn && finalTotal <= walletBalance;

  // ===== PAYMENT METHOD SCREEN =====
  if (paymentStep === 'method') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <button onClick={() => setPaymentStep('details')} className="p-1 hover:bg-muted rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              Choose Payment Method
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="text-center p-3 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(finalTotal)}</p>
            </div>

            {isLoggedIn && (
              <Button
                className="w-full h-14 rounded-xl justify-start gap-3"
                variant={canWalletPay ? 'default' : 'outline'}
                disabled={!canWalletPay}
                onClick={handleWalletBuy}
              >
                <Wallet className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold">Wallet Balance</p>
                  <p className="text-xs opacity-70">{formatPrice(walletBalance)} available</p>
                </div>
              </Button>
            )}

            <Button
              className="w-full h-14 rounded-xl justify-start gap-3 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => initPayment('binance')}
            >
              <span className="text-lg">₿</span>
              <div className="text-left">
                <p className="font-semibold">Binance Pay</p>
                <p className="text-xs opacity-70">${amountUsd} USD</p>
              </div>
            </Button>

            <Button
              className="w-full h-14 rounded-xl justify-start gap-3 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => initPayment('razorpay')}
            >
              <span className="text-lg">⚡</span>
              <div className="text-left">
                <p className="font-semibold">UPI (Razorpay)</p>
                <p className="text-xs opacity-70">Auto-verified</p>
              </div>
            </Button>

            {!isLoggedIn && (
              <Button
                className="w-full h-14 rounded-xl justify-start gap-3"
                variant="outline"
                onClick={handleWalletBuy}
              >
                <Phone className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold">Place Order (Pay Later)</p>
                  <p className="text-xs text-muted-foreground">Payment details sent via email</p>
                </div>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== BINANCE PAYMENT SCREEN =====
  if (paymentStep === 'binance') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <button onClick={() => setPaymentStep('method')} className="p-1 hover:bg-muted rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              Binance Pay
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pay ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded-lg text-sm font-mono">1178303416</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard('1178303416')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount (USD)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded-lg text-sm font-mono font-bold">${amountUsd}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(amountUsd.toString())}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-destructive mb-1 font-medium">⚠️ Payment Note (MUST add)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded-lg text-sm font-mono font-bold text-primary">{paymentNote}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentNote)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted rounded-lg">
              <p>1. Open Binance → Pay → Send</p>
              <p>2. Enter Pay ID above</p>
              <p>3. Amount: <b>${amountUsd}</b></p>
              <p>4. Add note: <b>{paymentNote}</b></p>
              <p>5. Complete payment & verify below</p>
            </div>

            <Button
              className="w-full h-12 rounded-xl btn-gradient"
              onClick={() => verifyPayment('binance')}
              disabled={verifying}
            >
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying...</> : '✅ Verify Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== RAZORPAY UPI SCREEN =====
  if (paymentStep === 'razorpay') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <button onClick={() => setPaymentStep('method')} className="p-1 hover:bg-muted rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              UPI Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <code className="block p-2 bg-background rounded-lg text-lg font-mono font-bold text-center">₹{finalTotal}</code>
              </div>
              <div>
                <p className="text-xs text-destructive mb-1 font-medium">⚠️ Payment Note (MUST add)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded-lg text-sm font-mono font-bold text-primary">{paymentNote}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentNote)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted rounded-lg">
              <p>1. Click <b>Pay Now</b> to open payment page</p>
              <p>2. Pay exactly <b>₹{finalTotal}</b></p>
              <p>3. In the note/description field, paste: <b>{paymentNote}</b></p>
              <p>4. Complete payment & verify below</p>
            </div>

            <Button
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.open('https://razorpay.me/@asifikbalrubaiulislam', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" /> Pay Now
            </Button>

            <Button
              className="w-full h-12 rounded-xl btn-gradient"
              onClick={() => verifyPayment('razorpay')}
              disabled={verifying}
            >
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying...</> : '✅ Verify Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== DETAILS SCREEN (Original) =====
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              <p className="text-primary font-bold">{formatPrice(currentPrice)}</p>
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
                <Input placeholder="Enter your name" value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setGuestErrors(prev => ({ ...prev, name: undefined })); }}
                  className="h-9 rounded-lg" />
                {guestErrors.name && <p className="text-xs text-destructive mt-1">{guestErrors.name}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Email *</label>
                </div>
                <Input type="email" placeholder="Enter your email" value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setGuestErrors(prev => ({ ...prev, email: undefined })); }}
                  className="h-9 rounded-lg" />
                {guestErrors.email && <p className="text-xs text-destructive mt-1">{guestErrors.email}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Phone *</label>
                </div>
                <Input type="tel" placeholder="10-digit phone number" value={guestPhone}
                  onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); setGuestPhone(value); setGuestErrors(prev => ({ ...prev, phone: undefined })); }}
                  className="h-9 rounded-lg" />
                {guestErrors.phone && <p className="text-xs text-destructive mt-1">{guestErrors.phone}</p>}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Quantity</label>
              {currentStock !== null && <span className="text-xs text-muted-foreground">{currentStock} available</span>}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Button size="sm" variant="outline" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>-</Button>
              <span className="font-bold text-lg">{quantity}</span>
              <Button size="sm" variant="outline"
                onClick={() => onQuantityChange(currentStock !== null ? Math.min(currentStock, quantity + 1) : quantity + 1)}
                disabled={currentStock !== null && quantity >= currentStock}>+</Button>
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
                <button onClick={removeCoupon} className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full transition-colors">
                  <X className="w-4 h-4 text-green-700 dark:text-green-400" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input placeholder="Enter coupon code" value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                    className="h-9 uppercase" />
                  <Button size="sm" variant="secondary" onClick={validateCoupon} disabled={couponLoading} className="px-4">
                    {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                {couponError && <p className="text-xs text-destructive mt-1">{couponError}</p>}
              </>
            )}
          </div>

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
            onClick={handleProceedToPayment}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Proceed to Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseModal;
