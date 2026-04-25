import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Filter, Lightbulb } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import OrderSuccessModal from '@/components/OrderSuccessModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProductsData } from './products/useProductsData';
import SEOHead from '@/components/SEOHead';
import { Product, ProductVariation } from './products/types';
import ProductCard from './products/ProductCard';
import CategorySection from './products/CategorySection';
import ProductsBuyModal from './products/ProductsBuyModal';
import CourseDisclaimer from '@/components/CourseDisclaimer';
import { useProductFilters } from './products/useProductFilters';
import ProductFilterSheet from './products/ProductFilterSheet';
import { placeProductOrder } from './products/place-order';

const ProductsPage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const flashSale = location.state?.flashSale;

  const {
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    categories, loading,
    filteredProducts, methodsProducts,
    loadProducts,
  } = useProductsData();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<{ productName: string; totalPrice: number; accessLink?: string | null }>({ productName: '', totalPrice: 0 });
  const [quantity, setQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [flashSalePrice, setFlashSalePrice] = useState<number | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { filters, setFilters, maxPrice, displayProducts, activeFiltersCount } = useProductFilters(filteredProducts);

  useEffect(() => {
    if (flashSale && flashSale.productData) {
      const product = {
        id: flashSale.productData.id,
        name: flashSale.productData.name,
        description: flashSale.productData.description || '',
        price: flashSale.salePrice,
        original_price: flashSale.productData.price,
        image_url: flashSale.productData.image_url,
        rating: flashSale.productData.rating || 4.5,
        sold_count: flashSale.productData.sold_count || 0,
        category: flashSale.productData.category,
        access_link: flashSale.productData.access_link,
      };
      setSelectedProduct(product as Product);
      setFlashSalePrice(flashSale.salePrice);
      setShowBuyModal(true);
    }
  }, [flashSale]);

  const handleBuy = async (product: Product, salePrice?: number) => {
    setSelectedProduct(product);
    setFlashSalePrice(salePrice || null);
    setSelectedVariation(null);
    setQuantity(1);
    setOrderNote('');
    const { data } = await supabase
      .from('product_variations').select('*')
      .eq('product_id', product.id).eq('is_active', true);
    setProductVariations(data || []);
    setShowBuyModal(true);
  };

  const handleConfirmOrder = async () => {
    if (!profile || !user || !selectedProduct) { toast.error('Please login to place order'); return; }
    if (!profile.phone) {
      toast.error('Please add your phone number to place an order');
      navigate('/profile/edit');
      return;
    }
    try {
      const result = await placeProductOrder({
        product: selectedProduct, variation: selectedVariation,
        flashSalePrice, quantity, orderNote, profile, user,
      });
      if (!result) return;
      setSuccessOrderData({
        productName: result.productName,
        totalPrice: result.totalPrice,
        accessLink: result.accessLink,
      });
      setShowBuyModal(false);
      setShowSuccessModal(true);
      refreshProfile();
      loadProducts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEOHead
        title="Shop All Premium Subscriptions"
        description="Browse & buy cheapest premium subscriptions — Netflix, Spotify, YouTube Premium, Canva Pro, ChatGPT Plus & more. Filter by category, price & availability."
        canonicalPath="/products"
        keywords="premium subscriptions india, cheap ott india, netflix spotify cheap, buy premium accounts, digital subscriptions wholesale"
        breadcrumbs={[{ name: 'Home', path: '/' }, { name: 'All Products', path: '/products' }]}
      />
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search products..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-12 h-12 rounded-xl bg-card border-0 shadow-card" />
          <ProductFilterSheet
            open={filterOpen} onOpenChange={setFilterOpen}
            filters={filters} setFilters={setFilters}
            maxPrice={maxPrice} activeFiltersCount={activeFiltersCount}
          />
        </div>

        <div className="mb-2 -mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'gradient-primary text-primary-foreground shadow-card'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}>{cat.name}</button>
            ))}
          </div>
        </div>

        {selectedCategory === 'all' && (
          <CategorySection
            title="Methods"
            icon={Lightbulb}
            iconColorClass="text-orange-600"
            gradientClass="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
            categoryId="methods"
            products={methodsProducts}
            onCategorySelect={setSelectedCategory}
          />
        )}

        {selectedCategory === 'courses' && <CourseDisclaimer />}

        <div className="grid grid-cols-2 gap-3">
          {displayProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {displayProducts.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No products found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </main>

      <ProductsBuyModal
        open={showBuyModal}
        onOpenChange={setShowBuyModal}
        selectedProduct={selectedProduct}
        flashSalePrice={flashSalePrice}
        productVariations={productVariations}
        selectedVariation={selectedVariation}
        onVariationSelect={setSelectedVariation}
        quantity={quantity}
        onQuantityChange={setQuantity}
        orderNote={orderNote}
        onOrderNoteChange={setOrderNote}
        onConfirmOrder={handleConfirmOrder}
      />

      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        productName={successOrderData.productName}
        totalPrice={successOrderData.totalPrice}
        accessLink={successOrderData.accessLink}
      />

      <BottomNav />
    </div>
  );
};

export default ProductsPage;
