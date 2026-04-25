import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_INR_TO_USD_RATE } from './binanceUtils';

interface Props {
  amountInr: string;
  onAmountInrChange: (v: string) => void;
  feePercent: number;
  onContinue: () => void;
  onBack: () => void;
}

export const BinanceAmountStep: React.FC<Props> = ({
  amountInr, onAmountInrChange, feePercent, onContinue, onBack,
}) => (
  <div className="mt-4 space-y-4">
    <Input
      type="number" placeholder="Enter amount in ₹" value={amountInr}
      onChange={(e) => onAmountInrChange(e.target.value)}
      className="h-14 text-2xl text-center font-bold rounded-xl"
    />
    {parseFloat(amountInr) > 0 && (
      <div className="p-3 bg-muted rounded-xl text-center space-y-1">
        <p className="text-sm text-muted-foreground">You will pay</p>
        <p className="text-xl font-bold text-foreground">
          ${Math.max(0.01, Math.round((parseFloat(amountInr) / DEFAULT_INR_TO_USD_RATE) * 100) / 100)} USDT
        </p>
        <p className="text-xs text-muted-foreground">{feePercent}% processing fee applies</p>
      </div>
    )}
    <div className="flex gap-2 flex-wrap">
      {[500, 1000, 2000, 5000].map(a => (
        <Button key={a} variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => onAmountInrChange(a.toString())}>₹{a}</Button>
      ))}
    </div>
    <Button onClick={onContinue} className="w-full h-12 btn-gradient rounded-xl" disabled={!amountInr || parseFloat(amountInr) < 1}>
      Continue
    </Button>
    <Button variant="ghost" onClick={onBack} className="w-full rounded-xl">← Back</Button>
  </div>
);
