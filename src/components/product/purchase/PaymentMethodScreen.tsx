import React from 'react';
import { Wallet, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';

interface PaymentMethodScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalTotal: number;
  amountUsd: number;
  walletBalance: number;
  isLoggedIn: boolean;
  canWalletPay: boolean;
  onBack: () => void;
  onWalletBuy: () => void;
  onBinance: () => void;
  onRazorpay: () => void;
  onGuestOrder: () => void;
}

const PaymentMethodScreen: React.FC<PaymentMethodScreenProps> = ({
  open, onOpenChange, finalTotal, amountUsd, walletBalance,
  isLoggedIn, canWalletPay, onBack, onWalletBuy, onBinance, onRazorpay, onGuestOrder
}) => {
  const { formatPrice } = useCurrencyFormat();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button onClick={onBack} className="p-1 hover:bg-muted rounded-lg">
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
              onClick={onWalletBuy}
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
            onClick={onBinance}
          >
            <span className="text-lg">₿</span>
            <div className="text-left">
              <p className="font-semibold">Binance Pay</p>
              <p className="text-xs opacity-70">${amountUsd} USD</p>
            </div>
          </Button>

          <Button
            className="w-full h-14 rounded-xl justify-start gap-3 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onRazorpay}
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
              onClick={onGuestOrder}
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
};

export default PaymentMethodScreen;
