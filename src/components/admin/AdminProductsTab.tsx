import React, { useState } from 'react';
import { Plus, Edit, Trash2, Download, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminCategoryManager from '@/components/AdminCategoryManager';

interface AdminProductsTabProps {
  products: any[];
  onAddProduct: () => void;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (productId: string) => void;
  onOpenVariations: (product: any) => void;
  onDataChange: () => void;
}

const AdminProductsTab: React.FC<AdminProductsTabProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onOpenVariations,
  onDataChange
}) => {
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = [...new Set(products.map(p => p.category))].sort();

  return (
    <div className="space-y-4">
      {/* Category Manager */}
      <AdminCategoryManager products={products} onCategoryChange={onDataChange} />
      
      <Button className="w-full btn-gradient rounded-xl" onClick={onAddProduct}>
        <Plus className="w-5 h-5 mr-2" />
        Add New Product
      </Button>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
            categoryFilter === 'all' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
        >
          All ({products.length})
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setCategoryFilter(category)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === category 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {category} ({products.filter(p => p.category === category).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {products
          .filter(product => categoryFilter === 'all' || product.category === categoryFilter)
          .map((product: any) => (
          <div key={product.id} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4">
            <img src={product.image_url || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">{product.name}</p>
              <p className="text-sm text-muted-foreground">{product.category}</p>
              <div className="flex items-center gap-2">
                <p className="text-primary font-bold">₹{product.price}</p>
                {product.original_price && (
                  <p className="text-xs text-muted-foreground line-through">₹{product.original_price}</p>
                )}
              </div>
              {product.access_link && (
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <Download className="w-3 h-3" />
                  Has download link
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" onClick={() => onOpenVariations(product)} title="Variations">
                <Package className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => onEditProduct(product)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="destructive" onClick={() => onDeleteProduct(product.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProductsTab;
