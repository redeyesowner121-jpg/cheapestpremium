import React from 'react';
import { Plus, Trash2, Package, Search, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import MultiImageUpload from '@/components/ui/multi-image-upload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: any;
  categories: { id: string; name: string }[];
  onRefresh: () => void;
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  original_price: string;
  reseller_price: string;
  category: string;
  images: string[];
  access_link: string;
  stock: string;
  is_active: boolean;
  seo_tags: string;
}

interface Variation {
  name: string;
  price: string;
  reseller_price: string;
}

const quickVariationTemplates = [
  { name: '1 Month', price: '49', reseller_price: '' },
  { name: '3 Months', price: '129', reseller_price: '' },
  { name: '6 Months', price: '249', reseller_price: '' },
  { name: '1 Year', price: '449', reseller_price: '' },
];

const ProductModal: React.FC<ProductModalProps> = ({
  open,
  onOpenChange,
  editingProduct,
  categories,
  onRefresh,
}) => {
  const [productForm, setProductForm] = React.useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    original_price: '',
    reseller_price: '',
    category: '',
    images: [],
    access_link: '',
    stock: '',
    is_active: true,
    seo_tags: ''
  });
  const [pendingVariations, setPendingVariations] = React.useState<Variation[]>([]);
  const [existingVariations, setExistingVariations] = React.useState<any[]>([]);
  const [newModalVariation, setNewModalVariation] = React.useState<Variation>({ name: '', price: '', reseller_price: '' });
  const [editingVarId, setEditingVarId] = React.useState<string | null>(null);
  const [editVarForm, setEditVarForm] = React.useState<Variation>({ name: '', price: '', reseller_price: '' });

  React.useEffect(() => {
    if (editingProduct) {
      // Parse existing images - support both single image_url and new images array
      const existingImages: string[] = [];
      if (editingProduct.image_url) {
        // Check if it's a JSON array or single URL
        try {
          const parsed = JSON.parse(editingProduct.image_url);
          if (Array.isArray(parsed)) {
            existingImages.push(...parsed);
          } else {
            existingImages.push(editingProduct.image_url);
          }
        } catch {
          existingImages.push(editingProduct.image_url);
        }
      }
      
      setProductForm({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: editingProduct.price?.toString() || '',
        original_price: editingProduct.original_price?.toString() || '',
        reseller_price: editingProduct.reseller_price?.toString() || '',
        category: editingProduct.category || '',
        images: existingImages,
        access_link: editingProduct.access_link || '',
        stock: editingProduct.stock?.toString() || '',
        is_active: editingProduct.is_active !== false,
        seo_tags: editingProduct.seo_tags || ''
      });
      
      // Load existing variations
      loadVariations(editingProduct.id);
    } else {
      resetForm();
    }
  }, [editingProduct, open]);

  const loadVariations = async (productId: string) => {
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    setExistingVariations(data || []);
  };

  const resetForm = () => {
    setProductForm({
      name: '',
      description: '',
      price: '',
      original_price: '',
      reseller_price: '',
      category: '',
      images: [],
      access_link: '',
      stock: '',
      is_active: true,
      seo_tags: ''
    });
    setPendingVariations([]);
    setExistingVariations([]);
    setNewModalVariation({ name: '', price: '', reseller_price: '' });
  };

  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.category) {
      toast.error('Product Name ও Category অবশ্যই পূরণ করুন');
      return;
    }
    
    // Store images as JSON array or first image URL for backward compatibility
    const imageUrl = productForm.images.length > 1 
      ? JSON.stringify(productForm.images)
      : productForm.images[0] || '';
    
    // Generate unique slug from product name
    const baseSlug = productForm.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'product';
    const slugSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const productSlug = `${baseSlug}-${slugSuffix}`;

    const { data: newProduct, error } = await supabase.from('products').insert({
      name: productForm.name,
      description: productForm.description,
      price: productForm.price ? parseFloat(productForm.price) : 0,
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category,
      image_url: imageUrl,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      seo_tags: productForm.seo_tags || '',
      is_active: productForm.is_active,
      slug: productSlug
    }).select().single();
    
    if (error || !newProduct) {
      toast.error('Failed to add product');
      return;
    }
    
    if (pendingVariations.length > 0) {
      const variationsToInsert = pendingVariations.map(v => ({
        product_id: newProduct.id,
        name: v.name,
        price: parseFloat(v.price),
        reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
      }));

      const { error: varError } = await supabase.from('product_variations').insert(variationsToInsert);
      if (varError) {
        console.error('Variation insert error:', varError);
        toast.error('Failed to add variations');
      }
    }
    
    toast.success('Product added!');
    onOpenChange(false);
    onRefresh();
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !productForm.name || !productForm.category) {
      toast.error('Product Name ও Category অবশ্যই পূরণ করুন');
      return;
    }
    
    // Store images as JSON array or first image URL for backward compatibility
    const imageUrl = productForm.images.length > 1 
      ? JSON.stringify(productForm.images)
      : productForm.images[0] || '';
    
    const { error } = await supabase.from('products').update({
      name: productForm.name,
      description: productForm.description,
      price: productForm.price ? parseFloat(productForm.price) : 0,
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category,
      image_url: imageUrl,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      seo_tags: productForm.seo_tags || '',
      is_active: productForm.is_active
    }).eq('id', editingProduct.id);
    
    if (error) {
      toast.error('Failed to update product');
      return;
    }
    
    if (pendingVariations.length > 0) {
      const variationsToInsert = pendingVariations.map(v => ({
        product_id: editingProduct.id,
        name: v.name,
        price: parseFloat(v.price),
        reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
      }));

      const { error: varError } = await supabase.from('product_variations').insert(variationsToInsert);
      if (varError) {
        console.error('Variation insert error:', varError);
        toast.error('Failed to add variations');
      }
    }
    
    toast.success('Product updated!');
    onOpenChange(false);
    onRefresh();
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
        reseller_price: newModalVariation.reseller_price ? parseFloat(newModalVariation.reseller_price) : null
      }).then(({ error }) => {
        if (error) {
          toast.error('Failed to add variation');
          return;
        }
        
        loadVariations(editingProduct.id);
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

  const handleQuickVariation = (template: Variation) => {
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id,
        name: template.name,
        price: parseFloat(template.price)
      }).then(() => {
        loadVariations(editingProduct.id);
        toast.success(`${template.name} added!`);
      });
    } else {
      setPendingVariations([...pendingVariations, { ...template }]);
    }
  };

  const startEditVariation = (v: any) => {
    setEditingVarId(v.id);
    setEditVarForm({
      name: v.name,
      price: String(v.price),
      reseller_price: v.reseller_price ? String(v.reseller_price) : '',
    });
  };

  const handleUpdateVariation = async () => {
    if (!editingVarId || !editVarForm.name || !editVarForm.price) {
      toast.error('Name and price are required');
      return;
    }
    const { error } = await supabase
      .from('product_variations')
      .update({
        name: editVarForm.name,
        price: parseFloat(editVarForm.price),
        reseller_price: editVarForm.reseller_price ? parseFloat(editVarForm.reseller_price) : null,
      })
      .eq('id', editingVarId);
    if (error) {
      toast.error('Failed to update variation');
      return;
    }
    toast.success('Variation updated!');
    setEditingVarId(null);
    if (editingProduct) loadVariations(editingProduct.id);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input 
            placeholder="Product Name *" 
            value={productForm.name} 
            onChange={(e) => setProductForm({...productForm, name: e.target.value})} 
          />
          <Textarea 
            placeholder="Description" 
            value={productForm.description} 
            onChange={(e) => setProductForm({...productForm, description: e.target.value})} 
            rows={2} 
          />
          <div className="grid grid-cols-3 gap-2">
            <Input 
              type="number" 
              placeholder="Price *" 
              value={productForm.price} 
              onChange={(e) => setProductForm({...productForm, price: e.target.value})} 
            />
            <Input 
              type="number" 
              placeholder="Original" 
              value={productForm.original_price} 
              onChange={(e) => setProductForm({...productForm, original_price: e.target.value})} 
            />
            <Input 
              type="number" 
              placeholder="Reseller" 
              value={productForm.reseller_price} 
              onChange={(e) => setProductForm({...productForm, reseller_price: e.target.value})} 
            />
          </div>
          <Select value={productForm.category} onValueChange={(value) => setProductForm({...productForm, category: value})}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Multi Image Upload with prominent button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Product Images</label>
              <span className="text-[10px] text-muted-foreground">{productForm.images.length}/5</span>
            </div>
            <MultiImageUpload
              values={productForm.images}
              onChange={(urls) => setProductForm({...productForm, images: urls})}
              maxImages={5}
              bucket="product-images"
              folder="products"
            />
          </div>
          
          <Input 
            placeholder="Access Link (Optional)" 
            value={productForm.access_link} 
            onChange={(e) => setProductForm({...productForm, access_link: e.target.value})} 
          />
          <Input 
            type="number" 
            placeholder="Stock (empty=unlimited)" 
            value={productForm.stock} 
            onChange={(e) => setProductForm({...productForm, stock: e.target.value})} 
          />
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={productForm.is_active} onCheckedChange={(v) => setProductForm({...productForm, is_active: v})} />
          </div>
          
          {/* SEO Tags Section */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              SEO Tags
            </h4>
            <Textarea
              placeholder="SEO keywords comma-separated (e.g. netflix premium, ott subscription, streaming, cheap netflix)"
              value={productForm.seo_tags}
              onChange={(e) => setProductForm({...productForm, seo_tags: e.target.value})}
              rows={2}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              এই keywords দিয়ে ইউজাররা সার্চ করলে এই প্রোডাক্ট দেখাবে
            </p>
          </div>
          
          {/* Variations Section */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Variations (Optional)
            </h4>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {quickVariationTemplates.map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
                  onClick={() => handleQuickVariation(template)}
                >
                  + {template.name}
                </button>
              ))}
            </div>
            
            {existingVariations.length > 0 && (
              <div className="space-y-2 mb-3">
                {existingVariations.map((v) => (
                  <div key={v.id} className="p-2 bg-muted rounded-xl">
                    {editingVarId === v.id ? (
                      <div className="space-y-2">
                        <Input placeholder="Name" value={editVarForm.name} onChange={(e) => setEditVarForm({ ...editVarForm, name: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" placeholder="Price" value={editVarForm.price} onChange={(e) => setEditVarForm({ ...editVarForm, price: e.target.value })} />
                          <Input type="number" placeholder="Reseller" value={editVarForm.reseller_price} onChange={(e) => setEditVarForm({ ...editVarForm, reseller_price: e.target.value })} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingVarId(null)}><X className="w-3 h-3 mr-1" />Cancel</Button>
                          <Button size="sm" onClick={handleUpdateVariation}><Check className="w-3 h-3 mr-1" />Save</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{v.name} - ₹{v.price} {v.reseller_price && `(R: ₹${v.reseller_price})`}</span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => startEditVariation(v)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDeleteVariation(v.id, true)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {pendingVariations.length > 0 && (
              <div className="space-y-2 mb-3">
                {pendingVariations.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-accent/10 rounded-xl">
                    <span className="text-sm">{v.name} - ₹{v.price} {v.reseller_price && `(R: ₹${v.reseller_price})`}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleDeleteVariation(idx.toString(), false)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={newModalVariation.name} onChange={(e) => setNewModalVariation({...newModalVariation, name: e.target.value})} />
              <Input type="number" placeholder="Price" value={newModalVariation.price} onChange={(e) => setNewModalVariation({...newModalVariation, price: e.target.value})} />
            </div>
            <div className="flex gap-2 mt-2">
              <Input type="number" placeholder="Reseller Price" value={newModalVariation.reseller_price} onChange={(e) => setNewModalVariation({...newModalVariation, reseller_price: e.target.value})} />
              <Button onClick={handleAddModalVariation}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>
          
          <Button className="w-full btn-gradient" onClick={editingProduct ? handleUpdateProduct : handleAddProduct}>
            {editingProduct ? 'Update Product' : 'Add Product'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductModal;
