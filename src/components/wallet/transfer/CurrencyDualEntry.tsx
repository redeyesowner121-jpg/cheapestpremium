import React from 'react';
import { ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

export type CurrencyInfo = { code: string; symbol: string; rate_to_inr: number };

interface CurrencyDualEntryProps {
  /** Amount string typed by the sender, in sender's currency */
  amount: string;
  onAmountChange: (val: string) => void;
  sender: CurrencyInfo;
  receiver: CurrencyInfo;
}

/**
 * Two stacked currency fields:
 *  - Top: editable, sender's currency
 *  - Bottom: read-only, equivalent in receiver's currency
 *
 * All conversion goes via INR using each currency's `rate_to_inr`
 * (1 INR = `rate_to_inr` of the foreign currency, matching the rest of the app).
 */
const CurrencyDualEntry: React.FC<CurrencyDualEntryProps> = ({
  amount, onAmountChange, sender, receiver,
}) => {
  const senderAmt = parseFloat(amount) || 0;
  // `rate_to_inr` stores "1 INR = X units of that currency"
  // (e.g. BDT.rate_to_inr = 1.34 means ₹1 = ৳1.34). So:
  //   foreign -> INR : divide by rate_to_inr
  //   INR -> foreign : multiply by rate_to_inr
  const inrAmount = senderAmt / (sender.rate_to_inr || 1);
  const receiverAmt = inrAmount * (receiver.rate_to_inr || 1);
  const sameCurrency = sender.code === receiver.code;

  return (
    <div className="space-y-2">
      {/* Top — sender enters */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">You send</span>
          <span className="text-xs font-medium text-foreground">{sender.code}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">{sender.symbol}</span>
          <Input
            type="number" inputMode="decimal" placeholder="0.00"
            value={amount} onChange={(e) => onAmountChange(e.target.value)}
            className="h-12 text-2xl font-bold border-0 px-0 focus-visible:ring-0 bg-transparent"
          />
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ArrowDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Bottom — receiver gets */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Receiver gets</span>
          <span className="text-xs font-medium text-foreground">{receiver.code}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">{receiver.symbol}</span>
          <span className="text-2xl font-bold text-foreground">
            {receiverAmt > 0 ? receiverAmt.toFixed(2) : '0.00'}
          </span>
        </div>
        {!sameCurrency && senderAmt > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Rate: 1 {sender.code} ≈ {(receiver.rate_to_inr / sender.rate_to_inr).toFixed(4)} {receiver.code}
          </p>
        )}
      </div>
    </div>
  );
};

export default CurrencyDualEntry;
