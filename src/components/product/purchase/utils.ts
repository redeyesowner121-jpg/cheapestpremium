import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppliedCoupon } from './types';

export function generatePaymentNote(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let note = '';
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 6) {
      note += digits[Math.floor(Math.random() * digits.length)];
    } else {
      note += letters[Math.floor(Math.random() * letters.length)];
    }
  }
  return note;
}

export function calculateCouponDiscount(
  appliedCoupon: AppliedCoupon | null,
  totalPrice: number,
  bulkDiscountAmount: number
): number {
  if (!appliedCoupon) return 0;
  const priceAfterBulk = totalPrice - bulkDiscountAmount;
  let discount = 0;
  if (appliedCoupon.discount_type === 'percentage') {
    discount = (priceAfterBulk * appliedCoupon.discount_value) / 100;
    if (appliedCoupon.max_discount && discount > appliedCoupon.max_discount) {
      discount = appliedCoupon.max_discount;
    }
  } else {
    discount = appliedCoupon.discount_value;
  }
  return Math.min(discount, priceAfterBulk);
}

export async function validateCoupon(
  couponCode: string,
  totalPrice: number,
  productId: string | undefined,
  flashSaleId: string | undefined,
  formatPrice: (n: number) => string
): Promise<AppliedCoupon | string> {
  if (!couponCode.trim()) return 'Please enter a coupon code';
  
  const { data: coupon, error } = await supabase
    .from('coupons').select('*')
    .eq('code', couponCode.trim().toUpperCase())
    .eq('is_active', true).maybeSingle();
  if (error) return 'Failed to validate coupon';
  if (!coupon) return 'Invalid coupon code';
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return 'This coupon has expired';
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) return 'This coupon is not yet active';
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return 'This coupon has been fully redeemed';
  if (coupon.min_purchase && totalPrice < coupon.min_purchase) return `Minimum purchase of ${formatPrice(coupon.min_purchase)} required`;
  if (coupon.product_id && coupon.product_id !== productId) return 'This coupon is not valid for this product';
  if (coupon.flash_sale_id && coupon.flash_sale_id !== flashSaleId) return 'This coupon is only valid for a specific flash sale';
  
  return {
    id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    max_discount: coupon.max_discount
  };
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Copied!');
}
