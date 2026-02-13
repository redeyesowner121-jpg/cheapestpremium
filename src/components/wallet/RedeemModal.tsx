import React from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface RedeemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redeemCode: string;
  onRedeemCodeChange: (code: string) => void;
  redeeming: boolean;
  onRedeem: () => void;
}

const RedeemModal: React.FC<RedeemModalProps> = ({
  open, onOpenChange, redeemCode, onRedeemCodeChange, redeeming, onRedeem
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-accent" />
            Redeem Gift Code
          </DialogTitle>
          <DialogDescription>Enter your gift code to add money to your wallet</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <Input value={redeemCode} onChange={(e) => onRedeemCodeChange(e.target.value.toUpperCase())}
            placeholder="Enter code (e.g. GIFT100)" className="font-mono text-center text-lg h-12" />
          <Button onClick={onRedeem} disabled={redeeming || !redeemCode.trim()}
            className="w-full h-12 btn-gradient rounded-xl">
            {redeeming ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Redeeming...</>
            ) : (
              <><Gift className="w-5 h-5 mr-2" />Redeem Code</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RedeemModal;
