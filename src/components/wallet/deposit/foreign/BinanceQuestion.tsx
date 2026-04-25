import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface BinanceQuestionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foreignCountry: string;
  foreignFlag: string;
  onHasBinance: () => void;
  onNoBinance: () => void;
  onBack: () => void;
}

export const BinanceQuestion: React.FC<BinanceQuestionProps> = ({
  open, onOpenChange, foreignCountry, foreignFlag, onHasBinance, onNoBinance, onBack,
}) => (
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
