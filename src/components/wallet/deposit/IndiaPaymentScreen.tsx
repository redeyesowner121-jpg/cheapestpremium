import React, { useState, useCallback } from 'react';
import {
  CreditCard, QrCode, Smartphone, AlertCircle,
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
  depositTab: 'auto' | 'manual' | 'card';
  onTabChange: (tab: 'auto' | 'manual' | 'card') => void;
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
  const [showCardConfirm, setShowCardConfirm] = useState(false);
  const [submittingCard, setSubmittingCard] = useState(false);
  const [manualAttempted, setManualAttempted] = useState(false);

  // Auto (Razorpay link) state - no code needed
  const [autoStep, setAutoStep] = useState<'amount' | 'pay'>('amount');
  const [verifying, setVerifying] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [payClickedAt, setPayClickedAt] = useState<string | null>(null);
  const [uniqueAmount, setUniqueAmount] = useState<number | null>(null);

  const basePaymentLink = settings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam';

  // Generate unique paise (01-99) to avoid collision when multiple users pay same amount
  const generateUniqueAmount = (baseAmount: number): number => {
    const extraPaise = Math.floor(Math.random() * 99) + 1; // 1-99 paise
    return parseFloat((baseAmount + extraPaise / 100).toFixed(2));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleStartAutoPay = async () => {
    if (!user) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < (settings.min_deposit || 10)) {
      toast.error(`Minimum deposit is ₹${settings.min_deposit || 10}`);
      return;
    }

    // Generate unique amount with extra paise
    const uAmount = generateUniqueAmount(amount);
    setUniqueAmount(uAmount);

    // Create payment record with unique amount
    try {
      const { data, error } = await supabase.from('manual_deposit_requests').insert({
        user_id: user.id,
        amount: uAmount,
        transaction_id: `RAZORPAY-${Date.now()}`,
        sender_name: profile?.name || 'Razorpay Payment',
        payment_method: 'razorpay_auto',
        status: 'pending',
      }).select('id').single();
      if (error) throw error;
      setPaymentId(data?.id || null);
    } catch {
      // Continue even if tracking insert fails
    }

    setAutoStep('pay');
  };

  const handlePayNowClick = () => {
    const now = new Date().toISOString();
    setPayClickedAt(now);
    const payAmount = uniqueAmount || parseFloat(depositAmount);
    const amountPaise = Math.round(payAmount * 100);
    const linkWithAmount = `${basePaymentLink}?amount=${amountPaise}`;
    // Persist to sessionStorage so it survives reload
    sessionStorage.setItem('razorpay_pay_clicked_at', now);
    sessionStorage.setItem('razorpay_deposit_amount', payAmount.toString());
    sessionStorage.setItem('razorpay_deposit_id', paymentId || '');
    sessionStorage.setItem('razorpay_unique_amount', payAmount.toString());
    window.open(linkWithAmount, '_blank');
  };

  // Restore state from sessionStorage on mount (handles reload)
  React.useEffect(() => {
    const savedClickedAt = sessionStorage.getItem('razorpay_pay_clicked_at');
    const savedAmount = sessionStorage.getItem('razorpay_deposit_amount');
    const savedDepositId = sessionStorage.getItem('razorpay_deposit_id');
    const savedUniqueAmount = sessionStorage.getItem('razorpay_unique_amount');
    if (savedClickedAt && savedAmount) {
      const elapsed = Date.now() - new Date(savedClickedAt).getTime();
      if (elapsed < 10 * 60 * 1000) {
        setPayClickedAt(savedClickedAt);
        onDepositAmountChange(savedAmount);
        if (savedDepositId) setPaymentId(savedDepositId);
        if (savedUniqueAmount) setUniqueAmount(parseFloat(savedUniqueAmount));
        setAutoStep('pay');
      } else {
        sessionStorage.removeItem('razorpay_pay_clicked_at');
        sessionStorage.removeItem('razorpay_deposit_amount');
        sessionStorage.removeItem('razorpay_deposit_id');
        sessionStorage.removeItem('razorpay_unique_amount');
      }
    }
  }, []);

  // Auto-polling: check every 10 seconds once payClickedAt is set
  React.useEffect(() => {
    if (!payClickedAt || !user || autoStep !== 'pay') return;
    
    let cancelled = false;
    const poll = async () => {
      if (cancelled || verifying) return;
      setVerifying(true);
      try {
        const amt = parseFloat(sessionStorage.getItem('razorpay_unique_amount') || sessionStorage.getItem('razorpay_deposit_amount') || depositAmount);
        const depId = sessionStorage.getItem('razorpay_deposit_id') || paymentId;
        const clickAt = sessionStorage.getItem('razorpay_pay_clicked_at') || payClickedAt;
        
        const { data, error } = await supabase.functions.invoke('verify-razorpay-note', {
          body: { amount: amt, userId: user.id, depositRequestId: depId || undefined, payClickedAt: clickAt }
        });
        if (cancelled) return;
        if (!error && data?.success) {
          toast.success('Payment verified! Wallet credited. ✅');
          setAutoStep('amount');
          setPaymentId(null);
          setPayClickedAt(null);
          setUniqueAmount(null);
          onDepositAmountChange('');
          sessionStorage.removeItem('razorpay_pay_clicked_at');
          sessionStorage.removeItem('razorpay_deposit_amount');
          sessionStorage.removeItem('razorpay_deposit_id');
          sessionStorage.removeItem('razorpay_unique_amount');
          onOpenChange(false);
          return; // Stop polling
        }
      } catch {
        // Silently continue polling
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    // Start polling after 10 seconds, then every 10 seconds
    const timerId = setTimeout(() => {
      poll();
      const intervalId = setInterval(poll, 10000);
      // Stop after 10 minutes
      const maxTimer = setTimeout(() => { clearInterval(intervalId); }, 10 * 60 * 1000);
      // Cleanup
      const cleanup = () => { clearInterval(intervalId); clearTimeout(maxTimer); };
      // Store cleanup for the effect
      (window as any).__razorpayPollCleanup = cleanup;
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
        body: { amount: verifyAmount, userId: user.id, depositRequestId: paymentId, payClickedAt }
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Payment verified! Wallet credited. ✅');
        setAutoStep('amount');
        setPaymentId(null);
        setPayClickedAt(null);
        setUniqueAmount(null);
        onDepositAmountChange('');
        sessionStorage.removeItem('razorpay_pay_clicked_at');
        sessionStorage.removeItem('razorpay_deposit_amount');
        sessionStorage.removeItem('razorpay_deposit_id');
        sessionStorage.removeItem('razorpay_unique_amount');
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setAutoStep('amount'); setPayClickedAt(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Add money to your wallet securely.</DialogDescription>
        </DialogHeader>

        <Tabs value={depositTab} onValueChange={(v) => { onTabChange(v as any); setShowCardConfirm(false); setAutoStep('amount'); setPayClickedAt(null); }} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="auto" className="rounded-lg text-xs">
              <Smartphone className="w-3.5 h-3.5 mr-1" />Auto
            </TabsTrigger>
            <TabsTrigger value="manual" className="rounded-lg text-xs">
              <QrCode className="w-3.5 h-3.5 mr-1" />Manual
            </TabsTrigger>
            <TabsTrigger value="card" className="rounded-lg text-xs">
              <CreditCard className="w-3.5 h-3.5 mr-1" />Card
            </TabsTrigger>
          </TabsList>

          {/* Auto Tab - Razorpay link + QR, no code needed */}
          <TabsContent value="auto" className="mt-4 space-y-4">
            {autoStep === 'amount' ? (
              <>
                <Input type="number" placeholder="Enter amount" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className="h-14 text-2xl text-center font-bold rounded-xl" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
                  ))}
                </div>
                <Button onClick={handleStartAutoPay} className="w-full h-12 btn-gradient rounded-xl" disabled={!depositAmount}>
                  Continue to Pay ₹{depositAmount || '0'}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Pay exactly this amount</p>
                  <p className="text-2xl font-bold text-primary">₹{uniqueAmount || depositAmount}</p>
                  {uniqueAmount && parseFloat(depositAmount) !== uniqueAmount && (
                    <p className="text-xs text-muted-foreground">Base: ₹{depositAmount} + unique paise for verification</p>
                  )}
                </div>

                {/* QR Code */}
                {qrUrl && (
                  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-2">Scan QR or click Pay Now</p>
                    <img src={qrUrl} alt="Payment QR" className="w-40 h-40 object-contain rounded-xl border bg-white p-2" loading="lazy" />
                  </div>
                )}

                {/* Pay Now button */}
                <Button className="w-full h-12 btn-gradient rounded-xl" onClick={handlePayNowClick}>
                  <ExternalLink className="w-4 h-4 mr-2" />Pay Now ₹{uniqueAmount || depositAmount}
                </Button>

                {/* Instructions */}
                <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                  <p>1. Click <b>Pay Now</b> or scan QR</p>
                  <p>2. Pay exactly <b>₹{uniqueAmount || depositAmount}</b></p>
                  <p>3. Payment will be <b>auto-verified</b> within seconds!</p>
                  <p className="text-primary font-medium mt-1">🔄 Auto-checking every 10 seconds...</p>
                </div>

                {/* Verify & Cancel */}
                <Button onClick={handleVerifyPayment} className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground" disabled={verifying}>
                  {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : <><RefreshCw className="w-4 h-4 mr-2" />Verify Payment</>}
                </Button>
                <Button variant="ghost" onClick={() => { setAutoStep('amount'); setPayClickedAt(null); }} className="w-full rounded-xl">← Go Back</Button>
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

          {/* Card Tab */}
          <TabsContent value="card" className="mt-4 space-y-4">
            {!showCardConfirm ? (
              <>
                <Input type="number" placeholder="Enter amount" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className="h-14 text-2xl text-center font-bold rounded-xl" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
                  ))}
                </div>
                <Button onClick={() => { const amount = parseFloat(depositAmount); if (isNaN(amount) || amount < (settings.min_deposit || 10)) { toast.error(`Minimum deposit is ₹${settings.min_deposit || 10}`); return; } setShowCardConfirm(true); }} className="w-full h-12 btn-gradient rounded-xl" disabled={!depositAmount}>
                  <CreditCard className="w-5 h-5 mr-2" />Pay ₹{depositAmount || '0'} via Card
                </Button>
                <p className="text-xs text-muted-foreground text-center">You'll be redirected to the payment page</p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                  <h3 className="text-lg font-bold text-foreground">Confirm Payment</h3>
                  <p className="text-2xl font-bold text-primary">₹{depositAmount}</p>
                  <p className="text-sm text-muted-foreground">You will be redirected to the payment page. After payment, your deposit request will be automatically submitted for admin approval.</p>
                </div>
                <Button onClick={async () => {
                  if (!user || !profile) return;
                  setSubmittingCard(true);
                  try {
                    const amount = parseFloat(depositAmount);
                    const { error } = await supabase.from('manual_deposit_requests').insert({ user_id: user.id, amount, transaction_id: `CARD-${Date.now()}`, sender_name: profile.name || 'Card Payment', payment_method: 'card', status: 'pending' });
                    if (error) throw error;
                    const link = settings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam';
                    window.open(link, '_blank');
                    toast.success('Deposit request submitted! Complete payment on the redirected page.');
                    setShowCardConfirm(false);
                    onOpenChange(false);
                    onDepositAmountChange('');
                  } catch { toast.error('Failed to submit deposit request'); } finally { setSubmittingCard(false); }
                }} className="w-full h-12 btn-gradient rounded-xl" disabled={submittingCard}>
                  {submittingCard ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><CreditCard className="w-5 h-5 mr-2" />Confirm & Pay ₹{depositAmount}</>}
                </Button>
                <Button variant="ghost" onClick={() => setShowCardConfirm(false)} className="w-full rounded-xl">← Go Back</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button variant="ghost" onClick={onChangeCountry} className="w-full mt-2 rounded-xl">← Change Country</Button>
      </DialogContent>
    </Dialog>
  );
};

export default IndiaPaymentScreen;
