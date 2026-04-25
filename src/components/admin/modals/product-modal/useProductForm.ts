import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductForm {
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

export interface Variation {
  name: string;
  price: string;
  reseller_price: string;
}

export const QUICK_VARIATION_TEMPLATES: Variation[] = [
  { name: '1 Month', price: '49', reseller_price: '' },
  { name: '3 Months', price: '129', reseller_price: '' },
  { name: '6 Months', price: '249', reseller_price: '' },
  { name: '1 Year', price: '449', reseller_price: '' },
];

const EMPTY_FORM: ProductForm = {
  name: '', description: '', price: '', original_price: '', reseller_price: '',
  category: '', images: [], access_link: '', stock: '', is_active: true, seo_tags: '',
};

const EMPTY_VAR: Variation = { name: '', price: '', reseller_price: '' };

const buildSlug = async (name: string) => {
  const base = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'product';
  const { data: existing } = await supabase.from('products').select('slug').like('slug', `${base}%`);
  const set = new Set((existing || []).map((p: any) => p.slug));
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
};

const parseImages = (image_url: string): string[] => {
  if (!image_url) return [];
  try {
    const parsed = JSON.parse(image_url);
    return Array.isArray(parsed) ? parsed : [image_url];
  } catch { return [image_url]; }
};

const serializeImages = (images: string[]) =>
  images.length > 1 ? JSON.stringify(images) : (images[0] || '');

export function useProductFormState(editingProduct: any, open: boolean) {
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_FORM);
  const [pendingVariations, setPendingVariations] = useState<Variation[]>([]);
  const [existingVariations, setExistingVariations] = useState<any[]>([]);
  const [newModalVariation, setNewModalVariation] = useState<Variation>(EMPTY_VAR);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [editVarForm, setEditVarForm] = useState<Variation>(EMPTY_VAR);

  const resetForm = () => {
    setProductForm(EMPTY_FORM);
    setPendingVariations([]);
    setExistingVariations([]);
    setNewModalVariation(EMPTY_VAR);
  };

  const loadVariations = async (productId: string) => {
    const { data } = await supabase.from('product_variations').select('*')
      .eq('product_id', productId).order('created_at', { ascending: true });
    setExistingVariations(data || []);
  };

  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: editingProduct.price?.toString() || '',
        original_price: editingProduct.original_price?.toString() || '',
        reseller_price: editingProduct.reseller_price?.toString() || '',
        category: editingProduct.category || '',
        images: parseImages(editingProduct.image_url || ''),
        access_link: editingProduct.access_link || '',
        stock: editingProduct.stock?.toString() || '',
        is_active: editingProduct.is_active !== false,
        seo_tags: editingProduct.seo_tags || '',
      });
      loadVariations(editingProduct.id);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProduct, open]);

  return {
    productForm, setProductForm,
    pendingVariations, setPendingVariations,
    existingVariations, setExistingVariations,
    newModalVariation, setNewModalVariation,
    editingVarId, setEditingVarId,
    editVarForm, setEditVarForm,
    resetForm, loadVariations,
  };
}

export async function saveProduct(opts: {
  editingProduct: any;
  productForm: ProductForm;
  pendingVariations: Variation[];
}): Promise<boolean> {
  const { editingProduct, productForm, pendingVariations } = opts;
  if (!productForm.name || !productForm.category) {
    toast.error('Product Name & Category are required');
    return false;
  }
  const imageUrl = serializeImages(productForm.images);
  const base = {
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
  };

  let targetId: string;
  if (editingProduct) {
    const { error } = await supabase.from('products').update(base).eq('id', editingProduct.id);
    if (error) { toast.error('Failed to update product'); return false; }
    targetId = editingProduct.id;
    toast.success('Product updated!');
  } else {
    const slug = await buildSlug(productForm.name);
    const { data: newProduct, error } = await supabase.from('products')
      .insert({ ...base, slug }).select().single();
    if (error || !newProduct) { toast.error('Failed to add product'); return false; }
    targetId = newProduct.id;
    toast.success('Product added!');
  }

  if (pendingVariations.length > 0) {
    const rows = pendingVariations.map(v => ({
      product_id: targetId,
      name: v.name,
      price: parseFloat(v.price),
      reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null,
    }));
    const { error } = await supabase.from('product_variations').insert(rows);
    if (error) { console.error(error); toast.error('Failed to add variations'); }
  }
  return true;
}
