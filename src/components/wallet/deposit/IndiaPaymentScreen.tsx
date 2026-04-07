import React, { useState, useCallback } from 'react';
import {
  QrCode, Smartphone, AlertCircle,
  Copy, ExternalLink, Loader2, CheckCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { QUICK_AMOUNTS, type PaymentSettings } from './constants';

interface IndiaPaymentScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: string;
  onDepositAmountChange: (amount: string) => void;
  paymentSettings: PaymentSettings | null;
  loading: boolean;
  onAutoDeposit: () => void;
  onManualDeposit: () => void;
  submittingManual: boolean;
  transactionId: string;
  onTransactionIdChange: (id: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  depositTab: 'auto' | 'manual';
  onTabChange: (tab: 'auto' | 'manual') => void;
  onChangeCountry: () => void;
}

const IndiaPaymentScreen: React.FC<IndiaPaymentScreenProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange,
  paymentSettings, loading, onAutoDeposit, onManualDeposit,
  submittingManual, transactionId, onTransactionIdChange,
  senderName, onSenderNameChange, depositTab, onTabChange, onChangeCountry
}) => {
  const { settings } = useAppSettingsContext();
  const { profile, user } = useAuth();
  const [manualAttempted, setManualAttempted] = useState(false);

  // Auto flow: 3 steps — amount → confirm → pay
  const [autoStep, setAutoStep] = useState<'amount' | 'confirm' | 'pay'>('amount');
  const [verifying, setVerifying] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [payClickedAt, setPayClickedAt] = useState<string | null>(null);
  const [uniqueAmount, setUniqueAmount] = useState<number | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [depositRequestId, setDepositRequestId] = useState<string | null>(null);

  const basePaymentLink = settings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const resetAutoState = () => {
    setAutoStep('amount');
    setPayClickedAt(null);
    setUniqueAmount(null);
    setReservationId(null);
    setDepositRequestId(null);
    sessionStorage.removeItem('razorpay_pay_clicked_at');
    sessionStorage.removeItem('razorpay_deposit_amount');
    sessionStorage.removeItem('razorpay_deposit_id');
    sessionStorage.removeItem('razorpay_unique_amount');
    sessionStorage.removeItem('razorpay_reservation_id');
  };

  // Step 1 → Step 2: Show confirm screen with generated unique amount (client-side preview)
  const handleContinue = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < (settings.min_deposit || 10)) {
      toast.error(`Minimum deposit is ₹${settings.min_deposit || 10}`);
      return;
    }
    setAutoStep('confirm');
  };

  // Step 2 → Step 3: Call edge function to reserve amount server-side
  const handleConfirmReserve = async () => {
    if (!user) return;
    const amount = parseFloat(depositAmount);
    setReserving(true);
    try {
      const { data, error } = await supabase.functions.invoke('reserve-razorpay-amount', {
        body: { userId: user.id, baseAmount: Math.floor(amount) }
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setUniqueAmount(data.uniqueAmount);
      setReservationId(data.reservationId);
      setDepositRequestId(data.depositRequestId);

      // Persist to sessionStorage
      sessionStorage.setItem('razorpay_unique_amount', data.uniqueAmount.toString());
      sessionStorage.setItem('razorpay_reservation_id', data.reservationId);
      sessionStorage.setItem('razorpay_deposit_id', data.depositRequestId);
      sessionStorage.setItem('razorpay_deposit_amount', Math.floor(amount).toString());

      setAutoStep('pay');
    } catch {
      toast.error('Failed to reserve amount. Try again.');
    } finally {
      setReserving(false);
    }
  };

  const handlePayNowClick = () => {
    const now = new Date().toISOString();
    setPayClickedAt(now);
    sessionStorage.setItem('razorpay_pay_clicked_at', now);
    window.open(basePaymentLink, '_blank');
  };

  // Restore state from sessionStorage on mount
  React.useEffect(() => {
    const savedClickedAt = sessionStorage.getItem('razorpay_pay_clicked_at');
    const savedUniqueAmount = sessionStorage.getItem('razorpay_unique_amount');
    const savedReservationId = sessionStorage.getItem('razorpay_reservation_id');
    const savedDepositId = sessionStorage.getItem('razorpay_deposit_id');
    if (savedUniqueAmount && savedReservationId) {
      const savedClickTime = savedClickedAt ? new Date(savedClickedAt).getTime() : 0;
      const elapsed = savedClickTime ? Date.now() - savedClickTime : 0;
      if (!savedClickedAt || elapsed < 10 * 60 * 1000) {
        setUniqueAmount(parseFloat(savedUniqueAmount));
        setReservationId(savedReservationId);
        if (savedDepositId) setDepositRequestId(savedDepositId);
        if (savedClickedAt) setPayClickedAt(savedClickedAt);
        setAutoStep('pay');
      } else {
        resetAutoState();
      }
    }
  }, []);

  // Auto-polling every 10 seconds once payClickedAt is set
  React.useEffect(() => {
    if (!payClickedAt || !user || autoStep !== 'pay') return;

    let cancelled = false;
    const poll = async () => {
      if (cancelled || verifying) return;
      setVerifying(true);
      try {
        const amt = parseFloat(sessionStorage.getItem('razorpay_unique_amount') || '0');
        const resId = sessionStorage.getItem('razorpay_reservation_id') || reservationId;
        const depId = sessionStorage.getItem('razorpay_deposit_id') || depositRequestId;
        const clickAt = sessionStorage.getItem('razorpay_pay_clicked_at') || payClickedAt;

        const { data, error } = await supabase.functions.invoke('verify-razorpay-note', {
          body: { amount: amt, userId: user.id, reservationId: resId, depositRequestId: depId, payClickedAt: clickAt }
        });
        if (cancelled) return;
        if (!error && data?.success) {
          toast.success('Payment verified! Wallet credited. ✅');
          resetAutoState();
          onDepositAmountChange('');
          onOpenChange(false);
          return;
        }
      } catch {
        // Silently continue
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    const timerId = setTimeout(() => {
      poll();
      const intervalId = setInterval(poll, 10000);
      const maxTimer = setTimeout(() => { clearInterval(intervalId); }, 10 * 60 * 1000);
      (window as any).__razorpayPollCleanup = () => { clearInterval(intervalId); clearTimeout(maxTimer); };
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      if ((window as any).__razorpayPollCleanup) {
        (window as any).__razorpayPollCleanup();
        delete (window as any).__razorpayPollCleanup;
      }
    };
  }, [payClickedAt, user, autoStep]);

  const handleVerifyPayment = async () => {
    if (!user) return;
    setVerifying(true);
    try {
      const verifyAmount = uniqueAmount || parseFloat(depositAmount);
      const { data, error } = await supabase.functions.invoke('verify-razorpay-note', {
        body: { amount: verifyAmount, userId: user.id, reservationId, depositRequestId, payClickedAt }
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Payment verified! Wallet credited. ✅');
        resetAutoState();
        onDepositAmountChange('');
        onOpenChange(false);
      } else {
        toast.error(data?.message || 'Payment not found yet. Complete payment and try again.');
      }
    } catch {
      toast.error('Verification failed. Try again after completing payment.');
    } finally {
      setVerifying(false);
    }
  };

  const displayAmount = uniqueAmount || (depositAmount ? parseFloat(depositAmount) : 0);
  const qrUrl = displayAmount > 0
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${basePaymentLink}?amount=${Math.round(displayAmount * 100)}`)}`
    : '';

  const baseAmt = depositAmount ? Math.floor(parseFloat(depositAmount)) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAutoState(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Add money to your wallet securely.</DialogDescription>
        </DialogHeader>

        <Tabs value={depositTab} onValueChange={(v) => { onTabChange(v as any); resetAutoState(); }} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="auto" className="rounded-lg text-xs">
              <Smartphone className="w-3.5 h-3.5 mr-1" />Auto
            </TabsTrigger>
            <TabsTrigger value="manual" className="rounded-lg text-xs">
              <QrCode className="w-3.5 h-3.5 mr-1" />Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="mt-4 space-y-4">
            {/* Step 1: Enter Amount */}
            {autoStep === 'amount' && (
              <>
                <Input type="number" placeholder="Enter amount" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className="h-14 text-2xl text-center font-bold rounded-xl" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
                  ))}
                </div>
                <Button onClick={handleContinue} className="w-full h-12 btn-gradient rounded-xl" disabled={!depositAmount}>
                  Continue ₹{depositAmount || '0'}
                </Button>
              </>
            )}

            {/* Step 2: Confirm with unique amount */}
            {autoStep === 'confirm' && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Your Deposit</p>
                  <p className="text-3xl font-bold text-primary">₹{baseAmt}</p>
                  <div className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
                    <p>A verification charge of <b>2% + ₹0.10-0.50</b> will be added</p>
                    <p className="mt-1">This ensures your payment is uniquely identified</p>
                  </div>
                </div>

                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-destructive">⚠️ Important:</p>
                  <p>• The unique amount will be <b>reserved for 10 minutes</b></p>
                  <p>• You must pay the <b>exact amount</b> shown in the next step</p>
                  <p>• Only ₹{baseAmt} will be credited to your wallet</p>
                </div>

                <Button onClick={handleConfirmReserve} className="w-full h-12 btn-gradient rounded-xl" disabled={reserving}>
                  {reserving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reserving...</> : `Confirm ₹${baseAmt}`}
                </Button>
                <Button variant="ghost" onClick={() => setAutoStep('amount')} className="w-full rounded-xl">← Go Back</Button>
              </div>
            )}

            {/* Step 3: Pay */}
            {autoStep === 'pay' && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">⚠️ Pay EXACTLY this amount</p>
                  <button onClick={() => copyToClipboard((uniqueAmount || depositAmount).toString())} className="block w-full">
                    <p className="text-3xl font-bold text-primary">₹{uniqueAmount || depositAmount}</p>
                    <p className="text-xs text-primary/70 mt-1">👆 Tap to copy amount</p>
                  </button>
                  {uniqueAmount && (
                    <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-2 py-1 inline-block">
                      ₹{Math.floor(uniqueAmount)} + ₹{(uniqueAmount - Math.floor(uniqueAmount)).toFixed(2)} (2% + verification fee)
                    </p>
                  )}
                </div>

                {qrUrl && (
                  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-2">Scan QR or click Pay Now</p>
                    <img src={qrUrl} alt="Payment QR" className="w-40 h-40 object-contain rounded-xl border bg-white p-2" loading="lazy" />
                  </div>
                )}

                <Button className="w-full h-12 btn-gradient rounded-xl" onClick={handlePayNowClick}>
                  <ExternalLink className="w-4 h-4 mr-2" />Pay Now
                </Button>

                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-destructive">⚠️ IMPORTANT:</p>
                  <p>1. Click <b>Pay Now</b> to open Razorpay</p>
                  <p>2. Enter exactly <b>₹{uniqueAmount || depositAmount}</b> (copy above)</p>
                  <p>3. Amount must match <b>exactly including paise</b></p>
                  <p className="text-primary font-medium mt-1">🔄 Auto-checking every 10 seconds...</p>
                </div>

                <Button onClick={handleVerifyPayment} className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground" disabled={verifying}>
                  {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : <><RefreshCw className="w-4 h-4 mr-2" />Verify Payment</>}
                </Button>
                <Button variant="ghost" onClick={resetAutoState} className="w-full rounded-xl">← Go Back</Button>
              </div>
            )}
          </TabsContent>

          {/* Manual Tab */}
          <TabsContent value="manual" className="mt-4 space-y-4">
            <div className="space-y-3">
              <Input type="number" placeholder="Enter amount *" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className={`h-14 text-2xl text-center font-bold rounded-xl ${manualAttempted && !depositAmount ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
                ))}
              </div>
            </div>

            {paymentSettings?.upi_id?.setting_value && depositAmount && parseFloat(depositAmount) >= 10 && (
              <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                <p className="text-sm font-medium text-foreground mb-1">Scan to Pay ₹{depositAmount}</p>
                <p className="text-xs text-primary font-medium mb-3">Pay to: {paymentSettings?.upi_name?.setting_value || 'Merchant'}</p>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${paymentSettings.upi_id.setting_value}&pn=${encodeURIComponent(paymentSettings?.upi_name?.setting_value || 'Merchant')}&am=${depositAmount}&cu=INR`)}`} alt="Payment QR" className="w-48 h-48 object-contain rounded-xl border bg-white p-2" loading="lazy" />
                <Button className="w-full mt-3 btn-gradient rounded-xl" onClick={() => { window.location.href = `upi://pay?pa=${paymentSettings.upi_id.setting_value}&pn=${encodeURIComponent(paymentSettings?.upi_name?.setting_value || 'Merchant')}&am=${depositAmount}&cu=INR`; }}>
                  <Smartphone className="w-4 h-4 mr-2" />Pay Now ₹{depositAmount}
                </Button>
              </div>
            )}

            {!paymentSettings?.upi_id?.setting_value && paymentSettings?.manual_payment_qr?.setting_value && (
              <div className="flex flex-col items-center">
                <img src={paymentSettings.manual_payment_qr.setting_value} alt="Payment QR" className="w-48 h-48 object-contain rounded-xl border" />
                <p className="text-sm text-muted-foreground mt-2">Scan QR to pay</p>
              </div>
            )}

            {paymentSettings?.manual_payment_link?.setting_value && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={paymentSettings.manual_payment_link.setting_value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary truncate flex-1">{paymentSettings.manual_payment_link.setting_value}</a>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentSettings.manual_payment_link.setting_value!)}><Copy className="w-4 h-4" /></Button>
              </div>
            )}

            {paymentSettings?.manual_payment_instructions?.setting_value && (
              <div className="p-3 bg-primary/5 rounded-xl text-sm text-foreground">{paymentSettings.manual_payment_instructions.setting_value}</div>
            )}

            <div className="space-y-3">
              <Input placeholder="Your Name (Sender Name) *" value={senderName} onChange={(e) => onSenderNameChange(e.target.value)} className={`rounded-xl ${manualAttempted && !senderName.trim() ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
              <Input placeholder="Enter Transaction ID / UTR Number *" value={transactionId} onChange={(e) => onTransactionIdChange(e.target.value)} className={`rounded-xl ${manualAttempted && !transactionId.trim() ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
              <Button onClick={() => { setManualAttempted(true); if (depositAmount && transactionId.trim() && senderName.trim()) onManualDeposit(); else toast.error('Please fill all required fields'); }} className="w-full h-12 btn-gradient rounded-xl" disabled={submittingManual}>
                {submittingManual ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : `Submit Request ₹${depositAmount || '0'}`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Your deposit will be credited after admin verification</p>
            </div>
          </TabsContent>

        </Tabs>

        <Button variant="ghost" onClick={onChangeCountry} className="w-full mt-2 rounded-xl">← Change Country</Button>
      </DialogContent>
    </Dialog>
  );
};

export default IndiaPaymentScreen;
