import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Filter, Lightbulb, GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import OrderSuccessModal from '@/components/OrderSuccessModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { useProductsData } from './products/useProductsData';
import { Product, ProductVariation } from './products/types';
import ProductCard from './products/ProductCard';
import CategorySection from './products/CategorySection';
import ProductsBuyModal from './products/ProductsBuyModal';

const ProductsPage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const { settings } = useAppSettingsContext();
  const { formatPrice } = useCurrencyFormat();
  const location = useLocation();
  const navigate = useNavigate();
  const flashSale = location.state?.flashSale;

  const {
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    categories, loading,
    filteredProducts, methodsProducts, coursesProducts,
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

  // Handle flash sale click
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
        access_link: flashSale.productData.access_link
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
      .from('product_variations')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true);

    setProductVariations(data || []);
    setShowBuyModal(true);
  };

  const handleConfirmOrder = async () => {
    if (!profile || !user || !selectedProduct) {
      toast.error('Please login to place order');
      return;
    }

    if (!profile.phone) {
      toast.error('Please add your phone number to place an order');
      navigate('/profile/edit');
      return;
    }

    const { data: freshProduct } = await supabase
      .from('products')
      .select('stock')
      .eq('id', selectedProduct.id)
      .single();

    if (freshProduct?.stock !== null && freshProduct?.stock !== undefined && freshProduct.stock < quantity) {
      toast.error(`Only ${freshProduct.stock} items available in stock`);
      return;
    }

    const userRank = getUserRank(profile.rank_balance || 0);
    const isReseller = profile.is_reseller || false;
    const basePrice = selectedVariation?.price || flashSalePrice || selectedProduct.price;

    const { finalPrice } = flashSalePrice
      ? { finalPrice: flashSalePrice }
      : calculateFinalPrice(basePrice, selectedProduct.reseller_price || null, userRank, isReseller);

    const priceToUse = Math.round(finalPrice * 100) / 100;
    const totalPrice = priceToUse * quantity;

    if ((profile.wallet_balance || 0) < totalPrice) {
      toast.error('Insufficient wallet balance. Please add money first.');
      return;
    }

    try {
      const newBalance = (profile.wallet_balance || 0) - totalPrice;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance, total_orders: (profile.total_orders || 0) + 1 })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      const productNameWithVariation = selectedVariation
        ? `${selectedProduct.name} (${selectedVariation.name})`
        : selectedProduct.name;

      const { error: orderError } = await supabase.from('orders').insert({
        user_id: user.id,
        product_id: selectedProduct.id,
        product_name: productNameWithVariation,
        product_image: selectedProduct.image_url,
        quantity,
        unit_price: priceToUse,
        total_price: totalPrice,
        user_note: orderNote || null,
        access_link: selectedProduct.access_link || null,
        status: selectedProduct.access_link ? 'confirmed' : 'pending'
      });

      if (orderError) throw orderError;

      const hasStock = freshProduct?.stock !== null && freshProduct?.stock !== undefined;
      await supabase.rpc('increment_product_sold_count', { product_id: selectedProduct.id, qty: quantity, has_stock: hasStock });

      await supabase.from('transactions').insert({
        user_id: user.id, type: 'purchase', amount: -totalPrice, status: 'completed',
        description: `Purchased ${productNameWithVariation} x${quantity}`
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: selectedProduct.access_link ? 'Order Delivered' : 'Order Placed Successfully',
        message: selectedProduct.access_link
          ? `Your order for ${productNameWithVariation} has been delivered! Check your orders for the access link.`
          : `Your order for ${productNameWithVariation} has been placed.`,
        type: 'order'
      });

      setSuccessOrderData({ productName: productNameWithVariation, totalPrice, accessLink: selectedProduct.access_link || null });
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
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-12 h-12 rounded-xl bg-card border-0 shadow-card"
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2">
            <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Categories */}
        <div className="mb-2 -mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'gradient-primary text-primary-foreground shadow-card'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Methods Section */}
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

        {/* Courses Section */}
        {selectedCategory === 'all' && (
          <CategorySection
            title="Courses"
            icon={GraduationCap}
            iconColorClass="text-indigo-600"
            gradientClass="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30"
            categoryId="courses"
            products={coursesProducts}
            onCategorySelect={setSelectedCategory}
          />
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
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
