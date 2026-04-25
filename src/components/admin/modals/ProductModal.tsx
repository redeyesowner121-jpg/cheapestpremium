import React from 'react';
import { Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MultiImageUpload from '@/components/ui/multi-image-upload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SimpleVariationsSection from './product-modal/SimpleVariationsSection';
import {
  useProductFormState, saveProduct, QUICK_VARIATION_TEMPLATES, type Variation,
} from './product-modal/useProductForm';

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: any;
  categories: { id: string; name: string }[];
  onRefresh: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ open, onOpenChange, editingProduct, categories, onRefresh }) => {
  const s = useProductFormState(editingProduct, open);

  const handleSubmit = async () => {
    const ok = await saveProduct({
      editingProduct,
      productForm: s.productForm,
      pendingVariations: s.pendingVariations,
    });
    if (ok) { onOpenChange(false); onRefresh(); }
  };

  const handleAddModalVariation = () => {
    if (!s.newModalVariation.name || !s.newModalVariation.price) {
      toast.error('Please fill variation name and price'); return;
    }
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id,
        name: s.newModalVariation.name,
        price: parseFloat(s.newModalVariation.price),
        reseller_price: s.newModalVariation.reseller_price ? parseFloat(s.newModalVariation.reseller_price) : null,
      }).then(({ error }) => {
        if (error) { toast.error('Failed to add variation'); return; }
        s.loadVariations(editingProduct.id);
        toast.success('Variation added!');
        s.setNewModalVariation({ name: '', price: '', reseller_price: '' });
      });
    } else {
      s.setPendingVariations([...s.pendingVariations, { ...s.newModalVariation }]);
      s.setNewModalVariation({ name: '', price: '', reseller_price: '' });
    }
  };

  const handleDeleteVariation = async (id: string, isExisting: boolean) => {
    if (isExisting) {
      await supabase.from('product_variations').delete().eq('id', id);
      s.setExistingVariations(s.existingVariations.filter(v => v.id !== id));
      toast.success('Variation deleted!');
    } else {
      const idx = parseInt(id);
      s.setPendingVariations(s.pendingVariations.filter((_, i) => i !== idx));
    }
  };

  const handleQuickVariation = (template: Variation) => {
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id, name: template.name, price: parseFloat(template.price),
      }).then(() => { s.loadVariations(editingProduct.id); toast.success(`${template.name} added!`); });
    } else {
      s.setPendingVariations([...s.pendingVariations, { ...template }]);
    }
  };

  const startEditVariation = (v: any) => {
    s.setEditingVarId(v.id);
    s.setEditVarForm({
      name: v.name, price: String(v.price),
      reseller_price: v.reseller_price ? String(v.reseller_price) : '',
    });
  };

  const handleUpdateVariation = async () => {
    if (!s.editingVarId || !s.editVarForm.name || !s.editVarForm.price) {
      toast.error('Name and price are required'); return;
    }
    const { error } = await supabase.from('product_variations').update({
      name: s.editVarForm.name,
      price: parseFloat(s.editVarForm.price),
      reseller_price: s.editVarForm.reseller_price ? parseFloat(s.editVarForm.reseller_price) : null,
    }).eq('id', s.editingVarId);
    if (error) { toast.error('Failed to update variation'); return; }
    toast.success('Variation updated!');
    s.setEditingVarId(null);
    if (editingProduct) s.loadVariations(editingProduct.id);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) s.resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Product Name *" value={s.productForm.name}
            onChange={(e) => s.setProductForm({ ...s.productForm, name: e.target.value })} />
          <Textarea placeholder="Description" value={s.productForm.description}
            onChange={(e) => s.setProductForm({ ...s.productForm, description: e.target.value })} rows={2} />
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="Price *" value={s.productForm.price}
              onChange={(e) => s.setProductForm({ ...s.productForm, price: e.target.value })} />
            <Input type="number" placeholder="Original" value={s.productForm.original_price}
              onChange={(e) => s.setProductForm({ ...s.productForm, original_price: e.target.value })} />
            <Input type="number" placeholder="Reseller" value={s.productForm.reseller_price}
              onChange={(e) => s.setProductForm({ ...s.productForm, reseller_price: e.target.value })} />
          </div>
          <Select value={s.productForm.category} onValueChange={(value) => s.setProductForm({ ...s.productForm, category: value })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Product Images</label>
              <span className="text-[10px] text-muted-foreground">{s.productForm.images.length}/5</span>
            </div>
            <MultiImageUpload values={s.productForm.images}
              onChange={(urls) => s.setProductForm({ ...s.productForm, images: urls })}
              maxImages={5} bucket="product-images" folder="products" />
          </div>
          <Input placeholder="Access Link (Optional)" value={s.productForm.access_link}
            onChange={(e) => s.setProductForm({ ...s.productForm, access_link: e.target.value })} />
          <Input type="number" placeholder="Stock (empty=unlimited)" value={s.productForm.stock}
            onChange={(e) => s.setProductForm({ ...s.productForm, stock: e.target.value })} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={s.productForm.is_active}
              onCheckedChange={(v) => s.setProductForm({ ...s.productForm, is_active: v })} />
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />SEO Tags
            </h4>
            <Textarea placeholder="SEO keywords comma-separated (e.g. netflix premium, ott subscription, streaming, cheap netflix)"
              value={s.productForm.seo_tags}
              onChange={(e) => s.setProductForm({ ...s.productForm, seo_tags: e.target.value })}
              rows={2} className="text-xs" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Users can find this product by searching these keywords
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />Variations (Optional)
            </h4>
            <div className="flex flex-wrap gap-1 mb-3">
              {QUICK_VARIATION_TEMPLATES.map((template, idx) => (
                <button key={idx} type="button"
                  className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
                  onClick={() => handleQuickVariation(template)}>
                  + {template.name}
                </button>
              ))}
            </div>
            <SimpleVariationsSection
              existingVariations={s.existingVariations}
              pendingVariations={s.pendingVariations}
              newModalVariation={s.newModalVariation}
              setNewModalVariation={s.setNewModalVariation}
              editingVarId={s.editingVarId}
              setEditingVarId={s.setEditingVarId}
              editVarForm={s.editVarForm}
              setEditVarForm={s.setEditVarForm}
              onAdd={handleAddModalVariation}
              onDelete={handleDeleteVariation}
              onUpdate={handleUpdateVariation}
              onStartEdit={startEditVariation}
            />
          </div>

          <Button className="w-full btn-gradient" onClick={handleSubmit}>
            {editingProduct ? 'Update Product' : 'Add Product'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductModal;
