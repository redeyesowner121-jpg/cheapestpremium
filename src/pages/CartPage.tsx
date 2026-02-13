import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Trash2, Minus, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { settings } = useAppSettingsContext();
  const { items, loading, updateQuantity, removeItem, clearCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);

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

    if ((profile.wallet_balance || 0) < cartSummary.subtotal) {
      toast.error('Insufficient wallet balance');
      navigate('/wallet');
      return;
    }

    setCheckingOut(true);
    try {
      // Create orders for all cart items
      const orders = items.map(item => {
        const basePrice = item.variation?.price || item.product?.price || 0;
        const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
        const { finalPrice } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
        const productName = item.variation
          ? `${item.product?.name} - ${item.variation.name}`
          : item.product?.name || 'Unknown';

        return {
          user_id: user.id,
          product_id: item.product_id,
          product_name: productName,
          product_image: item.product?.image_url,
          unit_price: finalPrice,
          total_price: finalPrice * item.quantity,
          quantity: item.quantity,
          status: 'pending',
        };
      });

      const { error: orderError } = await supabase.from('orders').insert(orders);
      if (orderError) throw orderError;

      // Deduct wallet balance
      const newBalance = (profile.wallet_balance || 0) - cartSummary.subtotal;
      const newTotalOrders = (profile.total_orders || 0) + items.length;
      await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance, total_orders: newTotalOrders })
        .eq('id', user.id);

      // Create transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'purchase',
        amount: -cartSummary.subtotal,
        status: 'completed',
        description: `Cart checkout: ${items.length} item(s)`,
      });

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
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Orders Placed! 🛒',
        message: `You ordered ${items.length} item(s) for ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`,
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
                          {settings.currency_symbol}{(finalPrice * item.quantity).toFixed(2)}
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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span className="font-bold">{settings.currency_symbol}{cartSummary.subtotal.toFixed(2)}</span>
            </div>
            {cartSummary.totalSavings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Rank Savings</span>
                <span className="text-green-600 font-medium">-{settings.currency_symbol}{cartSummary.totalSavings.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary text-lg">{settings.currency_symbol}{cartSummary.subtotal.toFixed(2)}</span>
            </div>
            <Button
              className="w-full h-12 btn-gradient rounded-xl text-base"
              onClick={handleCheckout}
              disabled={checkingOut || items.some(i => i.product?.stock !== null && i.product?.stock !== undefined && i.product.stock <= 0)}
            >
              {checkingOut ? 'Processing...' : `Checkout - ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`}
            </Button>
            {(profile?.wallet_balance || 0) < cartSummary.subtotal && (
              <p className="text-xs text-destructive text-center">
                Insufficient balance. <button onClick={() => navigate('/wallet')} className="underline font-medium">Add Money</button>
              </p>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default CartPage;
