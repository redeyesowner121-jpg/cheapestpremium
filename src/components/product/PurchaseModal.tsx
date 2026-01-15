import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    name: string;
    image_url?: string;
    image?: string;
  };
  selectedVariation: { name: string } | null;
  currentPrice: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  currentStock: number | null;
  exceedsStock: boolean;
  userNote: string;
  onUserNoteChange: (note: string) => void;
  walletBalance: number;
  totalPrice: number;
  loading: boolean;
  onBuy: (donationAmount: number) => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  open,
  onOpenChange,
  product,
  selectedVariation,
  currentPrice,
  quantity,
  onQuantityChange,
  currentStock,
  exceedsStock,
  userNote,
  onUserNoteChange,
  walletBalance,
  totalPrice,
  loading,
  onBuy,
}) => {
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1');
  
  const donation = donationEnabled ? Math.max(1, parseFloat(donationAmount) || 0) : 0;
  const finalTotal = totalPrice + donation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Confirm Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <img
              src={product.image_url || product.image || 'https://via.placeholder.com/80'}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              {selectedVariation && (
                <p className="text-sm text-muted-foreground">{selectedVariation.name}</p>
              )}
              <p className="text-primary font-bold">₹{currentPrice}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Quantity</label>
              {currentStock !== null && (
                <span className="text-xs text-muted-foreground">{currentStock} available</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <span className="font-bold text-lg">{quantity}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuantityChange(currentStock !== null ? Math.min(currentStock, quantity + 1) : quantity + 1)}
                disabled={currentStock !== null && quantity >= currentStock}
              >
                +
              </Button>
            </div>
            {exceedsStock && (
              <p className="text-xs text-destructive mt-1">
                Maximum {currentStock} items available
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Note (optional)</label>
            <Input
              placeholder="Add a note for the seller..."
              value={userNote}
              onChange={(e) => onUserNoteChange(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>

          {/* Donation Option */}
          <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 rounded-xl border border-pink-200 dark:border-pink-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">Support Us</span>
              </div>
              <Switch
                checked={donationEnabled}
                onCheckedChange={setDonationEnabled}
              />
            </div>
            {donationEnabled && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    min="1"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
                    className="h-8 rounded-lg"
                    placeholder="1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Min ₹1 • Your donation helps us improve our services ❤️
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 p-3 bg-muted rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{totalPrice}</span>
            </div>
            {donationEnabled && donation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-pink-500">Donation</span>
                <span className="text-pink-500">₹{donation}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">
                ₹{finalTotal}
              </span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            Wallet Balance: ₹{walletBalance?.toFixed(2) || '0.00'}
          </div>

          <Button 
            className="w-full btn-gradient rounded-xl h-12" 
            onClick={() => onBuy(donation)}
            disabled={loading || finalTotal > walletBalance}
          >
            {loading ? 'Processing...' : `Pay ₹${finalTotal}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseModal;
