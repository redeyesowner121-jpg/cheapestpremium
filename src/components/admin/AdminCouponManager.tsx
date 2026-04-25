import React, { useEffect, useState } from 'react';
import { Ticket, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CouponListItem from './coupons/CouponListItem';
import CouponFormDialog from './coupons/CouponFormDialog';
import { useCouponForm, type Coupon } from './coupons/useCouponForm';

const AdminCouponManager: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [flashSales, setFlashSales] = useState<{ id: string; products: { name: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const cf = useCouponForm();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [couponsRes, productsRes, flashSalesRes] = await Promise.all([
      supabase.from('coupons').select('*, products(name), flash_sales(id, products(name))').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase.from('flash_sales').select('id, products(name)').eq('is_active', true),
    ]);
    if (couponsRes.data) setCoupons(couponsRes.data as unknown as Coupon[]);
    if (productsRes.data) setProducts(productsRes.data);
    if (flashSalesRes.data) setFlashSales(flashSalesRes.data as any);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!cf.form.code.trim() || !cf.form.discountValue) { toast.error('Please fill in required fields'); return; }
    const payload = cf.toPayload();
    if (cf.editingCoupon) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', cf.editingCoupon.id);
      if (error) { toast.error('Failed to update coupon'); return; }
      toast.success('Coupon updated');
    } else {
      const { error } = await supabase.from('coupons').insert(payload);
      if (error) {
        toast.error(error.code === '23505' ? 'Coupon code already exists' : 'Failed to create coupon');
        return;
      }
      toast.success('Coupon created');
    }
    setShowModal(false); cf.reset(); loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) { toast.error('Failed to delete coupon'); return; }
    toast.success('Coupon deleted'); loadData();
  };

  const toggleActive = async (coupon: Coupon) => {
    const { error } = await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
    if (error) { toast.error('Failed to update'); return; }
    loadData();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  const openEditModal = (c: Coupon) => { cf.loadFromCoupon(c); setShowModal(true); };
  const openCreateModal = () => { cf.reset(); setShowModal(true); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />Coupon Management
        </h3>
        <Button size="sm" onClick={openCreateModal} className="btn-gradient rounded-xl">
          <Plus className="w-4 h-4 mr-1" />Add Coupon
        </Button>
      </div>

      <div className="space-y-3">
        {coupons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No coupons yet. Create one to get started.
          </div>
        ) : coupons.map((coupon) => (
          <CouponListItem key={coupon.id} coupon={coupon}
            onCopy={copyCode} onToggle={toggleActive}
            onEdit={openEditModal} onDelete={handleDelete} />
        ))}
      </div>

      <CouponFormDialog
        open={showModal}
        onOpenChange={setShowModal}
        isEditing={!!cf.editingCoupon}
        form={cf.form}
        update={cf.update}
        onGenerate={cf.generateCode}
        onCancel={() => { setShowModal(false); cf.reset(); }}
        onSave={handleSave}
        products={products}
        flashSales={flashSales}
      />
    </div>
  );
};

export default AdminCouponManager;
