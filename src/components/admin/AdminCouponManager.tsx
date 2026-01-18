import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, Plus, Edit, Trash2, Check, X, Percent, 
  IndianRupee, Package, Zap, Calendar, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Coupon {
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

interface Product {
  id: string;
  name: string;
}

interface FlashSale {
  id: string;
  products: { name: string } | null;
}

const AdminCouponManager: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [productId, setProductId] = useState<string>('');
  const [flashSaleId, setFlashSaleId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    const [couponsRes, productsRes, flashSalesRes] = await Promise.all([
      supabase
        .from('coupons')
        .select('*, products(name), flash_sales(id, products(name))')
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('flash_sales')
        .select('id, products(name)')
        .eq('is_active', true)
    ]);

    if (couponsRes.data) setCoupons(couponsRes.data as unknown as Coupon[]);
    if (productsRes.data) setProducts(productsRes.data);
    if (flashSalesRes.data) setFlashSales(flashSalesRes.data as unknown as FlashSale[]);
    
    setLoading(false);
  };

  const resetForm = () => {
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('');
    setMinPurchase('0');
    setMaxDiscount('');
    setUsageLimit('');
    setProductId('');
    setFlashSaleId('');
    setIsActive(true);
    setExpiresAt('');
    setEditingCoupon(null);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDescription(coupon.description || '');
    setDiscountType(coupon.discount_type as 'flat' | 'percentage');
    setDiscountValue(coupon.discount_value.toString());
    setMinPurchase(coupon.min_purchase?.toString() || '0');
    setMaxDiscount(coupon.max_discount?.toString() || '');
    setUsageLimit(coupon.usage_limit?.toString() || '');
    setProductId(coupon.product_id || '');
    setFlashSaleId(coupon.flash_sale_id || '');
    setIsActive(coupon.is_active);
    setExpiresAt(coupon.expires_at ? coupon.expires_at.split('T')[0] : '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !discountValue) {
      toast.error('Please fill in required fields');
      return;
    }

    const couponData = {
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      min_purchase: parseFloat(minPurchase) || 0,
      max_discount: maxDiscount ? parseFloat(maxDiscount) : null,
      usage_limit: usageLimit ? parseInt(usageLimit) : null,
      product_id: productId || null,
      flash_sale_id: flashSaleId || null,
      is_active: isActive,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
    };

    if (editingCoupon) {
      const { error } = await supabase
        .from('coupons')
        .update(couponData)
        .eq('id', editingCoupon.id);
      
      if (error) {
        toast.error('Failed to update coupon');
        return;
      }
      toast.success('Coupon updated');
    } else {
      const { error } = await supabase
        .from('coupons')
        .insert(couponData);
      
      if (error) {
        if (error.code === '23505') {
          toast.error('Coupon code already exists');
        } else {
          toast.error('Failed to create coupon');
        }
        return;
      }
      toast.success('Coupon created');
    }

    setShowModal(false);
    resetForm();
    loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete coupon');
      return;
    }
    
    toast.success('Coupon deleted');
    loadData();
  };

  const toggleActive = async (coupon: Coupon) => {
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: !coupon.is_active })
      .eq('id', coupon.id);
    
    if (error) {
      toast.error('Failed to update');
      return;
    }
    
    loadData();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

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
          <Ticket className="w-5 h-5 text-primary" />
          Coupon Management
        </h3>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-gradient rounded-xl"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Coupon
        </Button>
      </div>

      {/* Coupons List */}
      <div className="space-y-3">
        {coupons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No coupons yet. Create one to get started.
          </div>
        ) : (
          coupons.map((coupon) => (
            <motion.div
              key={coupon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-card rounded-xl p-4 border ${
                coupon.is_active ? 'border-success/30' : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyCode(coupon.code)}
                      className="flex items-center gap-1 font-mono font-bold text-lg text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      {coupon.code}
                      <Copy className="w-3 h-3" />
                    </button>
                    {coupon.discount_type === 'percentage' ? (
                      <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {coupon.discount_value}% off
                      </span>
                    ) : (
                      <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" />
                        ₹{coupon.discount_value} off
                      </span>
                    )}
                  </div>
                  
                  {coupon.description && (
                    <p className="text-sm text-muted-foreground mt-1">{coupon.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {coupon.product_id && coupon.products && (
                      <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {coupon.products.name}
                      </span>
                    )}
                    {coupon.flash_sale_id && coupon.flash_sales && (
                      <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Flash Sale: {coupon.flash_sales.products?.name}
                      </span>
                    )}
                    {coupon.min_purchase > 0 && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        Min ₹{coupon.min_purchase}
                      </span>
                    )}
                    {coupon.usage_limit && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {coupon.used_count}/{coupon.usage_limit} used
                      </span>
                    )}
                    {coupon.expires_at && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires {new Date(coupon.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={coupon.is_active}
                    onCheckedChange={() => toggleActive(coupon)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(coupon)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(coupon.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Coupon Code *</label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20"
                  className="flex-1 font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateCode}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Summer Sale Discount"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Discount Type *</label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'flat' | 'percentage')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Discount Value *</label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '10' : '100'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Min Purchase (₹)</label>
                <Input
                  type="number"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Max Discount (₹)</label>
                <Input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  placeholder="No limit"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Usage Limit</label>
              <Input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Product Specific (Optional)</label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All products</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Flash Sale Specific (Optional)</label>
              <Select value={flashSaleId} onValueChange={setFlashSaleId}>
                <SelectTrigger>
                  <SelectValue placeholder="All sales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All sales</SelectItem>
                  {flashSales.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.products?.name || 'Flash Sale'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Expires At</label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Active</label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 btn-gradient"
                onClick={handleSave}
              >
                {editingCoupon ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCouponManager;