import { supabase } from '@/integrations/supabase/client';
import { FOREIGN_CONVERT_FEE_PERCENT, AAX_ACTUAL_DISCOUNT } from '../constants';

interface PostCheckoutArgs {
  user: any;
  profile: any;
  productItems: any[];
  cartSummary: { subtotal: number; donationTotal: number; grandTotal: number };
  isAAX: boolean;
  isForeignCurrency: boolean;
  displayCurrency: any;
  settings: any;
  orders: any[];
}

export async function processCheckoutPostInsert(args: PostCheckoutArgs) {
  const { user, profile, productItems, cartSummary, isAAX, isForeignCurrency, displayCurrency, settings, orders } = args;

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
      user_id: user.id, type: 'purchase', amount: -cartSummary.subtotal, status: 'completed',
      description: `Cart checkout: ${productItems.length} item(s)`,
    });
  }

  if (cartSummary.donationTotal > 0) {
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'donation', amount: -cartSummary.donationTotal, status: 'completed',
      description: `Donation: ₹${cartSummary.donationTotal} — Thank you! ❤️`,
    });
    await supabase.from('notifications').insert({
      user_id: user.id, title: 'Thank You! ❤️',
      message: `Your ₹${cartSummary.donationTotal} donation is greatly appreciated!`, type: 'info',
    });
  }

  if (aaxDiscountAmount > 0) {
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'discount', amount: aaxDiscountAmount, status: 'completed',
      description: `Asifian Apex discount (${AAX_ACTUAL_DISCOUNT}%): Saved ₹${aaxDiscountAmount.toFixed(2)}`,
    });
  }

  if (conversionFeeAmount > 0) {
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'conversion_fee', amount: -conversionFeeAmount, status: 'completed',
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
    const instantCount = orders.filter((o) => o.status === 'confirmed').length;
    const pendingCount = orders.filter((o) => o.status === 'pending').length;
    const notifTitle = instantCount > 0 && pendingCount === 0 ? 'Orders Delivered! 🎉' : 'Orders Placed! 🛒';
    const notifMessage = instantCount > 0
      ? `${instantCount} item(s) delivered instantly! ${pendingCount > 0 ? `${pendingCount} item(s) pending.` : ''} Total: ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`
      : `You ordered ${productItems.length} item(s) for ${settings.currency_symbol}${cartSummary.subtotal.toFixed(2)}`;

    await supabase.from('notifications').insert({
      user_id: user.id, title: notifTitle, message: notifMessage, type: 'order',
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
}
