import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  amountInr: string;
  feePercent: number;
  onDone: () => void;
}

export const BinanceSuccessStep: React.FC<Props> = ({ amountInr, feePercent, onDone }) => {
  const credit = Math.round((parseFloat(amountInr) - parseFloat(amountInr) * feePercent / 100) * 100) / 100;
  return (
    <div className="mt-4 space-y-4 text-center">
      <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <p className="text-lg font-bold text-foreground">Payment Verified!</p>
      <p className="text-sm text-muted-foreground">₹{credit} has been added to your wallet.</p>
      <Button onClick={onDone} className="w-full h-12 btn-gradient rounded-xl">Done</Button>
    </div>
  );
};
