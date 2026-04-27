import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import EmptyCartFun from '@/components/EmptyCartFun';
import DonationCard from '@/components/DonationCard';
import { AAX_CODE } from './cart/constants';
import { useCheckout } from './cart/useCheckout';
import CartItemRow from './cart/CartItemRow';
import DonationItemRow from './cart/DonationItemRow';
import CheckoutBar from './cart/CheckoutBar';

// Lazy: only load when user clicks "Add Money"
const IndiaPaymentScreen = lazy(() => import('@/components/wallet/deposit/IndiaPaymentScreen'));

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { settings } = useAppSettingsContext();
  const { items, loading, updateQuantity, removeItem, clearCart } = useCart();
  const { formatPrice, isForeignCurrency, displayCurrency } = useCurrencyFormat();
  const isAAX = displayCurrency?.code === AAX_CODE;

  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>('auto');

  useEffect(() => {
    if (!showAddMoney) return;
    const fetchSettings = async () => {
      const { data } = await supabase.from('payment_settings').select('*');
      if (data) {
        const map: any = {};
        data.forEach((s: any) => { map[s.setting_key] = s; });
        setPaymentSettings(map);
      }
    };
    fetchSettings();
  }, [showAddMoney]);

  const userRank = useMemo(() => getUserRank(profile?.rank_balance || 0), [profile?.rank_balance]);
  const isReseller = profile?.is_reseller || false;

  const productItems = useMemo(() => items.filter(i => i.product_id !== null), [items]);
  const donationItem = useMemo(() => items.find(i => i.product_id === null && i.donation_amount), [items]);

  const cartSummary = useMemo(() => {
    let subtotal = 0;
    let totalSavings = 0;
    let donationTotal = 0;

    productItems.forEach(item => {
      const basePrice = item.variation?.price || item.product?.price || 0;
      const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
      const { finalPrice, savings } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
      subtotal += finalPrice * item.quantity;
      totalSavings += savings * item.quantity;
    });

    if (donationItem) {
      donationTotal = donationItem.donation_amount || 0;
    }

    return { subtotal, totalSavings, donationTotal, grandTotal: subtotal + donationTotal };
  }, [productItems, donationItem, userRank, isReseller]);

  const { checkingOut, handleCheckout } = useCheckout({
    user, profile, productItems, donationItem, cartSummary,
    userRank, isReseller, isAAX, isForeignCurrency, displayCurrency,
    settings, clearCart, refreshProfile, setAddMoneyAmount, setShowAddMoney,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const autoCheckoutTriggered = useRef(false);
  useEffect(() => {
    if (searchParams.get('checkout') === '1' && !loading && items.length > 0 && profile && !autoCheckoutTriggered.current) {
      autoCheckoutTriggered.current = true;
      setSearchParams({}, { replace: true });
      setTimeout(() => handleCheckout(), 300);
    }
  }, [searchParams, loading, items, profile]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold">Cart</h1>
          </div>
        </header>
        <main className="pt-20 px-4 max-w-lg mx-auto text-center py-16">
          <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p className="text-muted-foreground mb-6">Please login to view your cart</p>
          <Button onClick={() => navigate('/auth')} className="btn-gradient rounded-xl">Login</Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold">Cart ({items.length})</h1>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-sm text-destructive font-medium">Clear All</button>
          )}
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        <button
          onClick={() => navigate('/wallet')}
          className="w-full mb-4 flex items-center justify-between px-4 py-3 bg-primary/10 rounded-2xl border border-primary/20 hover:bg-primary/15 transition-colors active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <p className="text-lg font-bold text-primary">{formatPrice(profile?.wallet_balance || 0)}</p>
            </div>
          </div>
          <span className="text-xs text-primary font-medium">Add Money →</span>
        </button>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyCartFun />
        ) : (
          <div className="space-y-3">
            {productItems.map(item => (
              <CartItemRow
                key={item.id}
                item={item}
                userRank={userRank}
                isReseller={isReseller}
                formatPrice={formatPrice}
                updateQuantity={updateQuantity}
                removeItem={removeItem}
              />
            ))}
            {donationItem && (
              <DonationItemRow donationItem={donationItem} formatPrice={formatPrice} removeItem={removeItem} />
            )}
          </div>
        )}

        <DonationCard />
      </main>

      {items.length > 0 && (
        <CheckoutBar
          productItems={productItems}
          cartSummary={cartSummary}
          isAAX={isAAX}
          isForeignCurrency={isForeignCurrency}
          displayCurrency={displayCurrency}
          formatPrice={formatPrice}
          checkingOut={checkingOut}
          onCheckout={handleCheckout}
          walletBalance={profile?.wallet_balance || 0}
          onAddMoney={(amount) => { setAddMoneyAmount(amount.toString()); setShowAddMoney(true); }}
        />
      )}

      {showAddMoney && (
        <Suspense fallback={null}>
          <IndiaPaymentScreen
            open={showAddMoney}
            onOpenChange={(v) => { setShowAddMoney(v); if (!v) refreshProfile(); }}
            depositAmount={addMoneyAmount}
            onDepositAmountChange={setAddMoneyAmount}
            paymentSettings={paymentSettings}
            loading={false}
            onAutoDeposit={() => {}}
            onManualDeposit={() => {}}
            submittingManual={false}
            transactionId=""
            onTransactionIdChange={() => {}}
            senderName={profile?.name || ''}
            onSenderNameChange={() => {}}
            depositTab={depositTab}
            onTabChange={setDepositTab}
            onChangeCountry={() => {}}
          />
        </Suspense>
      )}
      <BottomNav />
    </div>
  );
};

export default CartPage;
