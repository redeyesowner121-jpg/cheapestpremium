import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Loader2, MessageCircle, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

interface BinanceScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: string;
  onDepositAmountChange: (amount: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  transactionId: string;
  onTransactionIdChange: (id: string) => void;
  onManualDeposit: () => void;
  submittingManual: boolean;
  onBack: () => void;
}

type BinanceStep = 'amount' | 'confirm' | 'pay';

export const BinancePayScreen: React.FC<BinanceScreenProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange, onBack
}) => {
  const { settings } = useAppSettingsContext();
  const { user } = useAuth();
  const [step, setStep] = useState<BinanceStep>('amount');
  const [amountInr, setAmountInr] = useState('');
  const [amountUsd, setAmountUsd] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [amountConflict, setAmountConflict] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const feePercent = settings.foreign_deposit_fee_percent || 10;
  const binanceId = settings.binance_id || '1178303416';

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('amount');
      setAmountInr('');
      setAmountUsd(0);
      setPaymentNote('');
      setReservationId(null);
      setPaymentId(null);
      setVerified(false);
      setAmountConflict(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (step === 'pay' && expiresAt) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          // Expired — clean up
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          // Mark reservation expired
          if (reservationId) {
            supabase.from('binance_amount_reservations' as any)
              .update({ status: 'expired' } as any)
              .eq('id', reservationId)
              .then(() => {});
          }
          setStep('amount');
          setReservationId(null);
          toast.error('Time expired! Please type another amount.');
        }
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [step, expiresAt, reservationId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleContinue = () => {
    const inr = parseFloat(amountInr);
    if (!inr || inr < 1) { toast.error('Enter a valid amount'); return; }
    const usd = Math.max(0.01, Math.round((inr / INR_TO_USD_RATE) * 100) / 100);
    setAmountUsd(usd);
    setStep('confirm');
  };

  const handleConfirmReserve = async () => {
    if (!user?.id) { toast.error('Please login first'); return; }
    setReserving(true);
    setAmountConflict(false);

    try {
      const note = generatePaymentNote();
      const inr = parseFloat(amountInr);
      const usd = amountUsd;

      // Check if this USD amount is already reserved
      const { data: existing } = await supabase
        .from('binance_amount_reservations' as any)
        .select('id')
        .eq('amount_usd', usd)
        .eq('status', 'reserved')
        .gt('expires_at', new Date().toISOString())
        .neq('user_id', user.id);

      if (existing && (existing as any[]).length > 0) {
        setAmountConflict(true);
        setReserving(false);
        return;
      }

      // Create payment record
      const { data: payment } = await supabase.from('payments' as any).insert({
        user_id: user.id,
        amount: inr,
        amount_usd: usd,
        note,
        status: 'pending',
        payment_method: 'binance',
        product_name: 'Wallet Deposit',
      } as any).select('id').single();

      const expiry = new Date(Date.now() + 20 * 60 * 1000);

      // Create reservation
      const { data: reservation } = await supabase.from('binance_amount_reservations' as any).insert({
        user_id: user.id,
        amount_usd: usd,
        amount_inr: inr,
        payment_id: (payment as any)?.id,
        status: 'reserved',
        expires_at: expiry.toISOString(),
      } as any).select('id').single();

      setPaymentNote(note);
      setPaymentId((payment as any)?.id || null);
      setReservationId((reservation as any)?.id || null);
      setExpiresAt(expiry);
      setTimeLeft(20 * 60);
      setStep('pay');
    } catch (err) {
      console.error('Reserve error:', err);
      toast.error('Failed to reserve amount. Try again.');
    } finally {
      setReserving(false);
    }
  };

  const handleVerify = useCallback(async () => {
    if (verifying || verified) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-binance-payment', {
        body: { note: paymentNote, amount: amountUsd, paymentId },
      });

      if (data?.success) {
        setVerified(true);
        if (pollingRef.current) clearInterval(pollingRef.current);

        // Mark reservation completed
        if (reservationId) {
          await supabase.from('binance_amount_reservations' as any)
            .update({ status: 'completed' } as any)
            .eq('id', reservationId);
        }

        // Credit wallet
        const inr = parseFloat(amountInr);
        const feeAmount = Math.round(inr * feePercent) / 100;
        const creditAmount = Math.round((inr - feeAmount) * 100) / 100;

        const { data: profile } = await supabase.from('profiles').select('wallet_balance, rank_balance, total_deposit').eq('id', user!.id).single();
        if (profile) {
          await supabase.from('profiles').update({
            wallet_balance: (profile.wallet_balance || 0) + creditAmount,
            rank_balance: (profile.rank_balance || 0) + creditAmount,
            total_deposit: (profile.total_deposit || 0) + creditAmount,
          }).eq('id', user!.id);

          await supabase.from('transactions').insert({
            user_id: user!.id,
            type: 'deposit',
            amount: creditAmount,
            status: 'completed',
            description: `Binance Auto Deposit ($${amountUsd})`,
          });

          await supabase.from('notifications').insert({
            user_id: user!.id,
            title: 'Deposit Successful! 💰',
            message: `₹${creditAmount} has been added to your wallet.`,
            type: 'wallet',
          });
        }

        toast.success(`₹${creditAmount} deposited successfully!`);
      } else {
        // Not yet verified
      }
    } catch (err) {
      console.error('Verify error:', err);
    } finally {
      setVerifying(false);
    }
  }, [verifying, verified, paymentNote, amountUsd, paymentId, reservationId, amountInr, feePercent, user]);

  // Auto-polling every 10 seconds
  useEffect(() => {
    if (step === 'pay' && !verified && paymentNote) {
      pollingRef.current = setInterval(() => { handleVerify(); }, 10000);
      return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }
  }, [step, verified, paymentNote, handleVerify]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'amount' && '💎 Binance Deposit'}
            {step === 'confirm' && '💎 Confirm Amount'}
            {step === 'pay' && (verified ? '✅ Payment Verified!' : '💎 Complete Payment')}
          </DialogTitle>
          <DialogDescription>
            {step === 'amount' && 'Enter the amount you want to deposit'}
            {step === 'confirm' && 'Confirm your deposit details'}
            {step === 'pay' && (verified ? 'Your balance has been updated' : `Pay within ${formatTime(timeLeft)}`)}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="mt-4 space-y-4">
            <Input
              type="number"
              placeholder="Enter amount in ₹"
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
              className="h-14 text-2xl text-center font-bold rounded-xl"
            />
            {parseFloat(amountInr) > 0 && (
              <div className="p-3 bg-muted rounded-xl text-center space-y-1">
                <p className="text-sm text-muted-foreground">You will pay</p>
                <p className="text-xl font-bold text-foreground">
                  ${Math.max(0.01, Math.round((parseFloat(amountInr) / INR_TO_USD_RATE) * 100) / 100)} USDT
                </p>
                <p className="text-xs text-muted-foreground">{feePercent}% processing fee applies</p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {[500, 1000, 2000, 5000].map(a => (
                <Button key={a} variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => setAmountInr(a.toString())}>₹{a}</Button>
              ))}
            </div>
            <Button onClick={handleContinue} className="w-full h-12 btn-gradient rounded-xl" disabled={!amountInr || parseFloat(amountInr) < 1}>
              Continue
            </Button>
            <Button variant="ghost" onClick={onBack} className="w-full rounded-xl">← Back</Button>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && (
          <div className="mt-4 space-y-4">
            {amountConflict && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-center">
                <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-destructive" />
                <p className="text-sm font-semibold text-destructive">This amount is currently reserved by another user.</p>
                <p className="text-xs text-muted-foreground mt-1">Please type another amount.</p>
              </div>
            )}
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-2">
              <p className="text-sm text-muted-foreground">Deposit Amount</p>
              <p className="text-3xl font-bold text-foreground">₹{parseFloat(amountInr)}</p>
              <p className="text-lg font-semibold text-amber-600">${amountUsd} USDT</p>
            </div>

            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-center">
              <p className="font-bold text-destructive">⚠️ {feePercent}% Processing Fee</p>
              <p className="text-xs text-muted-foreground mt-1">₹{Math.round(parseFloat(amountInr) * feePercent) / 100} fee will be deducted</p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-center">
              <Clock className="w-4 h-4 mx-auto mb-1 text-blue-500" />
              <p className="text-xs text-muted-foreground">Amount will be reserved for <b>20 minutes</b>. No other user can use this amount during this time.</p>
            </div>

            <Button onClick={handleConfirmReserve} className="w-full h-12 btn-gradient rounded-xl" disabled={reserving || amountConflict}>
              {reserving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reserving...</> : 'Confirm & Reserve'}
            </Button>
            <Button variant="ghost" onClick={() => { setStep('amount'); setAmountConflict(false); }} className="w-full rounded-xl">← Change Amount</Button>
          </div>
        )}

        {/* Step 3: Pay */}
        {step === 'pay' && !verified && (
          <div className="mt-4 space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-2">
              <p className="text-sm text-muted-foreground">Pay exactly</p>
              <p className="text-3xl font-bold text-foreground">${amountUsd} USDT</p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className={`font-mono font-bold ${timeLeft < 120 ? 'text-destructive' : 'text-amber-600'}`}>{formatTime(timeLeft)}</span>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Binance Pay ID</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-foreground">{binanceId}</code>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(binanceId)}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Note</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">{paymentNote}</code>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(paymentNote)}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-primary/5 rounded-xl text-sm space-y-1">
              <p className="font-medium text-foreground">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>Open Binance App → Pay → Send</li>
                <li>Enter Pay ID: <b>{binanceId}</b></li>
                <li>Amount: <b>${amountUsd}</b></li>
                <li>Note: <b>{paymentNote}</b> (must match exactly!)</li>
                <li>Complete payment & click Verify</li>
              </ol>
            </div>

            <Button onClick={handleVerify} className="w-full h-12 btn-gradient rounded-xl" disabled={verifying}>
              {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : '✅ Verify Payment'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Auto-checking every 10 seconds...</p>
            <Button variant="ghost" onClick={() => {
              if (pollingRef.current) clearInterval(pollingRef.current);
              if (reservationId) {
                supabase.from('binance_amount_reservations' as any)
                  .update({ status: 'cancelled' } as any)
                  .eq('id', reservationId).then(() => {});
              }
              setStep('amount');
              setReservationId(null);
            }} className="w-full rounded-xl text-destructive">❌ Cancel</Button>
          </div>
        )}

        {/* Verified */}
        {step === 'pay' && verified && (
          <div className="mt-4 space-y-4 text-center">
            <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-lg font-bold text-foreground">Payment Verified!</p>
            <p className="text-sm text-muted-foreground">₹{Math.round((parseFloat(amountInr) - parseFloat(amountInr) * feePercent / 100) * 100) / 100} has been added to your wallet.</p>
            <Button onClick={() => onOpenChange(false)} className="w-full h-12 btn-gradient rounded-xl">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface NoBinanceScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foreignCountry: string;
  foreignFlag: string;
  onBack: () => void;
}

export const NoBinanceScreen: React.FC<NoBinanceScreenProps> = ({ open, onOpenChange, foreignCountry, foreignFlag, onBack }) => {
  const { settings } = useAppSettingsContext();
  const { profile } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Contact Seller</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 text-center">
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">{settings.binance_contact_message}</p>
          {settings.contact_whatsapp && (
            <Button
              onClick={() => {
                const msg = [
                  `🔹 *Deposit Request - No Binance*`, ``,
                  `👤 *Name:* ${profile?.name || 'N/A'}`,
                  `📧 *Email:* ${profile?.email || 'N/A'}`,
                  `📱 *Phone:* ${profile?.phone || 'N/A'}`,
                  `🌍 *Country:* ${foreignFlag} ${foreignCountry}`,
                  `💰 *Purpose:* I want to deposit money but I don't have Binance.`, ``,
                  `Please help me with an alternative payment method.`
                ].join('%0A');
                window.open(`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
              }}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
            >
              <MessageCircle className="w-5 h-5 mr-2" />Contact on WhatsApp
            </Button>
          )}
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
      </DialogContent>
    </Dialog>
  );
};

interface BinanceQuestionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foreignCountry: string;
  foreignFlag: string;
  onHasBinance: () => void;
  onNoBinance: () => void;
  onBack: () => void;
}

export const BinanceQuestion: React.FC<BinanceQuestionProps> = ({ open, onOpenChange, foreignCountry, foreignFlag, onHasBinance, onNoBinance, onBack }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm mx-auto rounded-3xl">
      <DialogHeader>
        <DialogTitle>Do you have Binance?</DialogTitle>
        <DialogDescription>Select your payment method for {foreignFlag} {foreignCountry}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-4">
        <button onClick={onHasBinance} className="w-full p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-4 hover:bg-amber-500/20 transition-colors active:scale-[0.98]">
          <span className="text-3xl">💰</span>
          <div className="text-left">
            <p className="font-semibold text-foreground">Yes, I have Binance</p>
            <p className="text-xs text-muted-foreground">Pay via Binance Pay ID</p>
          </div>
        </button>
        <button onClick={onNoBinance} className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]">
          <span className="text-3xl">❌</span>
          <div className="text-left">
            <p className="font-semibold text-foreground">No, I don't have Binance</p>
            <p className="text-xs text-muted-foreground">Contact seller for alternatives</p>
          </div>
        </button>
      </div>
      <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
    </DialogContent>
  </Dialog>
);
