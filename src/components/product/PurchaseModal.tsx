import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import {
  PurchaseModalProps, AppliedCoupon, GuestDetails, PaymentStep,
  INR_TO_USD_RATE, BULK_THRESHOLD, BULK_DISCOUNT_PERCENT
} from './purchase/types';
import { generatePaymentNote, calculateCouponDiscount, validateCoupon } from './purchase/utils';
import PaymentMethodScreen from './purchase/PaymentMethodScreen';
import BinancePaymentScreen from './purchase/BinancePaymentScreen';
import RazorpayPaymentScreen from './purchase/RazorpayPaymentScreen';
import DetailsScreen from './purchase/DetailsScreen';

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  open, onOpenChange, product, selectedVariation, currentPrice,
  quantity, onQuantityChange, currentStock, exceedsStock,
  userNote, onUserNoteChange, walletBalance, totalPrice,
  loading, onBuy, flashSaleId, isLoggedIn = true,
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
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('details');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [payClickedAt, setPayClickedAt] = useState<string | null>(null);

  const donation = donationEnabled ? Math.max(1, parseFloat(donationAmount) || 0) : 0;
  const isBulkOrder = quantity >= BULK_THRESHOLD;
  const bulkDiscountAmount = isBulkOrder ? (totalPrice * BULK_DISCOUNT_PERCENT) / 100 : 0;
  const couponDiscountAmount = calculateCouponDiscount(appliedCoupon, totalPrice, bulkDiscountAmount);
  const totalDiscountAmount = bulkDiscountAmount + couponDiscountAmount;
  const finalTotal = totalPrice - totalDiscountAmount + donation;
  const amountUsd = Math.max(0.01, Math.round((finalTotal / INR_TO_USD_RATE) * 100) / 100);
  const canWalletPay = isLoggedIn && finalTotal <= walletBalance;

  const handleOpenChange = (open: boolean) => {
    if (!open) { setPaymentStep('details'); setPaymentNote(''); setPaymentId(''); setVerifying(false); setPayClickedAt(null); }
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

  const handleValidateCoupon = async () => {
    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await validateCoupon(couponCode, totalPrice, product.id, flashSaleId, formatPrice);
      if (typeof result === 'string') { setCouponError(result); }
      else { setAppliedCoupon(result); setCouponCode(''); toast.success('Coupon applied successfully!'); }
    } catch { setCouponError('Failed to validate coupon'); }
    finally { setCouponLoading(false); }
  };

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
        user_id: userId, amount: finalTotal,
        amount_usd: method === 'binance' ? amountUsd : null, note,
        status: 'pending', payment_method: method === 'binance' ? 'binance' : 'razorpay_upi',
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
      const body = method === 'binance' 
        ? { note: paymentNote, amount: amountUsd, paymentId }
        : { amount: finalTotal, paymentId, payClickedAt };
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      if (data?.success) {
        toast.success('Payment verified! Processing order...');
        if (!isLoggedIn) {
          onBuy(donation, totalDiscountAmount, appliedCoupon?.id, { name: guestName.trim(), email: guestEmail.trim(), phone: guestPhone.trim() });
        } else { onBuy(donation, totalDiscountAmount, appliedCoupon?.id); }
      } else { toast.error(data?.message || 'Payment not found. Try again after completing payment.'); }
    } catch { toast.error('Verification failed. Please try again.'); }
    finally { setVerifying(false); }
  };

  if (paymentStep === 'method') {
    return (
      <PaymentMethodScreen
        open={open} onOpenChange={handleOpenChange}
        finalTotal={finalTotal} amountUsd={amountUsd} walletBalance={walletBalance}
        isLoggedIn={isLoggedIn} canWalletPay={canWalletPay}
        onBack={() => setPaymentStep('details')} onWalletBuy={handleWalletBuy}
        onBinance={() => initPayment('binance')} onRazorpay={() => initPayment('razorpay')}
        onGuestOrder={handleWalletBuy}
      />
    );
  }

  if (paymentStep === 'binance') {
    return (
      <BinancePaymentScreen
        open={open} onOpenChange={handleOpenChange}
        amountUsd={amountUsd} paymentNote={paymentNote} verifying={verifying}
        onBack={() => setPaymentStep('method')} onVerify={() => verifyPayment('binance')}
      />
    );
  }

  if (paymentStep === 'razorpay') {
    return (
      <RazorpayPaymentScreen
        open={open} onOpenChange={handleOpenChange}
        finalTotal={finalTotal} paymentNote={paymentNote} verifying={verifying}
        onBack={() => setPaymentStep('method')} onVerify={() => verifyPayment('razorpay')}
      />
    );
  }

  return (
    <DetailsScreen
      open={open} onOpenChange={handleOpenChange}
      product={product} selectedVariation={selectedVariation} currentPrice={currentPrice}
      quantity={quantity} onQuantityChange={onQuantityChange}
      currentStock={currentStock} exceedsStock={exceedsStock}
      userNote={userNote} onUserNoteChange={onUserNoteChange}
      totalPrice={totalPrice} walletBalance={walletBalance}
      isLoggedIn={isLoggedIn} loading={loading}
      guestName={guestName} setGuestName={setGuestName}
      guestEmail={guestEmail} setGuestEmail={setGuestEmail}
      guestPhone={guestPhone} setGuestPhone={setGuestPhone}
      guestErrors={guestErrors} setGuestErrors={setGuestErrors}
      couponCode={couponCode} setCouponCode={setCouponCode}
      appliedCoupon={appliedCoupon} couponLoading={couponLoading}
      couponError={couponError} setCouponError={setCouponError}
      onValidateCoupon={handleValidateCoupon} onRemoveCoupon={() => { setAppliedCoupon(null); setCouponError(''); }}
      donationEnabled={donationEnabled} setDonationEnabled={setDonationEnabled}
      donationAmount={donationAmount} setDonationAmount={setDonationAmount}
      isBulkOrder={isBulkOrder} bulkDiscountAmount={bulkDiscountAmount}
      couponDiscountAmount={couponDiscountAmount} donation={donation} finalTotal={finalTotal}
      onProceed={handleProceedToPayment}
    />
  );
};

export default PurchaseModal;
