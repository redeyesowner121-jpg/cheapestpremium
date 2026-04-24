import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Link, Key, Repeat, Layers, Copy } from 'lucide-react';
import MultiImageUpload from '@/components/ui/multi-image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import VariationItem from './VariationItem';
import AddVariationForm from './AddVariationForm';
import VariationDeliveryManager from './VariationDeliveryManager';

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
  const [deliveryType, setDeliveryType] = useState<'link' | 'credentials'>('link');
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [newStockLink, setNewStockLink] = useState('');
  const [loadingStock, setLoadingStock] = useState(false);
  const deliveryMode = productForm.delivery_mode === 'unique' ? 'unique' : 'repeated';

  // Auto-detect delivery type and mode from existing product
  useEffect(() => {
    if (editingProduct) {
      // Set delivery mode
      setProductForm((prev: any) => ({
        ...prev,
        delivery_mode: editingProduct.delivery_mode === 'unique' ? 'unique' : 'repeated',
      }));

      // Detect delivery type from access_link
      const link = editingProduct.access_link || '';
      if (link.includes('ID:') && link.includes('Password:')) {
        setDeliveryType('credentials');
        const idMatch = link.match(/ID:\s*(.+)/);
        const pwMatch = link.match(/Password:\s*(.+)/);
        setCredUsername(idMatch?.[1]?.trim() || '');
        setCredPassword(pwMatch?.[1]?.trim() || '');
      } else {
        setDeliveryType('link');
        setCredUsername('');
        setCredPassword('');
      }

      // Load stock items if unique mode
      if (editingProduct.delivery_mode === 'unique') {
        loadStockItems(editingProduct.id);
      }
    } else {
      setDeliveryType('link');
      setCredUsername('');
      setCredPassword('');
      setStockItems([]);
    }
  }, [editingProduct]);

  const loadStockItems = async (productId: string) => {
    setLoadingStock(true);
    const { data } = await supabase
      .from('product_stock_items' as any)
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    setStockItems(data || []);
    setLoadingStock(false);
  };

  // Sync credentials back to productForm.access_link
  const updateAccessLink = (type: 'link' | 'credentials', link?: string, user?: string, pass?: string) => {
    if (type === 'credentials') {
      setProductForm({ ...productForm, access_link: `ID: ${user || credUsername}\nPassword: ${pass || credPassword}` });
    } else {
      setProductForm({ ...productForm, access_link: link ?? productForm.access_link });
    }
  };

  const handleDeliveryModeChange = (mode: 'repeated' | 'unique') => {
    setProductForm((prev: any) => ({ ...prev, delivery_mode: mode }));
    if (mode === 'unique' && editingProduct) {
      loadStockItems(editingProduct.id);
    }
  };

  const handleAddStockItem = async () => {
    if (!newStockLink.trim()) {
      toast.error('Please enter a link or credentials');
      return;
    }
    if (!editingProduct) {
      toast.error('Please save the product first, then add stock items');
      return;
    }

    let accessValue = newStockLink.trim();
    if (deliveryType === 'credentials') {
      // For credentials mode, the input is already formatted
      accessValue = newStockLink.trim();
    }

    const { error } = await (supabase as any)
      .from('product_stock_items')
      .insert({ product_id: editingProduct.id, access_link: accessValue });

    if (error) {
      toast.error('Failed to add stock item');
      return;
    }
    toast.success('Stock item added!');
    setNewStockLink('');
    loadStockItems(editingProduct.id);
  };

  const handleDeleteStockItem = async (itemId: string) => {
    const { error } = await (supabase as any)
      .from('product_stock_items')
      .delete()
      .eq('id', itemId);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    setStockItems(stockItems.filter(s => s.id !== itemId));
    toast.success('Stock item removed');
  };

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
        description: newModalVariation.description || null,
        delivery_message: newModalVariation.delivery_message || null,
      }).then(({ error }) => {
        if (error) { toast.error('Failed to add variation'); return; }
        supabase.from('product_variations').select('*').eq('product_id', editingProduct.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => setExistingVariations(data || []));
        toast.success('Variation added!');
        setNewModalVariation({ name: '', price: '', original_price: '', reseller_price: '', description: '', delivery_message: '' });
      });
    } else {
      setPendingVariations([...pendingVariations, { ...newModalVariation }]);
      setNewModalVariation({ name: '', price: '', original_price: '', reseller_price: '', description: '', delivery_message: '' });
    }
  };

  const handleEditVariation = async (id: string, data: { name: string; price: string; original_price: string; reseller_price: string; description?: string; delivery_message?: string }) => {
    if (!data.name || !data.price) {
      toast.error('Name and price are required');
      return;
    }
    const { error } = await supabase.from('product_variations').update({
      name: data.name,
      price: parseFloat(data.price),
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      reseller_price: data.reseller_price ? parseFloat(data.reseller_price) : null,
      description: data.description || null,
      delivery_message: data.delivery_message || null,
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
    // Clean up FK references before deleting
    await supabase.from('price_history').delete().eq('variation_id', variationId);
    await supabase.from('cart_items').delete().eq('variation_id', variationId);
    
    const { error } = await supabase.from('product_variations').delete().eq('id', variationId);
    if (error) {
      console.error('Delete variation error:', error);
      toast.error('Failed to delete variation: ' + error.message);
      return;
    }
    setExistingVariations(existingVariations.filter(v => v.id !== variationId));
    toast.success('Variation deleted!');
  };

  const handleDeletePending = (idx: string) => {
    const index = parseInt(idx);
    setPendingVariations(pendingVariations.filter((_, i) => i !== index));
  };

  const availableStock = stockItems.filter(s => !s.is_used).length;
  const usedStock = stockItems.filter(s => s.is_used).length;

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
          <div className={errors.image_url ? '[&_div]:border-destructive [&_div]:ring-destructive/30 [&_div]:ring-2' : ''}>
            <MultiImageUpload
              values={(() => {
                const imgs: string[] = [];
                if (productForm.image_url) imgs.push(productForm.image_url);
                if (productForm.images?.length) {
                  productForm.images.forEach((img: string) => {
                    if (img && !imgs.includes(img)) imgs.push(img);
                  });
                }
                return imgs;
              })()}
              onChange={(urls) => {
                setProductForm({ 
                  ...productForm, 
                  image_url: urls[0] || '', 
                  images: urls.slice(1)
                });
                if (urls.length > 0) setErrors(prev => ({ ...prev, image_url: false }));
              }}
              maxImages={8}
              bucket="product-images"
              folder="products"
            />
          </div>

          {/* Delivery Type for Access Link */}
          <div>
            <label className="text-sm font-medium mb-2 block">Auto-Delivery Type</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Button
                type="button"
                variant={deliveryType === 'link' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setDeliveryType('link'); }}
                className="gap-1.5"
              >
                <Link className="w-3.5 h-3.5" />
                Direct Link
              </Button>
              <Button
                type="button"
                variant={deliveryType === 'credentials' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setDeliveryType('credentials'); updateAccessLink('credentials'); }}
                className="gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                ID / Password
              </Button>
            </div>

            {/* Delivery Mode: Unique Code Toggle */}
            <div className="mb-3 flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <div>
                  <label className="text-xs font-medium block">Unique Code Per Order</label>
                  <p className="text-[10px] text-muted-foreground">Each order gets a unique code from stock</p>
                </div>
              </div>
              <Switch
                checked={deliveryMode === 'unique'}
                onCheckedChange={(checked) => handleDeliveryModeChange(checked ? 'unique' : 'repeated')}
              />
            </div>

            {deliveryMode === 'repeated' ? (
              // Repeated mode: single access link
              <>
                {deliveryType === 'link' ? (
                  <>
                    <Textarea
                      placeholder="Access Link (https://...) — supports long URLs"
                      value={productForm.access_link}
                      onChange={(e) => setProductForm({ ...productForm, access_link: e.target.value })}
                      className="text-xs h-9 min-h-[36px] max-h-[36px] py-2 font-mono resize-none whitespace-nowrap overflow-x-auto"
                      rows={1}
                    />
                    {/* Show link visibility toggles only when a link is entered */}
                    {productForm.access_link?.trim() && (
                      <div className="space-y-2 mt-2 p-3 rounded-xl bg-muted/50 border border-border">
                        <p className="text-xs font-medium text-muted-foreground">Link Visibility</p>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium flex items-center gap-1.5">
                            🤖 Show in Bot
                          </label>
                          <Switch
                            checked={productForm.show_link_in_bot !== false}
                            onCheckedChange={(v) => setProductForm({ ...productForm, show_link_in_bot: v })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium flex items-center gap-1.5">
                            🌐 Show in Website
                          </label>
                          <Switch
                            checked={productForm.show_link_in_website !== false}
                            onCheckedChange={(v) => setProductForm({ ...productForm, show_link_in_website: v })}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Username / Email / ID</label>
                      <Input
                        placeholder="user@example.com"
                        value={credUsername}
                        onChange={(e) => { setCredUsername(e.target.value); updateAccessLink('credentials', undefined, e.target.value, credPassword); }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Password</label>
                      <Input
                        placeholder="••••••••"
                        value={credPassword}
                        onChange={(e) => { setCredPassword(e.target.value); updateAccessLink('credentials', undefined, credUsername, e.target.value); }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Unique mode: stock items management
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    📦 Available: {availableStock}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    ✅ Used: {usedStock}
                  </Badge>
                </div>

                {!editingProduct && (
                  <p className="text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg">
                    ⚠️ Save the product first, then add stock items
                  </p>
                )}

                {editingProduct && (
                  <>
                    {/* Add new stock item */}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder={deliveryType === 'credentials' ? 'ID: user | Password: pass' : 'https://link...'}
                        value={newStockLink}
                        onChange={(e) => setNewStockLink(e.target.value)}
                        className="text-xs h-9 min-h-[36px] max-h-[36px] py-2 font-mono resize-none whitespace-nowrap overflow-x-auto"
                        rows={1}
                      />
                      <Button size="sm" onClick={handleAddStockItem} className="shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Stock items list */}
                    {loadingStock ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
                    ) : stockItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No stock items yet</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1.5">
                        {stockItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${
                              item.is_used
                                ? 'bg-muted/50 border-border opacity-60'
                                : 'bg-background border-border'
                            }`}
                          >
                            <span className="text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                            <span className="truncate flex-1 font-mono text-[11px]">
                              {item.access_link}
                            </span>
                            {item.is_used ? (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Used</Badge>
                            ) : (
                              <button
                                onClick={() => handleDeleteStockItem(item.id)}
                                className="text-destructive hover:text-destructive/80 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <Input type="number" placeholder="Stock (empty=unlimited)" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} />
          
          {/* Bot Button Color */}
          <div>
            <label className="text-sm font-medium mb-2 block">Bot Button Color</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'primary', label: '🔵 Blue', bg: 'bg-blue-500' },
                { value: 'success', label: '🟢 Green', bg: 'bg-green-500' },
                { value: 'danger', label: '🔴 Red', bg: 'bg-red-500' },
                { value: '', label: '⚪ Default', bg: 'bg-gray-400' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`text-xs px-2 py-2 rounded-lg font-medium transition-all border-2 ${
                    (productForm.button_style || 'primary') === opt.value || (!productForm.button_style && opt.value === 'primary')
                      ? `${opt.bg} text-white border-foreground shadow-md scale-105`
                      : `bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30`
                  }`}
                  onClick={() => setProductForm({ ...productForm, button_style: opt.value || 'primary' })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
                  <div key={v.id}>
                    <VariationItem
                      variation={v}
                      onEdit={handleEditVariation}
                      onDelete={handleDeleteVariation}
                    />
                    <VariationDeliveryManager variation={{ ...v, product_id: editingProduct?.id }} />
                  </div>
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