import React, { useState } from 'react';
import { Plus, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminCategoryManager from '@/components/AdminCategoryManager';
import AdminAdvancedFilters from './AdminAdvancedFilters';
import { useProductFilters } from './products-tab/useProductFilters';
import { ProductRow } from './products-tab/ProductRow';
import { SeoTagsModal } from './products-tab/SeoTagsModal';

interface AdminProductsTabProps {
  products: any[];
  onAddProduct: () => void;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (productId: string) => void;
  onOpenVariations: (product: any) => void;
  onDataChange: () => void;
}

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_high', label: 'Price ↓' },
  { value: 'price_low', label: 'Price ↑' },
  { value: 'sales', label: 'Most Sold' },
];

const stockFilters = [
  { value: 'all', label: 'All Stock' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

const AdminProductsTab: React.FC<AdminProductsTabProps> = ({
  products, onAddProduct, onEditProduct, onDeleteProduct, onDataChange,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('newest');
  const [stockFilter, setStockFilter] = useState('all');
  const [seoProduct, setSeoProduct] = useState<any>(null);

  const categories = [...new Set(products.map((p) => p.category))].sort();
  const filteredProducts = useProductFilters({ products, categoryFilter, searchQuery, priceRange, stockFilter, sortBy });

  const lowStockCount = products.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const stockFilterButtons = (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Package className="w-3 h-3" />
        Stock Level
      </label>
      <div className="flex gap-2 flex-wrap">
        {stockFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStockFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stockFilter === filter.value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
            }`}
          >
            {filter.label}
            {filter.value === 'low_stock' && lowStockCount > 0 && (
              <span className="ml-1 text-accent">({lowStockCount})</span>
            )}
            {filter.value === 'out_of_stock' && outOfStockCount > 0 && (
              <span className="ml-1 text-destructive">({outOfStockCount})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-accent" />
          <div className="text-sm">
            {outOfStockCount > 0 && (
              <span className="text-destructive font-medium">{outOfStockCount} out of stock</span>
            )}
            {outOfStockCount > 0 && lowStockCount > 0 && <span className="text-muted-foreground"> • </span>}
            {lowStockCount > 0 && (
              <span className="text-accent font-medium">{lowStockCount} low stock</span>
            )}
          </div>
        </div>
      )}

      <AdminCategoryManager products={products} onCategoryChange={onDataChange} />

      <Button className="w-full btn-gradient rounded-xl" onClick={onAddProduct}>
        <Plus className="w-5 h-5 mr-2" />
        Add New Product
      </Button>

      <AdminAdvancedFilters
        config={{
          searchPlaceholder: 'Search products by name...',
          showPriceFilter: true,
          showSortOptions: true,
          sortOptions,
          customFilters: stockFilterButtons,
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
            categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
        >
          All ({products.length})
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setCategoryFilter(category)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === category ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {category} ({products.filter((p) => p.category === category).length})
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredProducts.length} of {products.length} products
      </p>

      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No products found matching your filters</p>
          </div>
        ) : (
          filteredProducts.map((product: any) => (
            <ProductRow
              key={product.id}
              product={product}
              onEdit={onEditProduct}
              onDelete={onDeleteProduct}
              onOpenSeo={setSeoProduct}
            />
          ))
        )}
      </div>

      <SeoTagsModal product={seoProduct} onClose={() => setSeoProduct(null)} onSaved={onDataChange} />
    </div>
  );
};

export default AdminProductsTab;
