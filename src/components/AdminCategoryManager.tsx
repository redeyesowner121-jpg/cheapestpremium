import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, FolderOpen, Check, X, GripVertical, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  sort_order: number | null;
  is_active: boolean | null;
  icon_url: string | null;
  created_at: string;
  productCount?: number;
}

interface AdminCategoryManagerProps {
  products: any[];
  onCategoryChange: () => void;
}

const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({ products, onCategoryChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIconId, setUploadingIconId] = useState<string | null>(null);
  const pendingUploadId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, [products]);

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (data) {
      // Count products in each category
      const categoriesWithCount = data.map(cat => ({
        ...cat,
        productCount: products.filter(p => p.category === cat.name).length
      }));
      setCategories(categoriesWithCount);
    }
    setLoading(false);
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    const exists = categories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase());
    if (exists) {
      toast.error('Category already exists');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('categories').insert({
      name: newCategory.trim(),
      sort_order: categories.length + 1,
      is_active: true
    });

    if (error) {
      toast.error('Failed to add category');
      setSaving(false);
      return;
    }

    toast.success(`Category "${newCategory}" added`);
    setNewCategory('');
    setSaving(false);
    loadCategories();
    onCategoryChange();
  };

  const handleRenameCategory = async () => {
    if (!editingId || !editedName.trim()) {
      toast.error('Please enter a new name');
      return;
    }

    const category = categories.find(c => c.id === editingId);
    if (!category) return;

    if (editedName.trim().toLowerCase() === category.name.toLowerCase()) {
      setEditingId(null);
      return;
    }

    setSaving(true);
    
    // Update category name
    const { error: catError } = await supabase
      .from('categories')
      .update({ name: editedName.trim() })
      .eq('id', editingId);

    if (catError) {
      toast.error('Failed to rename category');
      setSaving(false);
      return;
    }

    // Also update all products with the old category name
    await supabase
      .from('products')
      .update({ category: editedName.trim() })
      .eq('category', category.name);

    toast.success(`Category renamed to "${editedName}"`);
    setEditingId(null);
    setEditedName('');
    setSaving(false);
    loadCategories();
    onCategoryChange();
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.productCount && category.productCount > 0) {
      const confirm = window.confirm(
        `This category has ${category.productCount} product(s). Products with orders will be deactivated, others will be deleted. Continue?`
      );
      if (!confirm) return;
    }

    setSaving(true);

    // Handle products in this category
    const productsInCategory = products.filter(p => p.category === category.name);
    
    for (const product of productsInCategory) {
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', product.id);
      
      if (orderCount && orderCount > 0) {
        // Product has orders - deactivate instead
        await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', product.id);
      } else {
        // No orders - safe to delete
        await supabase.from('product_variations').delete().eq('product_id', product.id);
        await supabase.from('flash_sales').delete().eq('product_id', product.id);
        await supabase.from('products').delete().eq('id', product.id);
      }
    }

    // Delete the category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id);

    if (error) {
      toast.error('Failed to delete category');
      setSaving(false);
      return;
    }

    toast.success(`Category "${category.name}" deleted`);
    setSaving(false);
    loadCategories();
    onCategoryChange();
  };

  const toggleCategoryActive = async (category: Category) => {
    await supabase
      .from('categories')
      .update({ is_active: !category.is_active })
      .eq('id', category.id);
    
    toast.success(category.is_active ? 'Category disabled' : 'Category enabled');
    loadCategories();
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditedName(category.name);
  };

  const handleIconUpload = async (categoryId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    setUploadingIconId(categoryId);
    const fileExt = file.name.split('.').pop();
    const filePath = `category-icons/${categoryId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload icon');
      setUploadingIconId(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    await supabase
      .from('categories')
      .update({ icon_url: urlData.publicUrl })
      .eq('id', categoryId);

    toast.success('Category icon updated');
    setUploadingIconId(null);
    loadCategories();
    onCategoryChange();
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card mb-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          Categories ({categories.length})
        </h3>
      </div>

      {/* Add New Category */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="New category name..."
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="flex-1 h-10 rounded-xl"
          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          disabled={saving}
        />
        <Button onClick={handleAddCategory} size="sm" className="h-10 px-4" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          Add
        </Button>
      </div>

      {/* Category List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">
            No categories yet. Add your first category!
          </p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className={`flex items-center gap-3 p-3 rounded-xl group transition-colors ${
                category.is_active ? 'bg-muted' : 'bg-muted/50 opacity-60'
              }`}
            >
              {editingId === category.id ? (
                <>
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCategory();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    disabled={saving}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleRenameCategory}
                    disabled={saving}
                  >
                    <Check className="w-4 h-4 text-success" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </>
              ) : (
                <>
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  {/* Category Icon */}
                  <button
                    onClick={() => {
                      pendingUploadId.current = category.id;
                      setUploadingIconId(category.id);
                      fileInputRef.current?.click();
                    }}
                    className="relative w-10 h-10 rounded-lg bg-muted/50 border border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors flex-shrink-0"
                    title="Click to change icon"
                  >
                    {uploadingIconId === category.id && saving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : category.icon_url ? (
                      <img src={category.icon_url} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.productCount || 0} product(s)
                    </p>
                  </div>
                  <Switch
                    checked={category.is_active ?? true}
                    onCheckedChange={() => toggleCategoryActive(category)}
                    className="scale-75"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(category)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCategory(category)}
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
      {/* Hidden file input for icon upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = pendingUploadId.current;
          if (file && targetId) {
            handleIconUpload(targetId, file);
          }
          pendingUploadId.current = null;
          e.target.value = '';
        }}
      />
    </div>
  );
};

export default AdminCategoryManager;
