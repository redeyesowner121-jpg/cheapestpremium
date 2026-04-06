import React from 'react';
import { ArrowLeft, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { copyToClipboard } from './utils';

interface BinancePaymentScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountUsd: number;
  paymentNote: string;
  verifying: boolean;
  onBack: () => void;
  onVerify: () => void;
}

const BinancePaymentScreen: React.FC<BinancePaymentScreenProps> = ({
  open, onOpenChange, amountUsd, paymentNote, verifying, onBack, onVerify
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button onClick={onBack} className="p-1 hover:bg-muted rounded-lg">
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
            onClick={onVerify}
            disabled={verifying}
          >
            {verifying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying...</> : '✅ Verify Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BinancePaymentScreen;
