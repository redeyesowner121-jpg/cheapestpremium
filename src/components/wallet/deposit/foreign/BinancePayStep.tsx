import React from 'react';
import { Copy, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatTime } from './binanceUtils';

interface Props {
  amountUsd: number;
  timeLeft: number;
  binanceId: string;
  binanceOrderId: string;
  onBinanceOrderIdChange: (v: string) => void;
  verifying: boolean;
  onVerify: () => void;
  onCancel: () => void;
}

export const BinancePayStep: React.FC<Props> = ({
  amountUsd, timeLeft, binanceId, binanceOrderId, onBinanceOrderIdChange,
  verifying, onVerify, onCancel,
}) => {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
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
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copy(binanceId)}><Copy className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>
      <div className="p-3 bg-primary/5 rounded-xl text-sm space-y-1">
        <p className="font-medium text-foreground">Instructions:</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
          <li>Open Binance App → Pay → Send</li>
          <li>Enter Pay ID: <b>{binanceId}</b></li>
          <li>Amount: <b>${amountUsd}</b></li>
          <li>Complete payment</li>
          <li>Copy your <b>Order ID</b> from Binance</li>
          <li>Paste below & verify</li>
        </ol>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1 font-medium">📋 Binance Order ID</p>
        <Input placeholder="Enter your Binance Order ID" value={binanceOrderId}
          onChange={(e) => onBinanceOrderIdChange(e.target.value)} className="font-mono" />
      </div>
      <Button onClick={onVerify} className="w-full h-12 btn-gradient rounded-xl" disabled={verifying || !binanceOrderId.trim()}>
        {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : '✅ Verify Payment'}
      </Button>
      <Button variant="ghost" onClick={onCancel} className="w-full rounded-xl text-destructive">❌ Cancel</Button>
    </div>
  );
};
