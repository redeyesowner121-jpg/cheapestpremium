import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, FolderOpen, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Category {
  name: string;
  count: number;
}

interface AdminCategoryManagerProps {
  products: any[];
  onCategoryChange: () => void;
}

const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({ products, onCategoryChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    extractCategories();
  }, [products]);

  const extractCategories = () => {
    const categoryMap: Record<string, number> = {};
    products.forEach(product => {
      if (product.category) {
        categoryMap[product.category] = (categoryMap[product.category] || 0) + 1;
      }
    });
    
    const cats = Object.entries(categoryMap).map(([name, count]) => ({ name, count }));
    cats.sort((a, b) => a.name.localeCompare(b.name));
    setCategories(cats);
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

    // Create a placeholder product with this category to register it
    // Or you can just add it locally - categories are derived from products
    toast.success(`Category "${newCategory}" is ready to use. Add products to this category.`);
    setNewCategory('');
  };

  const handleRenameCategory = async () => {
    if (!editingCategory || !editedName.trim()) {
      toast.error('Please enter a new name');
      return;
    }

    if (editedName.trim().toLowerCase() === editingCategory.toLowerCase()) {
      setEditingCategory(null);
      return;
    }

    setLoading(true);
    
    // Update all products with the old category to the new category
    const { error } = await supabase
      .from('products')
      .update({ category: editedName.trim() })
      .eq('category', editingCategory);

    if (error) {
      toast.error('Failed to rename category');
      setLoading(false);
      return;
    }

    toast.success(`Category renamed to "${editedName}"`);
    setEditingCategory(null);
    setEditedName('');
    setLoading(false);
    onCategoryChange();
  };

  const handleDeleteCategory = async (categoryName: string) => {
    const productsInCategory = products.filter(p => p.category === categoryName);
    
    if (productsInCategory.length > 0) {
      const confirm = window.confirm(
        `This will remove ${productsInCategory.length} product(s) in "${categoryName}". Products with orders will be deactivated. Continue?`
      );
      if (!confirm) return;

      setLoading(true);
      
      // Check each product for orders and handle accordingly
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

      toast.success(`Category "${categoryName}" products removed/deactivated`);
      setLoading(false);
      onCategoryChange();
    } else {
      toast.info('Category is already empty');
    }
  };

  const startEdit = (categoryName: string) => {
    setEditingCategory(categoryName);
    setEditedName(categoryName);
  };

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
        />
        <Button onClick={handleAddCategory} size="sm" className="h-10 px-4">
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Category List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">
            No categories yet. Add products to create categories.
          </p>
        ) : (
          categories.map((category) => (
            <div
              key={category.name}
              className="flex items-center gap-3 p-3 bg-muted rounded-xl group"
            >
              {editingCategory === category.name ? (
                <>
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCategory();
                      if (e.key === 'Escape') setEditingCategory(null);
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleRenameCategory}
                    disabled={loading}
                  >
                    <Check className="w-4 h-4 text-success" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingCategory(null)}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.count} product(s)</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(category.name)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCategory(category.name)}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminCategoryManager;
