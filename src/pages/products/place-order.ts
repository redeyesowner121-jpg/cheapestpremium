import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import type { Product, ProductVariation } from './types';

export interface OrderInputs {
  product: Product;
  variation: ProductVariation | null;
  flashSalePrice: number | null;
  quantity: number;
  orderNote: string;
  profile: any;
  user: any;
}

export interface OrderResult {
  productName: string;
  totalPrice: number;
  accessLink: string | null;
  isInstantDelivery: boolean;
}

export async function placeProductOrder(inputs: OrderInputs): Promise<OrderResult | null> {
  const { product, variation, flashSalePrice, quantity, orderNote, profile, user } = inputs;

  const { data: freshProduct } = await supabase
    .from('products').select('stock').eq('id', product.id).single();

  if (freshProduct?.stock !== null && freshProduct?.stock !== undefined && freshProduct.stock < quantity) {
    toast.error(`Only ${freshProduct.stock} items available in stock`);
    return null;
  }

  const userRank = getUserRank(profile.rank_balance || 0);
  const isReseller = profile.is_reseller || false;
  const basePrice = variation?.price || flashSalePrice || product.price;
  const { finalPrice } = flashSalePrice
    ? { finalPrice: flashSalePrice }
    : calculateFinalPrice(basePrice, product.reseller_price || null, userRank, isReseller);
  const priceToUse = Math.round(finalPrice * 100) / 100;
  const totalPrice = priceToUse * quantity;

  if ((profile.wallet_balance || 0) < totalPrice) {
    toast.error('Insufficient wallet balance. Please add money first.');
    return null;
  }

  const newBalance = (profile.wallet_balance || 0) - totalPrice;
  const { error: balanceError } = await supabase
    .from('profiles')
    .update({ wallet_balance: newBalance, total_orders: (profile.total_orders || 0) + 1 })
    .eq('id', user.id);
  if (balanceError) throw balanceError;

  const productName = variation ? `${product.name} (${variation.name})` : product.name;

  const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert({
    user_id: user.id,
    product_id: product.id,
    product_name: productName,
    product_image: product.image_url,
    quantity,
    unit_price: priceToUse,
    total_price: totalPrice,
    user_note: orderNote || null,
    status: 'pending',
  }).select('id').single();
  if (orderError) throw orderError;

  let accessLink: string | null = null;
  let isInstantDelivery = false;

  if (insertedOrder?.id) {
    const { data: productData } = await supabase
      .from('products').select('access_link, delivery_mode, show_link_in_website')
      .eq('id', product.id).single();
    if (productData?.show_link_in_website !== false &&
        (productData?.delivery_mode === 'unique' || productData?.access_link)) {
      try {
        const { data: claimedLink, error: rpcError } = await supabase.rpc('finalize_instant_delivery', {
          p_product_id: product.id,
          p_order_id: insertedOrder.id,
        });
        if (!rpcError && claimedLink) {
          accessLink = claimedLink as string;
          isInstantDelivery = true;
        }
      } catch (e) { console.error('Instant delivery error:', e); }
    }
  }

  const hasStock = freshProduct?.stock !== null && freshProduct?.stock !== undefined;
  await supabase.rpc('increment_product_sold_count', { product_id: product.id, qty: quantity, has_stock: hasStock });

  await supabase.from('transactions').insert({
    user_id: user.id, type: 'purchase', amount: -totalPrice, status: 'completed',
    description: `Purchased ${productName} x${quantity}`,
  });

  await supabase.from('notifications').insert({
    user_id: user.id,
    title: isInstantDelivery ? 'Order Delivered' : 'Order Placed Successfully',
    message: isInstantDelivery
      ? `Your order for ${productName} has been delivered! Check your orders for the access link.`
      : `Your order for ${productName} has been placed.`,
    type: 'order',
  });

  return { productName, totalPrice, accessLink, isInstantDelivery };
}
