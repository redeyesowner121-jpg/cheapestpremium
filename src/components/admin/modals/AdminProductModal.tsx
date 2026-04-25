import React, { useState } from 'react';
import { Package } from 'lucide-react';
import MultiImageUpload from '@/components/ui/multi-image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import AddVariationForm from './AddVariationForm';
import DeliveryConfigSection from './product-modal/DeliveryConfigSection';
import VariationsList from './product-modal/VariationsList';
import { useProductModalState } from './product-modal/useProductModalState';
import { useVariationActions } from './product-modal/useVariationActions';

const QUICK_VARIATION_TEMPLATES = [
  { name: '1 Month', price: '49', original_price: '', reseller_price: '' },
  { name: '3 Months', price: '129', original_price: '', reseller_price: '' },
  { name: '6 Months', price: '249', original_price: '', reseller_price: '' },
  { name: '1 Year', price: '449', original_price: '', reseller_price: '' },
];

const BUTTON_COLORS = [
  { value: 'primary', label: '🔵 Blue', bg: 'bg-blue-500' },
  { value: 'success', label: '🟢 Green', bg: 'bg-green-500' },
  { value: 'danger', label: '🔴 Red', bg: 'bg-red-500' },
  { value: '', label: '⚪ Default', bg: 'bg-gray-400' },
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
  newModalVariation, setNewModalVariation, onSave, onReset,
}) => {
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const state = useProductModalState(editingProduct, productForm, setProductForm);
  const v = useVariationActions({
    editingProduct, existingVariations, setExistingVariations,
    pendingVariations, setPendingVariations, newModalVariation, setNewModalVariation,
  });

  const handleSave = () => {
    const newErrors: Record<string, boolean> = {};
    if (!productForm.name.trim()) newErrors.name = true;
    if (!productForm.image_url.trim()) newErrors.image_url = true;
    if (!productForm.category.trim()) newErrors.category = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Product Name, Image & Category are required');
      return;
    }
    onSave();
  };

  const images = (() => {
    const imgs: string[] = [];
    if (productForm.image_url) imgs.push(productForm.image_url);
    if (productForm.images?.length) {
      productForm.images.forEach((img: string) => { if (img && !imgs.includes(img)) imgs.push(img); });
    }
    return imgs;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onReset(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Product Name *" value={productForm.name}
            onChange={(e) => { setProductForm({ ...productForm, name: e.target.value }); if (e.target.value.trim()) setErrors(p => ({ ...p, name: false })); }}
            className={errors.name ? 'border-destructive ring-destructive/30 ring-2' : ''} />
          <Textarea placeholder="Description" value={productForm.description}
            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} />
          <Select value={productForm.category} onValueChange={(value) => { setProductForm({ ...productForm, category: value }); setErrors(p => ({ ...p, category: false })); }}>
            <SelectTrigger className={`rounded-xl ${errors.category ? 'border-destructive ring-destructive/30 ring-2' : ''}`}>
              <SelectValue placeholder="Select category *" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className={errors.image_url ? '[&_div]:border-destructive [&_div]:ring-destructive/30 [&_div]:ring-2' : ''}>
            <MultiImageUpload
              values={images}
              onChange={(urls) => {
                setProductForm({ ...productForm, image_url: urls[0] || '', images: urls.slice(1) });
                if (urls.length > 0) setErrors(p => ({ ...p, image_url: false }));
              }}
              maxImages={8} bucket="product-images" folder="products"
            />
          </div>

          <DeliveryConfigSection
            productForm={productForm} setProductForm={setProductForm}
            deliveryType={state.deliveryType} setDeliveryType={state.setDeliveryType}
            deliveryMode={state.deliveryMode} onDeliveryModeChange={state.handleDeliveryModeChange}
            credUsername={state.credUsername} setCredUsername={state.setCredUsername}
            credPassword={state.credPassword} setCredPassword={state.setCredPassword}
            updateAccessLink={state.updateAccessLink}
            editingProduct={editingProduct}
            stockItems={state.stockItems} loadingStock={state.loadingStock}
            newStockLink={state.newStockLink} setNewStockLink={state.setNewStockLink}
            onAddStock={state.handleAddStockItem} onDeleteStock={state.handleDeleteStockItem}
          />

          <Input type="number" placeholder="Stock (empty=unlimited)" value={productForm.stock}
            onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} />

          <div>
            <label className="text-sm font-medium mb-2 block">Bot Button Color</label>
            <div className="grid grid-cols-4 gap-2">
              {BUTTON_COLORS.map((opt) => (
                <button key={opt.value} type="button"
                  className={`text-xs px-2 py-2 rounded-lg font-medium transition-all border-2 ${
                    (productForm.button_style || 'primary') === opt.value || (!productForm.button_style && opt.value === 'primary')
                      ? `${opt.bg} text-white border-foreground shadow-md scale-105`
                      : `bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30`
                  }`}
                  onClick={() => setProductForm({ ...productForm, button_style: opt.value || 'primary' })}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={productForm.is_active} onCheckedChange={(val) => setProductForm({ ...productForm, is_active: val })} />
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Variations & Pricing
            </h4>
            <div className="flex flex-wrap gap-1 mb-3">
              {QUICK_VARIATION_TEMPLATES.map((template, idx) => (
                <button key={idx} type="button"
                  className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-medium transition-colors"
                  onClick={() => v.handleQuickTemplate(template)}>
                  + {template.name}
                </button>
              ))}
            </div>
            <VariationsList
              editingProduct={editingProduct}
              existingVariations={existingVariations}
              pendingVariations={pendingVariations}
              onEditVariation={v.handleEditVariation}
              onDeleteVariation={v.handleDeleteVariation}
              onDeletePending={v.handleDeletePending}
              updatePendingVariation={v.updatePendingVariation}
            />
            <AddVariationForm value={newModalVariation} onChange={setNewModalVariation} onAdd={v.handleAddModalVariation} />
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
