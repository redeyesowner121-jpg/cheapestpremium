import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FOREIGN_CONVERT_FEE_PERCENT } from './constants';
import { buildOrderRows, insertOrdersAndDeliver } from './checkout/order-builder';
import { processCheckoutPostInsert } from './checkout/post-checkout';

interface UseCheckoutArgs {
  user: any;
  profile: any;
  productItems: any[];
  donationItem: any;
  cartSummary: { subtotal: number; totalSavings: number; donationTotal: number; grandTotal: number };
  userRank: any;
  isReseller: boolean;
  isAAX: boolean;
  isForeignCurrency: boolean;
  displayCurrency: any;
  settings: any;
  clearCart: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setAddMoneyAmount: (v: string) => void;
  setShowAddMoney: (v: boolean) => void;
}

export function useCheckout(args: UseCheckoutArgs) {
  const navigate = useNavigate();
  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = async () => {
    const {
      user, profile, productItems, donationItem, cartSummary,
      userRank, isReseller, isAAX, isForeignCurrency, displayCurrency,
      settings, clearCart, refreshProfile, setAddMoneyAmount, setShowAddMoney,
    } = args;

    if (!user || !profile) {
      toast.error('Please login to checkout');
      navigate('/auth');
      return;
    }

    if (productItems.length === 0 && !donationItem) {
      toast.error('Your cart is empty');
      return;
    }

    const overLimitItem = productItems.find((it: any) => (it.quantity || 0) > 20);
    if (overLimitItem) {
      toast.error(`Maximum 20 quantity allowed per product (${overLimitItem.product?.name || 'item'})`);
      return;
    }

    const walletBalance = profile.wallet_balance || 0;
    let neededAmount = cartSummary.grandTotal;
    if (isForeignCurrency && !isAAX && displayCurrency) {
      neededAmount += cartSummary.grandTotal * (FOREIGN_CONVERT_FEE_PERCENT / 100);
    }

    if (walletBalance < neededAmount) {
      const shortfall = Math.ceil(neededAmount - walletBalance);
      setAddMoneyAmount(shortfall.toString());
      setShowAddMoney(true);
      toast.error(`₹${shortfall} short! Add money to continue.`);
      return;
    }

    setCheckingOut(true);
    try {
      const orderRows = productItems.length > 0
        ? await buildOrderRows(productItems, user.id, userRank, isReseller)
        : [];

      const orders = await insertOrdersAndDeliver(orderRows);

      await processCheckoutPostInsert({
        user, profile, productItems, cartSummary, isAAX, isForeignCurrency, displayCurrency, settings, orders,
      });

      await clearCart();
      await refreshProfile();
      const msg = orders.length > 0 && cartSummary.donationTotal > 0
        ? `🎉 ${productItems.length} order(s) placed + ₹${cartSummary.donationTotal} donated! ❤️`
        : cartSummary.donationTotal > 0
          ? `❤️ ₹${cartSummary.donationTotal} donated successfully!`
          : `🎉 ${productItems.length} order(s) placed successfully!`;
      toast.success(msg);
      navigate('/orders');
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  return { checkingOut, handleCheckout };
}
