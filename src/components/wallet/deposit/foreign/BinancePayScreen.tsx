import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_INR_TO_USD_RATE, generatePaymentNote, formatTime } from './binanceUtils';
import { BinanceAmountStep } from './BinanceAmountStep';
import { BinanceConfirmStep } from './BinanceConfirmStep';
import { BinancePayStep } from './BinancePayStep';
import { BinanceSuccessStep } from './BinanceSuccessStep';

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
  open, onOpenChange, onBack,
}) => {
  const { settings } = useAppSettingsContext();
  const { user } = useAuth();
  const [step, setStep] = useState<BinanceStep>('amount');
  const [amountInr, setAmountInr] = useState('');
  const [amountUsd, setAmountUsd] = useState(0);
  const [binanceOrderId, setBinanceOrderId] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [amountConflict, setAmountConflict] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const feePercent = settings.foreign_deposit_fee_percent || 10;
  const binanceId = settings.binance_id || '1178303416';

  useEffect(() => {
    if (!open) {
      setStep('amount'); setAmountInr(''); setAmountUsd(0); setBinanceOrderId('');
      setReservationId(null); setPaymentId(null); setVerified(false); setAmountConflict(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (step === 'pay' && expiresAt) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          if (reservationId) {
            supabase.from('binance_amount_reservations' as any)
              .update({ status: 'expired' } as any).eq('id', reservationId).then(() => {});
          }
          setStep('amount'); setReservationId(null);
          toast.error('Time expired! Please type another amount.');
        }
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [step, expiresAt, reservationId]);

  const handleContinue = () => {
    const inr = parseFloat(amountInr);
    if (!inr || inr < 1) { toast.error('Enter a valid amount'); return; }
    const usd = Math.max(0.01, Math.round((inr / DEFAULT_INR_TO_USD_RATE) * 100) / 100);
    setAmountUsd(usd);
    setStep('confirm');
  };

  const handleConfirmReserve = async () => {
    if (!user?.id) { toast.error('Please login first'); return; }
    setReserving(true); setAmountConflict(false);
    try {
      generatePaymentNote();
      const inr = parseFloat(amountInr);
      const usd = amountUsd;
      const { data: existing } = await supabase
        .from('binance_amount_reservations' as any)
        .select('id').eq('amount_usd', usd).eq('status', 'reserved')
        .gt('expires_at', new Date().toISOString()).neq('user_id', user.id);
      if (existing && (existing as any[]).length > 0) {
        setAmountConflict(true); setReserving(false); return;
      }
      const { data: payment } = await supabase.from('payments' as any).insert({
        user_id: user.id, amount: inr, amount_usd: usd,
        note: 'BINANCE_ORDER_ID_PENDING', status: 'pending',
        payment_method: 'binance', product_name: 'Wallet Deposit',
      } as any).select('id').single();
      const expiry = new Date(Date.now() + 20 * 60 * 1000);
      const { data: reservation } = await supabase.from('binance_amount_reservations' as any).insert({
        user_id: user.id, amount_usd: usd, amount_inr: inr,
        payment_id: (payment as any)?.id, status: 'reserved',
        expires_at: expiry.toISOString(),
      } as any).select('id').single();
      setPaymentId((payment as any)?.id || null);
      setReservationId((reservation as any)?.id || null);
      setExpiresAt(expiry); setTimeLeft(20 * 60); setStep('pay');
    } catch (err) {
      console.error('Reserve error:', err);
      toast.error('Failed to reserve amount. Try again.');
    } finally { setReserving(false); }
  };

  const handleVerify = useCallback(async () => {
    if (verifying || verified || !binanceOrderId.trim()) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-binance-payment', {
        body: { orderId: binanceOrderId.trim(), amount: amountUsd, paymentId },
      });
      if (error) {
        console.error('Verify invoke error:', error);
        toast.error('Verification service error. Please try again.'); return;
      }
      if (data?.success) {
        setVerified(true);
        if (reservationId) {
          await supabase.from('binance_amount_reservations' as any)
            .update({ status: 'completed' } as any).eq('id', reservationId);
        }
        const inr = parseFloat(amountInr);
        const feeAmount = Math.round(inr * feePercent) / 100;
        const creditAmount = Math.round((inr - feeAmount) * 100) / 100;
        const { data: profile } = await supabase.from('profiles')
          .select('wallet_balance, rank_balance, total_deposit').eq('id', user!.id).single();
        if (profile) {
          await supabase.from('profiles').update({
            wallet_balance: (profile.wallet_balance || 0) + creditAmount,
            rank_balance: (profile.rank_balance || 0) + creditAmount,
            total_deposit: (profile.total_deposit || 0) + creditAmount,
          }).eq('id', user!.id);
          await supabase.from('transactions').insert({
            user_id: user!.id, type: 'deposit', amount: creditAmount,
            status: 'completed', description: `Binance Auto Deposit ($${amountUsd})`,
          });
          await supabase.from('notifications').insert({
            user_id: user!.id, title: 'Deposit Successful! 💰',
            message: `₹${creditAmount} has been added to your wallet.`, type: 'wallet',
          });
        }
        toast.success(`₹${creditAmount} deposited successfully!`);
      } else if (data?.alreadyClaimed) {
        toast.error(data.message || 'This Order ID has already been claimed.');
      } else if (data?.idFoundButAmountMismatch) {
        toast.error(`Order found but amount mismatch (paid: $${data.foundAmount ?? '?'}, expected: $${amountUsd}). Contact support.`, { duration: 6000 });
      } else {
        toast.error(data?.message || 'Payment not found yet. Wait 1-2 minutes and try again.', { duration: 5000 });
      }
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally { setVerifying(false); }
  }, [verifying, verified, binanceOrderId, amountUsd, paymentId, reservationId, amountInr, feePercent, user]);

  const handleCancelPay = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (reservationId) {
      supabase.from('binance_amount_reservations' as any)
        .update({ status: 'cancelled' } as any).eq('id', reservationId).then(() => {});
    }
    setStep('amount'); setReservationId(null);
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

        {step === 'amount' && (
          <BinanceAmountStep
            amountInr={amountInr} onAmountInrChange={setAmountInr}
            feePercent={feePercent} onContinue={handleContinue} onBack={onBack}
          />
        )}
        {step === 'confirm' && (
          <BinanceConfirmStep
            amountInr={amountInr} amountUsd={amountUsd} feePercent={feePercent}
            amountConflict={amountConflict} reserving={reserving}
            onConfirm={handleConfirmReserve}
            onChangeAmount={() => { setStep('amount'); setAmountConflict(false); }}
          />
        )}
        {step === 'pay' && !verified && (
          <BinancePayStep
            amountUsd={amountUsd} timeLeft={timeLeft} binanceId={binanceId}
            binanceOrderId={binanceOrderId} onBinanceOrderIdChange={setBinanceOrderId}
            verifying={verifying} onVerify={handleVerify} onCancel={handleCancelPay}
          />
        )}
        {step === 'pay' && verified && (
          <BinanceSuccessStep
            amountInr={amountInr} feePercent={feePercent}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
