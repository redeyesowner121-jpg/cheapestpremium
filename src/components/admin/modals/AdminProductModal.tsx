import React from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const QUICK_VARIATION_TEMPLATES = [
  { name: '1 Month', price: '49', reseller_price: '' },
  { name: '3 Months', price: '129', reseller_price: '' },
  { name: '6 Months', price: '249', reseller_price: '' },
  { name: '1 Year', price: '449', reseller_price: '' },
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
        reseller_price: newModalVariation.reseller_price ? parseFloat(newModalVariation.reseller_price) : null
      }).then(({ error }) => {
        if (error) { toast.error('Failed to add variation'); return; }
        supabase.from('product_variations').select('*').eq('product_id', editingProduct.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => setExistingVariations(data || []));
        toast.success('Variation added!');
        setNewModalVariation({ name: '', price: '', reseller_price: '' });
      });
    } else {
      setPendingVariations([...pendingVariations, { ...newModalVariation }]);
      setNewModalVariation({ name: '', price: '', reseller_price: '' });
    }
  };

  const handleDeleteVariation = async (variationId: string, isExisting: boolean) => {
    if (isExisting) {
      await supabase.from('product_variations').delete().eq('id', variationId);
      setExistingVariations(existingVariations.filter(v => v.id !== variationId));
      toast.success('Variation deleted!');
    } else {
      const index = parseInt(variationId);
      setPendingVariations(pendingVariations.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onReset(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Product Name *" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          <Textarea placeholder="Description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} />
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="Price *" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
            <Input type="number" placeholder="Original" value={productForm.original_price} onChange={(e) => setProductForm({ ...productForm, original_price: e.target.value })} />
            <Input type="number" placeholder="Reseller" value={productForm.reseller_price} onChange={(e) => setProductForm({ ...productForm, reseller_price: e.target.value })} />
          </div>
          <Select value={productForm.category} onValueChange={(value) => setProductForm({ ...productForm, category: value })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input placeholder="Image URL" value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} />
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
              Variations (Optional)
            </h4>

            <div className="flex flex-wrap gap-1 mb-3">
              {QUICK_VARIATION_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
                  onClick={() => {
                    if (editingProduct) {
                      supabase.from('product_variations').insert({
                        product_id: editingProduct.id, name: template.name, price: parseFloat(template.price)
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

            {existingVariations.length > 0 && (
              <div className="space-y-2 mb-3">
                {existingVariations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-2 bg-muted rounded-xl">
                    <span className="text-sm">{v.name} - ₹{v.price}</span>
                    <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDeleteVariation(v.id, true)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {pendingVariations.length > 0 && (
              <div className="space-y-2 mb-3">
                {pendingVariations.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-accent/10 rounded-xl">
                    <span className="text-sm">{v.name} - ₹{v.price}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleDeleteVariation(idx.toString(), false)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={newModalVariation.name} onChange={(e) => setNewModalVariation({ ...newModalVariation, name: e.target.value })} />
              <Input type="number" placeholder="Price" value={newModalVariation.price} onChange={(e) => setNewModalVariation({ ...newModalVariation, price: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-2">
              <Input type="number" placeholder="Reseller Price" value={newModalVariation.reseller_price} onChange={(e) => setNewModalVariation({ ...newModalVariation, reseller_price: e.target.value })} />
              <Button onClick={handleAddModalVariation}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>

          <Button className="w-full btn-gradient" onClick={onSave}>
            {editingProduct ? 'Update Product' : 'Add Product'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminProductModal;
