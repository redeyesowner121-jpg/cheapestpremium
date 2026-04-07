import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Trash2, Minus, Plus, Package, Wallet, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import IndiaPaymentScreen from '@/components/wallet/deposit/IndiaPaymentScreen';

const FOREIGN_CONVERT_FEE_PERCENT = 30;
const AAX_CODE = 'AAX';
const AAX_DISPLAY_DISCOUNT = 5; // Show "up to 5%" to users
const AAX_ACTUAL_DISCOUNT = 1.5; // Actually apply 1.5%

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { settings } = useAppSettingsContext();
  const { items, loading, updateQuantity, removeItem, clearCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const { formatPrice, isForeignCurrency, displayCurrency } = useCurrencyFormat();
  const isAAX = displayCurrency?.code === AAX_CODE;

  // Add Money modal state (triggered when balance is short)
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>('auto');

  // Fetch payment settings when add money modal opens
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

  // Auto-checkout when redirected from Buy Now (?checkout=1)
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCheckoutTriggered = useRef(false);
  useEffect(() => {
    if (searchParams.get('checkout') === '1' && !loading && items.length > 0 && profile && !autoCheckoutTriggered.current) {
      autoCheckoutTriggered.current = true;
      setSearchParams({}, { replace: true });
      setTimeout(() => handleCheckout(), 300);
    }
  }, [searchParams, loading, items, profile]);



  const userRank = useMemo(() => getUserRank(profile?.rank_balance || 0), [profile?.rank_balance]);
  const isReseller = profile?.is_reseller || false;

  const cartSummary = useMemo(() => {
    let subtotal = 0;
    let totalSavings = 0;

    items.forEach(item => {
      const basePrice = item.variation?.price || item.product?.price || 0;
      const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
      const { finalPrice, savings } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
      subtotal += finalPrice * item.quantity;
      totalSavings += savings * item.quantity;
    });

    return { subtotal, totalSavings };
  }, [items, userRank, isReseller]);

  const handleCheckout = async () => {
    if (!user || !profile) {
      toast.error('Please login to checkout');
      navigate('/auth');
      return;
    }

    if (!profile.phone) {
      toast.error('Please add your phone number first');
      navigate('/profile/edit');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    const walletBalance = profile.wallet_balance || 0;

    // Calculate needed amount
    let neededAmount = cartSummary.subtotal;
    if (isAAX) {
      neededAmount = cartSummary.subtotal;
    } else if (isForeignCurrency && displayCurrency) {
      const conversionFee = cartSummary.subtotal * (FOREIGN_CONVERT_FEE_PERCENT / 100);
      neededAmount = cartSummary.subtotal + conversionFee;
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
      // Create orders for all cart items
      const orders = await Promise.all(items.map(async (item) => {
        const basePrice = item.variation?.price || item.product?.price || 0;
        const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
        const { finalPrice } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
        const productName = item.variation
          ? `${item.product?.name} - ${item.variation.name}`
          : item.product?.name || 'Unknown';

        // Check for access_link for instant delivery
        let accessLink: string | null = null;
        if (item.product_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('access_link')
            .eq('id', item.product_id)
            .single();
          accessLink = productData?.access_link || null;
        }

        const isInstant = !!accessLink;

        return {
          user_id: user.id,
          product_id: item.product_id,
          product_name: productName,
          product_image: item.product?.image_url,
          unit_price: finalPrice,
          total_price: finalPrice * item.quantity,
          quantity: item.quantity,
          status: isInstant ? 'confirmed' : 'pending',
          access_link: accessLink,
        };
      }));

      const { error: orderError } = await supabase.from('orders').insert(orders);
      if (orderError) throw orderError;

      // Deduct wallet balance (AAX gets discount, other foreign currencies get fee)
      let totalDeduction = cartSummary.subtotal;
      let conversionFeeAmount = 0;
      let aaxDiscountAmount = 0;

      if (isAAX) {
        // AAX gets actual discount
        aaxDiscountAmount = cartSummary.subtotal * (AAX_ACTUAL_DISCOUNT / 100);
        totalDeduction = cartSummary.subtotal - aaxDiscountAmount;
      } else if (isForeignCurrency && displayCurrency) {
        conversionFeeAmount = cartSummary.subtotal * (FOREIGN_CONVERT_FEE_PERCENT / 100);
        totalDeduction = cartSummary.subtotal + conversionFeeAmount;
      }

      const newBalance = (profile.wallet_balance || 0) - totalDeduction;
      const newTotalOrders = (profile.total_orders || 0) + items.length;
      await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance, total_orders: newTotalOrders, display_currency: 'INR' })
        .eq('id', user.id);

      // Create purchase transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'purchase',
        amount: -cartSummary.subtotal,
        status: 'completed',
        description: `Cart checkout: ${items.length} item(s)`,
      });

      // AAX discount transaction
      if (aaxDiscountAmount > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'discount',
          amount: aaxDiscountAmount,
          status: 'completed',
          description: `Asifian Apex discount (${AAX_ACTUAL_DISCOUNT}%): Saved ₹${aaxDiscountAmount.toFixed(2)}`,
        });
      }

      // Create conversion fee transaction if applicable
      if (conversionFeeAmount > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'conversion_fee',
          amount: -conversionFeeAmount,
          status: 'completed',
          description: `Auto-convert fee (${FOREIGN_CONVERT_FEE_PERCENT}%): ${displayCurrency!.code} → INR for checkout`,
        });
      }

      // Increment sold counts
      for (const item of items) {
        const hasStock = item.product?.stock !== null && item.product?.stock !== undefined;
        await supabase.rpc('increment_product_sold_count', {
          product_id: item.product_id,
          qty: item.quantity,
          has_stock: hasStock,
        });
      }

      // Create notification
      const instantCount = orders.filter(o => o.status === 'confirmed').length;
      const pendingCount = orders.filter(o => o.status === 'pending').length;
      const notifTitle = instantCount > 0 && pendingCount === 0
        ? 'Orders Delivered! 🎉'
        : instantCount > 0
          ? 'Orders Placed! 🛒'
          : 'Orders Placed! 🛒';
      const notifMessage = instantCount > 0
        ? `${instantCount} item(s) delivered instantly! ${pendingCount > 0 ? `${pendingCount} item(s) pending.` : ''} Total: ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`
        : `You ordered ${items.length} item(s) for ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`;

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: notifTitle,
        message: notifMessage,
        type: 'order',
      });

      await clearCart();
      await refreshProfile();
      toast.success(`🎉 ${items.length} order(s) placed successfully!`);
      navigate('/orders');
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

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
        {/* Wallet Balance Card */}
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
          <div className="text-center py-16">
            <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Browse products and add them to your cart</p>
            <Button onClick={() => navigate('/products')} className="btn-gradient rounded-xl">Browse Products</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const basePrice = item.variation?.price || item.product?.price || 0;
              const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
              const { finalPrice } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
              const isOutOfStock = item.product?.stock !== null && item.product?.stock !== undefined && item.product.stock <= 0;

              return (
                <div key={item.id} className={`bg-card rounded-2xl p-4 shadow-card ${isOutOfStock ? 'opacity-60' : ''}`}>
                  <div className="flex gap-3">
                    <img
                      src={item.product?.image_url || 'https://via.placeholder.com/80'}
                      alt={item.product?.name}
                      className="w-20 h-20 rounded-xl object-cover"
                      onClick={() => navigate(`/product/${item.product_id}`)}
                    />
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-sm truncate cursor-pointer"
                        onClick={() => navigate(`/product/${item.product_id}`)}
                      >
                        {item.product?.name}
                      </h3>
                      {item.variation && (
                        <p className="text-xs text-muted-foreground">{item.variation.name}</p>
                      )}
                      {isOutOfStock && (
                        <span className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                          <Package className="w-3 h-3" /> Out of stock
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-primary font-bold">
                          {formatPrice(finalPrice * item.quantity)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-90"
                            disabled={item.product?.stock !== null && item.product?.stock !== undefined && item.quantity >= item.product.stock}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center active:scale-90 ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Checkout Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 glass border-t border-border p-4">
          <div className="max-w-lg mx-auto space-y-3">
            {/* AAX discount promo */}
            {isAAX && (
              <div className="flex items-start gap-2 p-2.5 bg-success/10 border border-success/20 rounded-xl">
                <Sparkles className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div className="text-xs text-success">
                  <p className="font-semibold">🔱 Asifian Apex Discount Applied!</p>
                  <p>You're saving up to {AAX_DISPLAY_DISCOUNT}% on this purchase with Asifian Apex!</p>
                </div>
              </div>
            )}
            {/* Non-AAX promotion banner */}
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
            {/* Foreign currency warning (non-AAX) */}
            {isForeignCurrency && !isAAX && displayCurrency && (
              <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive">
                  <p className="font-semibold">Auto-convert: {displayCurrency.code} → INR ({FOREIGN_CONVERT_FEE_PERCENT}% fee)</p>
                  <p>Switch to <strong>Asifian Apex</strong> to get up to {AAX_DISPLAY_DISCOUNT}% discount instead!</p>
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span className="font-bold">{formatPrice(cartSummary.subtotal)}</span>
            </div>
            {cartSummary.totalSavings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-success">Rank Savings</span>
                <span className="text-success font-medium">-{formatPrice(cartSummary.totalSavings)}</span>
              </div>
            )}
            {isAAX && (
              <div className="flex justify-between text-sm">
                <span className="text-success">🔱 Apex Discount (up to {AAX_DISPLAY_DISCOUNT}%)</span>
                <span className="text-success font-medium">-₹{(cartSummary.subtotal * AAX_ACTUAL_DISCOUNT / 100).toFixed(2)}</span>
              </div>
            )}
            {isForeignCurrency && !isAAX && (
              <div className="flex justify-between text-sm">
                <span className="text-destructive">Conversion Fee ({FOREIGN_CONVERT_FEE_PERCENT}%)</span>
                <span className="text-destructive font-medium">₹{(cartSummary.subtotal * FOREIGN_CONVERT_FEE_PERCENT / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary text-lg">
                {isAAX
                  ? `₹${(cartSummary.subtotal - cartSummary.subtotal * AAX_ACTUAL_DISCOUNT / 100).toFixed(2)}`
                  : isForeignCurrency
                    ? `₹${(cartSummary.subtotal + cartSummary.subtotal * FOREIGN_CONVERT_FEE_PERCENT / 100).toFixed(2)}`
                    : formatPrice(cartSummary.subtotal)}
              </span>
            </div>
            <Button
              className="w-full h-12 btn-gradient rounded-xl text-base"
              onClick={handleCheckout}
              disabled={checkingOut || items.some(i => i.product?.stock !== null && i.product?.stock !== undefined && i.product.stock <= 0)}
            >
              {checkingOut ? 'Processing...' : isAAX
                ? `🔱 Checkout - ₹${(cartSummary.subtotal - cartSummary.subtotal * AAX_ACTUAL_DISCOUNT / 100).toFixed(2)}`
                : isForeignCurrency
                  ? `Convert & Checkout - ₹${(cartSummary.subtotal + cartSummary.subtotal * FOREIGN_CONVERT_FEE_PERCENT / 100).toFixed(2)}`
                  : `Checkout - ${formatPrice(cartSummary.subtotal)}`}
            </Button>
            {(() => {
              const balance = profile?.wallet_balance || 0;
              const needed = isAAX
                ? cartSummary.subtotal - cartSummary.subtotal * AAX_ACTUAL_DISCOUNT / 100
                : isForeignCurrency
                  ? cartSummary.subtotal + cartSummary.subtotal * FOREIGN_CONVERT_FEE_PERCENT / 100
                  : cartSummary.subtotal;
              return balance < needed ? (
                <p className="text-xs text-destructive text-center">
                  Insufficient balance. <button onClick={() => { setAddMoneyAmount(Math.ceil(needed - balance).toString()); setShowAddMoney(true); }} className="underline font-medium">Add Money</button>
                </p>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Add Money Modal - triggered on insufficient balance */}
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

      <BottomNav />
    </div>
  );
};

export default CartPage;
