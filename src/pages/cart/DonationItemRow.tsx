import React from 'react';
import { Trash2, Heart } from 'lucide-react';

interface Props {
  donationItem: any;
  formatPrice: (n: number) => string;
  removeItem: (id: string) => void;
}

const DonationItemRow: React.FC<Props> = ({ donationItem, formatPrice, removeItem }) => (
  <div className="bg-card rounded-2xl p-4 shadow-card border border-pink-500/20">
    <div className="flex gap-3 items-center">
      <div
        className="w-20 h-20 rounded-xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, hsl(340, 82%, 52%), hsl(20, 90%, 55%))' }}
      >
        <Heart className="w-8 h-8 text-white fill-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm">Support Us ❤️</h3>
        <p className="text-xs text-muted-foreground">Donation — Thank you!</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-primary font-bold">
            {formatPrice(donationItem.donation_amount || 0)}
          </span>
          <button
            onClick={() => removeItem(donationItem.id)}
            className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center active:scale-90"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default DonationItemRow;
