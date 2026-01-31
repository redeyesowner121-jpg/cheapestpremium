import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Download, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminCategoryManager from '@/components/AdminCategoryManager';
import AdminAdvancedFilters from './AdminAdvancedFilters';

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
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onOpenVariations,
  onDataChange
}) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('newest');
  const [stockFilter, setStockFilter] = useState('all');

  const categories = [...new Set(products.map(p => p.category))].sort();

  const filteredProducts = useMemo(() => {
    let result = products;

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    // Price range filter
    if (priceRange.min) {
      result = result.filter(p => p.price >= parseFloat(priceRange.min));
    }
    if (priceRange.max) {
      result = result.filter(p => p.price <= parseFloat(priceRange.max));
    }

    // Stock filter
    if (stockFilter !== 'all') {
      result = result.filter(p => {
        const stock = p.stock ?? null;
        if (stockFilter === 'in_stock') return stock === null || stock > 10;
        if (stockFilter === 'low_stock') return stock !== null && stock > 0 && stock <= 10;
        if (stockFilter === 'out_of_stock') return stock === 0;
        return true;
      });
    }

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price_high':
          return b.price - a.price;
        case 'price_low':
          return a.price - b.price;
        case 'sales':
          return (b.sold_count || 0) - (a.sold_count || 0);
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [products, categoryFilter, searchQuery, priceRange, sortBy, stockFilter]);

  // Stock alerts
  const lowStockCount = products.filter(p => p.stock !== null && p.stock > 0 && p.stock <= 10).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

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
              stockFilter === filter.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground hover:bg-muted'
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
      {/* Stock Alerts */}
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

      {/* Category Manager */}
      <AdminCategoryManager products={products} onCategoryChange={onDataChange} />
      
      <Button className="w-full btn-gradient rounded-xl" onClick={onAddProduct}>
        <Plus className="w-5 h-5 mr-2" />
        Add New Product
      </Button>

      {/* Advanced Filters */}
      <AdminAdvancedFilters
        config={{
          searchPlaceholder: 'Search products by name...',
          showPriceFilter: true,
          showSortOptions: true,
          sortOptions,
          customFilters: stockFilterButtons
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

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

      {/* Results Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filteredProducts.length} of {products.length} products
      </p>

      {/* Products List */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No products found matching your filters</p>
          </div>
        ) : (
          filteredProducts.map((product: any) => (
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
                <div className="flex items-center gap-3 mt-1">
                  {product.access_link && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      Instant
                    </p>
                  )}
                  {product.stock !== null && (
                    <p className={`text-xs flex items-center gap-1 ${
                      product.stock === 0 ? 'text-destructive' : 
                      product.stock <= 10 ? 'text-accent' : 'text-muted-foreground'
                    }`}>
                      <Package className="w-3 h-3" />
                      {product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {product.sold_count || 0} sold
                  </p>
                </div>
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
          ))
        )}
      </div>
    </div>
  );
};

export default AdminProductsTab;
