import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Category {
  id: string;
  name: string;
  sort_order: number | null;
  is_active: boolean | null;
  icon_url: string | null;
  created_at: string;
  productCount?: number;
}

export function useCategoryActions(products: any[], onCategoryChange: () => void) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) {
      setCategories(data.map(cat => ({
        ...cat,
        productCount: products.filter(p => p.category === cat.name).length,
      })));
    }
    setLoading(false);
  }, [products]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const addCategory = async (name: string) => {
    if (!name.trim()) { toast.error('Please enter a category name'); return false; }
    const exists = categories.some(c => c.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) { toast.error('Category already exists'); return false; }
    setSaving(true);
    const { error } = await supabase.from('categories').insert({
      name: name.trim(),
      sort_order: categories.length + 1,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error('Failed to add category'); return false; }
    toast.success(`Category "${name}" added`);
    loadCategories();
    onCategoryChange();
    return true;
  };

  const renameCategory = async (id: string, newName: string) => {
    const category = categories.find(c => c.id === id);
    if (!category) return;
    if (newName.trim().toLowerCase() === category.name.toLowerCase()) return;
    setSaving(true);
    const { error } = await supabase.from('categories')
      .update({ name: newName.trim() }).eq('id', id);
    if (error) { toast.error('Failed to rename category'); setSaving(false); return; }
    await supabase.from('products').update({ category: newName.trim() }).eq('category', category.name);
    toast.success(`Category renamed to "${newName}"`);
    setSaving(false);
    loadCategories();
    onCategoryChange();
  };

  const deleteCategory = async (category: Category) => {
    if (category.productCount && category.productCount > 0) {
      const ok = window.confirm(`This category has ${category.productCount} product(s). Products with orders will be deactivated, others will be deleted. Continue?`);
      if (!ok) return;
    }
    setSaving(true);
    const productsInCategory = products.filter(p => p.category === category.name);
    for (const product of productsInCategory) {
      const { count: orderCount } = await supabase
        .from('orders').select('*', { count: 'exact', head: true }).eq('product_id', product.id);
      if (orderCount && orderCount > 0) {
        await supabase.from('products').update({ is_active: false }).eq('id', product.id);
      } else {
        await supabase.from('product_variations').delete().eq('product_id', product.id);
        await supabase.from('flash_sales').delete().eq('product_id', product.id);
        await supabase.from('products').delete().eq('id', product.id);
      }
    }
    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    setSaving(false);
    if (error) { toast.error('Failed to delete category'); return; }
    toast.success(`Category "${category.name}" deleted`);
    loadCategories();
    onCategoryChange();
  };

  const toggleActive = async (category: Category) => {
    await supabase.from('categories').update({ is_active: !category.is_active }).eq('id', category.id);
    toast.success(category.is_active ? 'Category disabled' : 'Category enabled');
    loadCategories();
  };

  const uploadIcon = async (categoryId: string, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    const fileExt = file.name.split('.').pop();
    const filePath = `category-icons/${categoryId}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images').upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error('Failed to upload icon'); return; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
    const iconUrlWithCacheBust = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('categories').update({ icon_url: iconUrlWithCacheBust }).eq('id', categoryId);
    toast.success('Category icon updated');
    loadCategories();
    onCategoryChange();
  };

  return { categories, loading, saving, addCategory, renameCategory, deleteCategory, toggleActive, uploadIcon };
}
