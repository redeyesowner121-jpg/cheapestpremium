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

    // Check if product has access_link for instant delivery
    let accessLink: string | null = null;
    if (displayProduct.id) {
      const { data: productData } = await supabase
        .from('products')
        .select('access_link')
        .eq('id', displayProduct.id)
        .single();
      accessLink = productData?.access_link || null;
    }

    const isInstantDelivery = !!accessLink;

    const orderData: any = {
      product_id: displayProduct.id,
      product_name: productName,
      product_image: displayProduct.image_url || displayProduct.image,
      unit_price: currentPrice,
      total_price: totalPrice,
      quantity,
      user_note: userNote + (donationAmount > 0 ? ` [Donation: ₹${donationAmount}]` : ''),
      status: isInstantDelivery ? 'confirmed' : 'pending',
      discount_applied: discount,
      access_link: accessLink,
    };

    if (isGuestCheckout) {
      orderData.guest_name = guestDetails.name;
      orderData.guest_email = guestDetails.email;
      orderData.guest_phone = guestDetails.phone;
    } else if (user) {
      orderData.user_id = user.id;
    }

    const { error: orderError } = await supabase.from('orders').insert(orderData);
    if (orderError) throw orderError;

    if (user) {
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'purchase', amount: -finalTotal, status: 'completed',
        description: `Purchase: ${productName}${discount > 0 ? ` (₹${discount} discount)` : ''}${donationAmount > 0 ? ` + ₹${donationAmount} donation` : ''}`
      });
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
