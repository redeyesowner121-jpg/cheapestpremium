import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: any;
  user: any;
  blueTickPrice: number;
  refreshProfile: () => Promise<void> | void;
}

const BlueTickModal: React.FC<Props> = ({ open, onOpenChange, profile, user, blueTickPrice, refreshProfile }) => {
  const navigate = useNavigate();
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (!user || !profile) return;
    if ((profile.wallet_balance || 0) < blueTickPrice) {
      toast.error(`Insufficient balance! You need ₹${blueTickPrice}`);
      return;
    }
    setBuying(true);
    try {
      const newBalance = (profile.wallet_balance || 0) - blueTickPrice;
      await supabase.from('profiles').update({ wallet_balance: newBalance, has_blue_check: true }).eq('id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'purchase', amount: blueTickPrice,
        status: 'completed', description: 'Blue Tick Badge Purchase'
      });
      toast.success('🎉 Blue Tick purchased successfully!');
      await refreshProfile();
      onOpenChange(false);
    } catch { toast.error('Failed to purchase Blue Tick'); }
    finally { setBuying(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-center">Get Verified ✅</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
            <BlueTick size="lg" className="w-12 h-12" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Blue Tick Badge</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Get a verified badge on your profile! Stand out from the crowd.
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-bold text-foreground">₹{blueTickPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Balance</span>
              <span className={`font-bold ${(profile?.wallet_balance || 0) >= blueTickPrice ? 'text-success' : 'text-destructive'}`}>
                ₹{profile?.wallet_balance?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
          {(profile?.wallet_balance || 0) < blueTickPrice ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive">Insufficient balance</p>
              <Button className="w-full rounded-xl" onClick={() => { onOpenChange(false); navigate('/wallet'); }}>
                <Wallet className="w-4 h-4 mr-2" />
                Add Money to Wallet
              </Button>
            </div>
          ) : (
            <Button
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white"
              onClick={handleBuy}
              disabled={buying}
            >
              {buying ? 'Processing...' : `Buy for ₹${blueTickPrice}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlueTickModal;
