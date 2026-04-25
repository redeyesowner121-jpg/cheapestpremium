import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CouponFormState } from './useCouponForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  form: CouponFormState;
  update: (patch: Partial<CouponFormState>) => void;
  onGenerate: () => void;
  onCancel: () => void;
  onSave: () => void;
  products: { id: string; name: string }[];
  flashSales: { id: string; products: { name: string } | null }[];
}

const CouponFormDialog: React.FC<Props> = ({
  open, onOpenChange, isEditing, form, update, onGenerate, onCancel, onSave, products, flashSales,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md mx-auto rounded-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Coupon Code *</label>
          <div className="flex gap-2">
            <Input value={form.code} onChange={(e) => update({ code: e.target.value.toUpperCase() })}
              placeholder="e.g. SAVE20" className="flex-1 font-mono" />
            <Button type="button" variant="outline" onClick={onGenerate}>Generate</Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Description</label>
          <Input value={form.description} onChange={(e) => update({ description: e.target.value })}
            placeholder="e.g. Summer Sale Discount" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Discount Type *</label>
            <Select value={form.discountType} onValueChange={(v) => update({ discountType: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="flat">Flat (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Discount Value *</label>
            <Input type="number" value={form.discountValue}
              onChange={(e) => update({ discountValue: e.target.value })}
              placeholder={form.discountType === 'percentage' ? '10' : '100'} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Min Purchase (₹)</label>
            <Input type="number" value={form.minPurchase}
              onChange={(e) => update({ minPurchase: e.target.value })} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Max Discount (₹)</label>
            <Input type="number" value={form.maxDiscount}
              onChange={(e) => update({ maxDiscount: e.target.value })} placeholder="No limit" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Usage Limit</label>
          <Input type="number" value={form.usageLimit}
            onChange={(e) => update({ usageLimit: e.target.value })} placeholder="Unlimited" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Product Specific (Optional)</label>
          <Select value={form.productId || 'all'} onValueChange={(v) => update({ productId: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Flash Sale Specific (Optional)</label>
          <Select value={form.flashSaleId || 'all'} onValueChange={(v) => update({ flashSaleId: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="All sales" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sales</SelectItem>
              {flashSales.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.products?.name || 'Flash Sale'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Expires At</label>
          <Input type="date" value={form.expiresAt} onChange={(e) => update({ expiresAt: e.target.value })} />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground">Active</label>
          <Switch checked={form.isActive} onCheckedChange={(v) => update({ isActive: v })} />
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1 btn-gradient" onClick={onSave}>{isEditing ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default CouponFormDialog;
