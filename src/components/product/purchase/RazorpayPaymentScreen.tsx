import React from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RazorpayPaymentScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalTotal: number;
  paymentNote: string;
  verifying: boolean;
  onBack: () => void;
  onVerify: () => void;
  onPayClicked?: () => void;
}

const RazorpayPaymentScreen: React.FC<RazorpayPaymentScreenProps> = ({
  open, onOpenChange, finalTotal, paymentNote, verifying, onBack, onVerify, onPayClicked
}) => {
  const handlePayNow = () => {
    onPayClicked?.();
    window.open('https://razorpay.me/@asifikbalrubaiulislam', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button onClick={onBack} className="p-1 hover:bg-muted rounded-lg">
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
          </div>

          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted rounded-lg">
            <p>1. Click <b>Pay Now</b> to open payment page</p>
            <p>2. Pay exactly <b>₹{finalTotal}</b></p>
            <p>3. Complete payment & click <b>Verify</b> below</p>
            <p className="text-destructive font-medium mt-1">⚠️ Verify within 2 minutes of paying!</p>
          </div>

          <Button
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handlePayNow}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Pay Now
          </Button>

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

export default RazorpayPaymentScreen;
