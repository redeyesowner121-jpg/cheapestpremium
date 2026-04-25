import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HandleBuyParams {
  user: any;
  profile: any;
  displayProduct: any;
  selectedVariation: any;
  currentPrice: number;
  totalPrice: number;
  quantity: number;
  currentStock: number | null;
  userNote: string;
  refreshProfile: () => Promise<void>;
  navigate: (path: string) => void;
  setLoading: (v: boolean) => void;
  setCurrentStock: (v: number | null) => void;
  setSuccessOrderData: (v: { productName: string; totalPrice: number; accessLink?: string | null }) => void;
  setShowPurchaseModal: (v: boolean) => void;
  setShowSuccessModal: (v: boolean) => void;
}

export const handleProductPurchase = async (
  params: HandleBuyParams,
  donationAmount: number = 0,
  discount: number = 0,
  appliedCouponId?: string,
  guestDetails?: { name: string; email: string; phone: string }
) => {
  const {
    user, profile, displayProduct, selectedVariation,
    currentPrice, totalPrice, quantity, currentStock, userNote,
    refreshProfile, navigate, setLoading, setCurrentStock,
    setSuccessOrderData, setShowPurchaseModal, setShowSuccessModal
  } = params;

  const isGuestCheckout = !user && guestDetails;
  const isOutOfStock = currentStock !== null && currentStock <= 0;
  const exceedsStock = currentStock !== null && quantity > currentStock;

  if (user && profile && !profile.phone) {
    toast.error('Please add your phone number to place an order');
    navigate('/profile/edit');
    return;
  }

  if (isOutOfStock) { toast.error('This product is out of stock'); return; }
  if (exceedsStock) { toast.error(`Only ${currentStock} items available in stock`); return; }

  const finalTotal = totalPrice - discount + donationAmount;

  if (user && profile && (profile.wallet_balance || 0) < finalTotal) {
    toast.error('Insufficient wallet balance');
    navigate('/wallet');
    return;
  }

  setLoading(true);

  try {
    if (user && profile) {
      const newBalance = (profile.wallet_balance || 0) - finalTotal;
      await supabase.from('profiles').update({ wallet_balance: newBalance, total_orders: (profile.total_orders || 0) + 1 }).eq('id', user.id);
    }

    const productName = selectedVariation
      ? `${displayProduct.name} - ${selectedVariation.name}`
      : displayProduct.name;

    // First check delivery mode to decide instant delivery
    let accessLink: string | null = null;
    let isInstantDelivery = false;
    let requiresDeliveryRpc = false;
    
    if (displayProduct.id) {
      const { data: productData } = await supabase
        .from('products')
        .select('access_link, delivery_mode, show_link_in_website')
        .eq('id', displayProduct.id)
        .single();

      if (productData?.show_link_in_website !== false) {
        const variationAccess = selectedVariation?.access_link?.trim?.() || '';
        const variationMessage = selectedVariation?.delivery_message?.trim?.() || '';
        const productAccess = productData?.access_link?.trim?.() || '';

        // Product/variation unique delivery needs the secure stock-claim RPC
        if (productData?.delivery_mode === 'unique' || selectedVariation?.delivery_mode === 'unique') {
          isInstantDelivery = true;
          requiresDeliveryRpc = true;
        }

        // Repeated credentials can be attached at insert time, so delivery never depends on RPC matching
        const repeatedAccessLink = variationAccess || variationMessage || productAccess;
        if (repeatedAccessLink) {
          isInstantDelivery = true;
          accessLink = repeatedAccessLink;
        }
      }
    }

    // Create order first (as pending)
    const orderData: any = {
      product_id: displayProduct.id,
      product_name: productName,
      product_image: displayProduct.image_url || displayProduct.image,
      unit_price: currentPrice,
      total_price: totalPrice,
      quantity,
      user_note: userNote + (donationAmount > 0 ? ` [Donation: ₹${donationAmount}]` : ''),
      status: accessLink ? 'confirmed' : 'pending',
      access_link: accessLink,
      discount_applied: discount,
    };

    if (isGuestCheckout) {
      orderData.guest_name = guestDetails.name;
      orderData.guest_email = guestDetails.email;
      orderData.guest_phone = guestDetails.phone;
    } else if (user) {
      orderData.user_id = user.id;
    }

    const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert(orderData).select('id').single();
    if (orderError) throw orderError;

    // Finalize instant delivery via secure RPC (handles both unique & repeated)
    if (isInstantDelivery && requiresDeliveryRpc && insertedOrder?.id) {
      try {
        const { data: claimedLink, error: rpcError } = await supabase.rpc('finalize_instant_delivery', {
          p_product_id: displayProduct.id,
          p_order_id: insertedOrder.id,
        });
        console.log('Instant delivery RPC result:', { claimedLink, rpcError, productId: displayProduct.id, orderId: insertedOrder.id });
        if (rpcError) {
          console.error('Instant delivery RPC error:', rpcError);
          isInstantDelivery = false;
        } else if (claimedLink) {
          accessLink = claimedLink;
        } else {
          isInstantDelivery = false;
        }
      } catch (rpcErr) {
        console.error('Instant delivery exception:', rpcErr);
        isInstantDelivery = false;
      }
    }

    if (user) {
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'purchase', amount: -finalTotal, status: 'completed',
        description: `Purchase: ${productName}${discount > 0 ? ` (₹${discount} discount)` : ''}${donationAmount > 0 ? ` + ₹${donationAmount} donation` : ''}`
      });

      // Calculate and update total_savings
      const originalPrice = displayProduct.original_price || displayProduct.originalPrice || currentPrice;
      const savingsThisOrder = Math.max(0, (originalPrice * quantity) - totalPrice);
      if (savingsThisOrder > 0) {
        const currentSavings = (profile as any)?.total_savings || 0;
        await supabase.from('profiles').update({ total_savings: currentSavings + savingsThisOrder }).eq('id', user.id);
      }
    }

    if (appliedCouponId) {
      await supabase.rpc('increment_coupon_used_count', { coupon_id: appliedCouponId });
    }

    if (user) {
      await supabase.from('notifications').insert({ user_id: user.id, title: isInstantDelivery ? 'Order Delivered' : 'Order Placed', message: isInstantDelivery ? `Your order for ${productName} has been delivered! Check your orders for the access link.` : `Your order for ${productName} has been placed successfully!`, type: 'order' });
    }

    const hasStock = currentStock !== null;
    await supabase.rpc('increment_product_sold_count', { product_id: displayProduct.id, qty: quantity, has_stock: hasStock });

    if (currentStock !== null) setCurrentStock(currentStock - quantity);

    // Send order email (confirmed = instant delivery, otherwise pending notice)
    const recipientEmail = isGuestCheckout ? guestDetails!.email : (profile?.email || user?.email);
    const recipientName = isGuestCheckout ? guestDetails!.name : (profile?.name || 'Customer');
    if (recipientEmail && insertedOrder?.id) {
      supabase.functions.invoke('send-order-email', {
        body: {
          to: recipientEmail,
          customerName: recipientName,
          productName,
          orderId: insertedOrder.id,
          status: isInstantDelivery ? 'confirmed' : 'pending',
          totalPrice: finalTotal,
          accessLink: accessLink || undefined,
        },
      }).catch((e) => console.error('send-order-email failed:', e));
    }

    setSuccessOrderData({ productName, totalPrice: finalTotal, accessLink });
    setShowPurchaseModal(false);
    setShowSuccessModal(true);
    if (user) await refreshProfile();
  } catch (error) {
    console.error('Order error:', error);
    toast.error('Failed to place order');
  } finally {
    setLoading(false);
  }
};
