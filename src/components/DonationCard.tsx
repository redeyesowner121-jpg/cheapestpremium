import React, { useState } from 'react';
import { Heart, ShoppingCart, ExternalLink, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCart } from '@/hooks/useCart';

const DONATION_AMOUNTS = [10, 25, 50, 100, 250, 500];

const DonationCard: React.FC = () => {
  const { user } = useAuth();
  const { addDonation } = useCart();
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'wallet' | 'external'>('wallet');
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const donationAmount = customAmount ? Number(customAmount) : selectedAmount;

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Please login to donate');
      return;
    }
    if (donationAmount < 1) {
      toast.error('Minimum donation is ₹1');
      return;
    }

    setProcessing(true);
    try {
      const success = await addDonation(donationAmount);
      if (success) {
        setShowModal(false);
        setCustomAmount('');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyUPI = async () => {
    try {
      await navigator.clipboard.writeText('8900684167@axl');
      setCopied(true);
      toast.success('UPI ID copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <>
      {/* Donation Banner */}
      <div
        onClick={() => setShowModal(true)}
        className="w-full mt-4 relative overflow-hidden rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(135deg, hsl(340, 82%, 52%), hsl(20, 90%, 55%))',
        }}
      >
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-white text-sm font-display tracking-tight">Support Us! ❤️</p>
            <p className="text-[11px] text-white/80 font-medium">
              Love our service? Donate to keep us running!
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-white/60" />
        </div>
        <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
        <div className="absolute -top-6 -left-6 w-16 h-16 bg-white/10 rounded-full" />
      </div>

      {/* Donation Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Heart className="w-5 h-5 text-destructive fill-destructive" />
              Donate & Support
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your donation will be added to cart. Checkout with your products or separately!
            </DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => setTab('wallet')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'wallet' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
            </button>
            <button
              onClick={() => setTab('external')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'external' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" /> UPI / Binance
            </button>
          </div>

          {tab === 'wallet' ? (
            <div className="space-y-4">
              {/* Amount Selection */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Select Amount</p>
                <div className="grid grid-cols-3 gap-2">
                  {DONATION_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        !customAmount && selectedAmount === amt
                          ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Or enter custom amount</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-4 py-2.5 bg-muted rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                    min={1}
                  />
                </div>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={processing || donationAmount < 1}
                className="w-full h-11 rounded-xl text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, hsl(340, 82%, 52%), hsl(20, 90%, 55%))',
                }}
              >
                {processing ? 'Adding...' : `Add ₹${donationAmount} Donation to Cart 🛒`}
              </Button>
              
              <p className="text-[10px] text-muted-foreground text-center">
                Donation will be deducted from wallet at checkout
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* UPI */}
              <div className="p-4 bg-muted/50 rounded-2xl space-y-3">
                <p className="text-sm font-bold text-foreground">📱 UPI</p>
                <div className="flex items-center gap-2 bg-background p-3 rounded-xl">
                  <span className="flex-1 text-sm font-mono font-medium text-foreground">8900684167@axl</span>
                  <button
                    onClick={handleCopyUPI}
                    className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-primary" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Name: <strong>RKR x OTT</strong></p>
              </div>

              {/* Binance */}
              <div className="p-4 bg-muted/50 rounded-2xl space-y-3">
                <p className="text-sm font-bold text-foreground">💰 Binance Pay</p>
                <p className="text-xs text-muted-foreground">
                  Send any amount via Binance Pay to our Binance ID. Contact support for the Pay ID.
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                After sending, your donation will be noted. Thank you! ❤️
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DonationCard;
