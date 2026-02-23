import React, { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import VariationItem from './VariationItem';
import AddVariationForm from './AddVariationForm';

const QUICK_VARIATION_TEMPLATES = [
  { name: '1 Month', price: '49', original_price: '', reseller_price: '' },
  { name: '3 Months', price: '129', original_price: '', reseller_price: '' },
  { name: '6 Months', price: '249', original_price: '', reseller_price: '' },
  { name: '1 Year', price: '449', original_price: '', reseller_price: '' },
];

interface AdminProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: any;
  productForm: any;
  setProductForm: (form: any) => void;
  categories: { id: string; name: string }[];
  existingVariations: any[];
  setExistingVariations: (v: any[]) => void;
  pendingVariations: any[];
  setPendingVariations: (v: any[]) => void;
  newModalVariation: any;
  setNewModalVariation: (v: any) => void;
  onSave: () => void;
  onReset: () => void;
}

const AdminProductModal: React.FC<AdminProductModalProps> = ({
  open, onOpenChange, editingProduct, productForm, setProductForm,
  categories, existingVariations, setExistingVariations,
  pendingVariations, setPendingVariations,
  newModalVariation, setNewModalVariation,
  onSave, onReset
}) => {
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleSave = () => {
    const newErrors: Record<string, boolean> = {};
    if (!productForm.name.trim()) newErrors.name = true;
    if (!productForm.image_url.trim()) newErrors.image_url = true;
    if (!productForm.category.trim()) newErrors.category = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Product Name, Image URL ও Category অবশ্যই পূরণ করুন');
      return;
    }
    onSave();
  };
  const handleAddModalVariation = () => {
    if (!newModalVariation.name || !newModalVariation.price) {
      toast.error('Please fill variation name and price');
      return;
    }
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id,
        name: newModalVariation.name,
        price: parseFloat(newModalVariation.price),
        original_price: newModalVariation.original_price ? parseFloat(newModalVariation.original_price) : null,
        reseller_price: newModalVariation.reseller_price ? parseFloat(newModalVariation.reseller_price) : null,
      }).then(({ error }) => {
        if (error) { toast.error('Failed to add variation'); return; }
        supabase.from('product_variations').select('*').eq('product_id', editingProduct.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => setExistingVariations(data || []));
        toast.success('Variation added!');
        setNewModalVariation({ name: '', price: '', original_price: '', reseller_price: '' });
      });
    } else {
      setPendingVariations([...pendingVariations, { ...newModalVariation }]);
      setNewModalVariation({ name: '', price: '', original_price: '', reseller_price: '' });
    }
  };

  const handleEditVariation = async (id: string, data: { name: string; price: string; original_price: string; reseller_price: string }) => {
    if (!data.name || !data.price) {
      toast.error('Name and price are required');
      return;
    }
    const { error } = await supabase.from('product_variations').update({
      name: data.name,
      price: parseFloat(data.price),
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      reseller_price: data.reseller_price ? parseFloat(data.reseller_price) : null,
    }).eq('id', id);
    if (error) { toast.error('Failed to update variation'); return; }
    toast.success('Variation updated!');
    if (editingProduct) {
      const { data: refreshed } = await supabase.from('product_variations').select('*')
        .eq('product_id', editingProduct.id).order('created_at', { ascending: true });
      setExistingVariations(refreshed || []);
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    await supabase.from('product_variations').delete().eq('id', variationId);
    setExistingVariations(existingVariations.filter(v => v.id !== variationId));
    toast.success('Variation deleted!');
  };

  const handleDeletePending = (idx: string) => {
    const index = parseInt(idx);
    setPendingVariations(pendingVariations.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onReset(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Product Name *" value={productForm.name} onChange={(e) => { setProductForm({ ...productForm, name: e.target.value }); if (e.target.value.trim()) setErrors(prev => ({ ...prev, name: false })); }} className={errors.name ? 'border-destructive ring-destructive/30 ring-2' : ''} />
          <Textarea placeholder="Description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} />
          <Select value={productForm.category} onValueChange={(value) => { setProductForm({ ...productForm, category: value }); setErrors(prev => ({ ...prev, category: false })); }}>
            <SelectTrigger className={`rounded-xl ${errors.category ? 'border-destructive ring-destructive/30 ring-2' : ''}`}><SelectValue placeholder="Select category *" /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input placeholder="Image URL *" value={productForm.image_url} onChange={(e) => { setProductForm({ ...productForm, image_url: e.target.value }); if (e.target.value.trim()) setErrors(prev => ({ ...prev, image_url: false })); }} className={errors.image_url ? 'border-destructive ring-destructive/30 ring-2' : ''} />
          <Input placeholder="Access Link (Optional)" value={productForm.access_link} onChange={(e) => setProductForm({ ...productForm, access_link: e.target.value })} />
          <Input type="number" placeholder="Stock (empty=unlimited)" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={productForm.is_active} onCheckedChange={(v) => setProductForm({ ...productForm, is_active: v })} />
          </div>

          {/* Variations Section */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Variations & Pricing
            </h4>

            <div className="flex flex-wrap gap-1 mb-3">
              {QUICK_VARIATION_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-medium transition-colors"
                  onClick={() => {
                    if (editingProduct) {
                      supabase.from('product_variations').insert({
                        product_id: editingProduct.id, name: template.name, price: parseFloat(template.price),
                      }).then(() => {
                        supabase.from('product_variations').select('*').eq('product_id', editingProduct.id)
                          .order('created_at', { ascending: true })
                          .then(({ data }) => setExistingVariations(data || []));
                        toast.success(`${template.name} added!`);
                      });
                    } else {
                      setPendingVariations([...pendingVariations, { ...template }]);
                    }
                  }}
                >
                  + {template.name}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-3">
              <AnimatePresence mode="popLayout">
                {existingVariations.map((v) => (
                  <VariationItem
                    key={v.id}
                    variation={v}
                    onEdit={handleEditVariation}
                    onDelete={handleDeleteVariation}
                  />
                ))}
                {pendingVariations.map((v, idx) => (
                  <VariationItem
                    key={`pending-${idx}`}
                    variation={{
                      id: idx.toString(),
                      name: v.name,
                      price: parseFloat(v.price) || 0,
                      original_price: v.original_price ? parseFloat(v.original_price) : null,
                      reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null,
                    }}
                    onEdit={async () => {}}
                    onDelete={handleDeletePending}
                    isPending
                  />
                ))}
              </AnimatePresence>
            </div>

            <AddVariationForm
              value={newModalVariation}
              onChange={setNewModalVariation}
              onAdd={handleAddModalVariation}
            />
          </div>

          <Button className="w-full btn-gradient" onClick={handleSave}>
            {editingProduct ? 'Update Product' : 'Add Product'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminProductModal;
