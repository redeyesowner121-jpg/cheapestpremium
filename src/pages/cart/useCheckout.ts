import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { calculateFinalPrice } from '@/lib/ranks';
import { FOREIGN_CONVERT_FEE_PERCENT, AAX_ACTUAL_DISCOUNT } from './constants';

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

    if (!profile.phone) {
      toast.error('Please add your phone number first');
      navigate('/profile/edit');
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
      return;
    }

    const walletBalance = profile.wallet_balance || 0;

    let neededAmount = cartSummary.grandTotal;
    if (isAAX) {
      neededAmount = cartSummary.grandTotal;
    } else if (isForeignCurrency && displayCurrency) {
      const conversionFee = cartSummary.grandTotal * (FOREIGN_CONVERT_FEE_PERCENT / 100);
      neededAmount = cartSummary.grandTotal + conversionFee;
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
      const orderRows = productItems.length > 0 ? await Promise.all(productItems.map(async (item) => {
        const basePrice = item.variation?.price || item.product?.price || 0;
        const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
        const { finalPrice } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
        const productName = item.variation
          ? `${item.product?.name} - ${item.variation.name}`
          : item.product?.name || 'Unknown';

        let isInstant = false;
        let requiresDeliveryRpc = false;
        let accessLink: string | null = null;
        if (item.product_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('access_link, delivery_mode, show_link_in_website')
            .eq('id', item.product_id)
            .single();
          if (productData?.show_link_in_website !== false) {
            const productAccess = productData?.access_link?.trim?.() || '';
            if (productData?.delivery_mode === 'unique') {
              isInstant = true;
              requiresDeliveryRpc = true;
            }
            if (productAccess) {
              isInstant = true;
              accessLink = productAccess;
            }
            if (item.variation_id) {
              const { data: varData } = await supabase
                .from('product_variations')
                .select('access_link, delivery_message, delivery_mode')
                .eq('id', item.variation_id)
                .single();
              const variationAccess = varData?.access_link?.trim?.() || '';
              const variationMessage = varData?.delivery_message?.trim?.() || '';
              if (variationAccess || variationMessage) {
                isInstant = true;
                accessLink = variationAccess || variationMessage;
              }
              if (varData?.delivery_mode === 'unique') {
                isInstant = true;
                requiresDeliveryRpc = true;
              }
            }
          }
        }

        return {
          row: {
            user_id: user.id,
            product_id: item.product_id,
            product_name: productName,
            product_image: item.product?.image_url,
            unit_price: finalPrice,
            total_price: finalPrice * item.quantity,
            quantity: item.quantity,
            status: accessLink ? 'confirmed' : 'pending',
            access_link: accessLink,
          },
          isInstant,
          requiresDeliveryRpc,
          productId: item.product_id,
        };
      })) : [];

      const orders = orderRows.map(r => r.row);

      if (orders.length > 0) {
        const { data: insertedOrders, error: orderError } = await supabase.from('orders').insert(orders).select('id');
        if (orderError) throw orderError;

        if (insertedOrders) {
          insertedOrders.forEach((ord, idx) => {
            (orders[idx] as any).id = ord.id;
          });

          await Promise.all(insertedOrders.map(async (ord, idx) => {
            const meta = orderRows[idx];
            if (meta?.isInstant && meta.requiresDeliveryRpc && meta.productId) {
              try {
                const { data: link } = await supabase.rpc('finalize_instant_delivery', {
                  p_product_id: meta.productId,
                  p_order_id: ord.id,
                });
                if (link) {
                  orders[idx].status = 'confirmed';
                  orders[idx].access_link = link;
                }
              } catch (e) { console.error('Instant delivery failed:', e); }
            }
          }));
        }
      }

      let totalDeduction = cartSummary.grandTotal;
      let conversionFeeAmount = 0;
      let aaxDiscountAmount = 0;

      if (isAAX) {
        aaxDiscountAmount = cartSummary.grandTotal * (AAX_ACTUAL_DISCOUNT / 100);
        totalDeduction = cartSummary.grandTotal - aaxDiscountAmount;
      } else if (isForeignCurrency && displayCurrency) {
        conversionFeeAmount = cartSummary.grandTotal * (FOREIGN_CONVERT_FEE_PERCENT / 100);
        totalDeduction = cartSummary.grandTotal + conversionFeeAmount;
      }

      const newBalance = (profile.wallet_balance || 0) - totalDeduction;
      const newTotalOrders = (profile.total_orders || 0) + productItems.length;
      await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance, total_orders: newTotalOrders, display_currency: 'INR' })
        .eq('id', user.id);

      if (cartSummary.subtotal > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'purchase',
          amount: -cartSummary.subtotal,
          status: 'completed',
          description: `Cart checkout: ${productItems.length} item(s)`,
        });
      }

      if (cartSummary.donationTotal > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'donation',
          amount: -cartSummary.donationTotal,
          status: 'completed',
          description: `Donation: ₹${cartSummary.donationTotal} — Thank you! ❤️`,
        });

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Thank You! ❤️',
          message: `Your ₹${cartSummary.donationTotal} donation is greatly appreciated!`,
          type: 'info',
        });
      }

      if (aaxDiscountAmount > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'discount',
          amount: aaxDiscountAmount,
          status: 'completed',
          description: `Asifian Apex discount (${AAX_ACTUAL_DISCOUNT}%): Saved ₹${aaxDiscountAmount.toFixed(2)}`,
        });
      }

      if (conversionFeeAmount > 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'conversion_fee',
          amount: -conversionFeeAmount,
          status: 'completed',
          description: `Auto-convert fee (${FOREIGN_CONVERT_FEE_PERCENT}%): ${displayCurrency!.code} → INR for checkout`,
        });
      }

      for (const item of productItems) {
        const hasStock = item.product?.stock !== null && item.product?.stock !== undefined;
        await supabase.rpc('increment_product_sold_count', {
          product_id: item.product_id!,
          qty: item.quantity,
          has_stock: hasStock,
        });
      }

      if (orders.length > 0) {
        const instantCount = orders.filter(o => o.status === 'confirmed').length;
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        const notifTitle = instantCount > 0 && pendingCount === 0
          ? 'Orders Delivered! 🎉'
          : 'Orders Placed! 🛒';
        const notifMessage = instantCount > 0
          ? `${instantCount} item(s) delivered instantly! ${pendingCount > 0 ? `${pendingCount} item(s) pending.` : ''} Total: ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`
          : `You ordered ${productItems.length} item(s) for ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`;

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: notifTitle,
          message: notifMessage,
          type: 'order',
        });

        const recipientEmail = profile?.email || user.email;
        const recipientName = profile?.name || 'Customer';
        if (recipientEmail) {
          orders.forEach((o: any) => {
            if (!o.id) return;
            supabase.functions.invoke('send-order-email', {
              body: {
                to: recipientEmail,
                customerName: recipientName,
                productName: o.product_name,
                orderId: o.id,
                status: o.status === 'confirmed' ? 'confirmed' : 'pending',
                totalPrice: o.total_price,
                accessLink: o.access_link || undefined,
                currency: settings.currency_symbol || '₹',
                quantity: o.quantity || 1,
              },
            }).catch((e) => console.error('send-order-email failed:', e));
          });
        }
      }

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
