import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertTriangle, ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FOREIGN_CONVERT_FEE_PERCENT, AAX_DISPLAY_DISCOUNT, AAX_ACTUAL_DISCOUNT } from './constants';

interface Props {
  productItems: any[];
  cartSummary: { subtotal: number; totalSavings: number; donationTotal: number; grandTotal: number };
  isAAX: boolean;
  isForeignCurrency: boolean;
  displayCurrency: any;
  formatPrice: (n: number) => string;
  checkingOut: boolean;
  onCheckout: () => void;
  walletBalance: number;
  onAddMoney: (amount: number) => void;
}

const CheckoutBar: React.FC<Props> = ({
  productItems, cartSummary, isAAX, isForeignCurrency, displayCurrency,
  formatPrice, checkingOut, onCheckout, walletBalance, onAddMoney,
}) => {
  const navigate = useNavigate();
  const needed = isAAX
    ? cartSummary.grandTotal - cartSummary.grandTotal * AAX_ACTUAL_DISCOUNT / 100
    : isForeignCurrency
      ? cartSummary.grandTotal + cartSummary.grandTotal * FOREIGN_CONVERT_FEE_PERCENT / 100
      : cartSummary.grandTotal;

  return (
    <div className="fixed bottom-16 left-0 right-0 glass border-t border-border p-4">
      <div className="max-w-lg mx-auto space-y-3">
        {isAAX && (
          <div className="flex items-start gap-2 p-2.5 bg-success/10 border border-success/20 rounded-xl">
            <Sparkles className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <div className="text-xs text-success">
              <p className="font-semibold">🔱 Asifian Apex Discount Applied!</p>
              <p>You're saving up to {AAX_DISPLAY_DISCOUNT}% on this purchase with Asifian Apex!</p>
            </div>
          </div>
        )}
        {!isAAX && !isForeignCurrency && (
          <button
            onClick={() => navigate('/wallet')}
            className="w-full flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="text-xs text-primary text-left flex-1">
              <p className="font-semibold">Pay with Asifian Apex & save up to {AAX_DISPLAY_DISCOUNT}%!</p>
              <p className="text-primary/70">Switch currency in Wallet → Convert</p>
            </div>
            <ArrowRight className="w-4 h-4 text-primary shrink-0" />
          </button>
        )}
        {isForeignCurrency && !isAAX && displayCurrency && (
          <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-destructive">
              <p className="font-semibold">Auto-convert: {displayCurrency.code} → INR ({FOREIGN_CONVERT_FEE_PERCENT}% fee)</p>
              <p>Switch to <strong>Asifian Apex</strong> to get up to {AAX_DISPLAY_DISCOUNT}% discount instead!</p>
            </div>
          </div>
        )}
        {cartSummary.subtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Products ({productItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span className="font-bold">{formatPrice(cartSummary.subtotal)}</span>
          </div>
        )}
        {cartSummary.donationTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500 fill-pink-500" /> Donation</span>
            <span className="font-bold">{formatPrice(cartSummary.donationTotal)}</span>
          </div>
        )}
        {cartSummary.totalSavings > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-success">Rank Savings</span>
            <span className="text-success font-medium">-{formatPrice(cartSummary.totalSavings)}</span>
          </div>
        )}
        {isAAX && (
          <div className="flex justify-between text-sm">
            <span className="text-success">🔱 Apex Discount (up to {AAX_DISPLAY_DISCOUNT}%)</span>
            <span className="text-success font-medium">-₹{(cartSummary.grandTotal * AAX_ACTUAL_DISCOUNT / 100).toFixed(2)}</span>
          </div>
        )}
        {isForeignCurrency && !isAAX && (
          <div className="flex justify-between text-sm">
            <span className="text-destructive">Conversion Fee ({FOREIGN_CONVERT_FEE_PERCENT}%)</span>
            <span className="text-destructive font-medium">₹{(cartSummary.grandTotal * FOREIGN_CONVERT_FEE_PERCENT / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span className="text-primary text-lg">
            {isAAX
              ? `₹${(cartSummary.grandTotal - cartSummary.grandTotal * AAX_ACTUAL_DISCOUNT / 100).toFixed(2)}`
              : isForeignCurrency
                ? `₹${(cartSummary.grandTotal + cartSummary.grandTotal * FOREIGN_CONVERT_FEE_PERCENT / 100).toFixed(2)}`
                : formatPrice(cartSummary.grandTotal)}
          </span>
        </div>
        <Button
          className="w-full h-12 btn-gradient rounded-xl text-base"
          onClick={onCheckout}
          disabled={checkingOut || productItems.some(i => (i.variation as any)?.delivery_mode !== 'repeated' && i.product?.stock !== null && i.product?.stock !== undefined && i.product.stock <= 0)}
        >
          {checkingOut ? 'Processing...' : isAAX
            ? `🔱 Checkout - ₹${(cartSummary.grandTotal - cartSummary.grandTotal * AAX_ACTUAL_DISCOUNT / 100).toFixed(2)}`
            : isForeignCurrency
              ? `Convert & Checkout - ₹${(cartSummary.grandTotal + cartSummary.grandTotal * FOREIGN_CONVERT_FEE_PERCENT / 100).toFixed(2)}`
              : `Checkout - ${formatPrice(cartSummary.grandTotal)}`}
        </Button>
        {walletBalance < needed && (
          <p className="text-xs text-destructive text-center">
            Insufficient balance. <button onClick={() => onAddMoney(Math.ceil(needed - walletBalance))} className="underline font-medium">Add Money</button>
          </p>
        )}
      </div>
    </div>
  );
};

export default CheckoutBar;
