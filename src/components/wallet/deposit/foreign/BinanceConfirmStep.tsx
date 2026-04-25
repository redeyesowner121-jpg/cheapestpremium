import React from 'react';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  amountInr: string;
  amountUsd: number;
  feePercent: number;
  amountConflict: boolean;
  reserving: boolean;
  onConfirm: () => void;
  onChangeAmount: () => void;
}

export const BinanceConfirmStep: React.FC<Props> = ({
  amountInr, amountUsd, feePercent, amountConflict, reserving, onConfirm, onChangeAmount,
}) => (
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
    <Button onClick={onConfirm} className="w-full h-12 btn-gradient rounded-xl" disabled={reserving || amountConflict}>
      {reserving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reserving...</> : 'Confirm & Reserve'}
    </Button>
    <Button variant="ghost" onClick={onChangeAmount} className="w-full rounded-xl">← Change Amount</Button>
  </div>
);
