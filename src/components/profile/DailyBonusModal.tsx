import React from 'react';
import { Gift, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DailyBonusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
}

const DailyBonusModal: React.FC<DailyBonusModalProps> = ({
  open,
  onOpenChange,
  canClaim,
  claiming,
  onClaim,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-center">Daily Sign-in Bonus</DialogTitle>
        </DialogHeader>

        <div className="mt-4 text-center space-y-4">
          <div className="w-24 h-24 mx-auto gradient-accent rounded-full flex items-center justify-center animate-pulse">
            <Gift className="w-12 h-12 text-accent-foreground" />
          </div>
          
          {canClaim ? (
            <>
              <p className="text-muted-foreground">
                Claim your daily bonus! You can earn between{' '}
                <span className="font-bold text-success">₹0.10 to ₹0.60</span>
              </p>
              <Button
                className="w-full btn-gradient rounded-xl h-12"
                onClick={onClaim}
                disabled={claiming}
              >
                {claiming ? 'Claiming...' : '🎁 Claim Daily Bonus'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                You've already claimed your daily bonus today! Come back tomorrow for more.
              </p>
              <div className="flex items-center justify-center gap-2 text-success">
                <Calendar className="w-5 h-5" />
                <span className="font-semibold">Next bonus: Tomorrow</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DailyBonusModal;
