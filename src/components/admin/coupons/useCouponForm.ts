import { useState } from 'react';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  product_id: string | null;
  flash_sale_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  products?: { name: string } | null;
  flash_sales?: { id: string; products: { name: string } | null } | null;
}

export interface CouponFormState {
  code: string;
  description: string;
  discountType: 'flat' | 'percentage';
  discountValue: string;
  minPurchase: string;
  maxDiscount: string;
  usageLimit: string;
  productId: string;
  flashSaleId: string;
  isActive: boolean;
  expiresAt: string;
}

const EMPTY: CouponFormState = {
  code: '', description: '', discountType: 'percentage', discountValue: '',
  minPurchase: '0', maxDiscount: '', usageLimit: '',
  productId: '', flashSaleId: '', isActive: true, expiresAt: '',
};

export function useCouponForm() {
  const [form, setForm] = useState<CouponFormState>(EMPTY);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const reset = () => { setForm(EMPTY); setEditingCoupon(null); };

  const loadFromCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setForm({
      code: c.code,
      description: c.description || '',
      discountType: c.discount_type as 'flat' | 'percentage',
      discountValue: c.discount_value.toString(),
      minPurchase: c.min_purchase?.toString() || '0',
      maxDiscount: c.max_discount?.toString() || '',
      usageLimit: c.usage_limit?.toString() || '',
      productId: c.product_id || '',
      flashSaleId: c.flash_sale_id || '',
      isActive: c.is_active,
      expiresAt: c.expires_at ? c.expires_at.split('T')[0] : '',
    });
  };

  const update = (patch: Partial<CouponFormState>) => setForm(f => ({ ...f, ...patch }));

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    update({ code: result });
  };

  const toPayload = () => ({
    code: form.code.trim().toUpperCase(),
    description: form.description.trim() || null,
    discount_type: form.discountType,
    discount_value: parseFloat(form.discountValue),
    min_purchase: parseFloat(form.minPurchase) || 0,
    max_discount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
    usage_limit: form.usageLimit ? parseInt(form.usageLimit) : null,
    product_id: form.productId || null,
    flash_sale_id: form.flashSaleId || null,
    is_active: form.isActive,
    expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  });

  return { form, editingCoupon, reset, loadFromCoupon, update, generateCode, toPayload };
}
