import { supabase } from '@/integrations/supabase/client';
import { calculateFinalPrice } from '@/lib/ranks';

export async function buildOrderRows(productItems: any[], userId: string, userRank: any, isReseller: boolean) {
  return Promise.all(productItems.map(async (item) => {
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
        user_id: userId,
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
  }));
}

export async function insertOrdersAndDeliver(orderRows: any[]) {
  const orders = orderRows.map((r) => r.row);
  if (orders.length === 0) return orders;

  const { data: insertedOrders, error: orderError } = await supabase.from('orders').insert(orders).select('id');
  if (orderError) throw orderError;
  if (!insertedOrders) return orders;

  insertedOrders.forEach((ord, idx) => { (orders[idx] as any).id = ord.id; });

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
      } catch (e) {
        console.error('Instant delivery failed:', e);
      }
    }
  }));

  return orders;
}
