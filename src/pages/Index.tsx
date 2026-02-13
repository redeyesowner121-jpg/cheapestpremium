import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, GraduationCap } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BannerSlider from '@/components/BannerSlider';
import FlashSaleSlider from '@/components/FlashSaleSlider';
import FlashSaleDetailModal from '@/components/FlashSaleDetailModal';
import CategoryGrid from '@/components/CategoryGrid';
import ProductGrid from '@/components/ProductGrid';
import CategorySection from '@/components/CategorySection';
import QuickStats from '@/components/QuickStats';
import DailyBonusBanner from '@/components/DailyBonusBanner';
import OnboardingTour from '@/components/OnboardingTour';
import PersonalizedRecommendations from '@/components/PersonalizedRecommendations';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading, user } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const [banners, setBanners] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [methodsProducts, setMethodsProducts] = useState<any[]>([]);
  const [coursesProducts, setCoursesProducts] = useState<any[]>([]);
  const [selectedFlashSale, setSelectedFlashSale] = useState<any>(null);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-request notification permission when user is logged in
    if (user && permission === 'default') {
      setTimeout(async () => {
        await requestPermission();
      }, 1500);
    }
  }, [user, permission]);

  const loadData = async () => {
    // Load all data in parallel
    const [bannersRes, flashSalesRes, productsRes, methodsRes, coursesRes] = await Promise.all([
      supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('flash_sales')
        .select('*, products(*)')
        .eq('is_active', true)
        .gt('end_time', new Date().toISOString()),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .limit(8),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .ilike('category', '%methods%')
        .limit(6),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .ilike('category', '%courses%')
        .limit(6)
    ]);

    if (bannersRes.data && bannersRes.data.length > 0) {
      setBanners(bannersRes.data.map(b => ({
        id: b.id,
        image: b.image_url,
        title: b.title,
        link: b.link
      })));
    }

    if (flashSalesRes.data) {
      setFlashSales(flashSalesRes.data.map(fs => ({
        id: fs.id,
        productId: fs.product_id,
        name: fs.products?.name || 'Product',
        originalPrice: fs.products?.price || 0,
        salePrice: fs.sale_price,
        image: fs.products?.image_url || 'https://via.placeholder.com/200',
        endTime: new Date(fs.end_time).getTime(),
        productData: fs.products,
        variationName: (fs as any).variation_name || null,
      })));
    }

    if (productsRes.data) {
      setProducts(productsRes.data.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.original_price,
        image: p.image_url || 'https://via.placeholder.com/200',
        rating: p.rating || 4.5,
        soldCount: p.sold_count || 0,
        reseller_price: p.reseller_price
      })));
    }

    if (methodsRes.data) {
      setMethodsProducts(methodsRes.data.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.original_price,
        image: p.image_url || 'https://via.placeholder.com/200',
        rating: p.rating || 4.5,
        soldCount: p.sold_count || 0,
        reseller_price: p.reseller_price
      })));
    }

    if (coursesRes.data) {
      setCoursesProducts(coursesRes.data.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.original_price,
        image: p.image_url || 'https://via.placeholder.com/200',
        rating: p.rating || 4.5,
        soldCount: p.sold_count || 0,
        reseller_price: p.reseller_price
      })));
    }
  };

  const handleProductClick = (product: any) => {
    // Ensure consistent product format for detail page
    const productForDetail = {
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      image_url: product.image,
      rating: product.rating || 4.5,
      soldCount: product.soldCount || 0,
      sold_count: product.soldCount || 0,
      reseller_price: product.reseller_price
    };
    navigate(`/product/${product.id}`, { state: { product: productForDetail } });
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
      
      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6">
        {/* Daily Bonus Banner - shows until claimed */}
        {user && <DailyBonusBanner />}
        
        <BannerSlider banners={banners} />
        {user && <QuickStats />}
        <FlashSaleSlider 
          items={flashSales} 
          onItemClick={(item) => {
            setSelectedFlashSale(item);
            setShowFlashSaleModal(true);
          }} 
        />
        
        {/* Personalized Recommendations */}
        <PersonalizedRecommendations />
        
        <CategoryGrid onCategoryClick={() => navigate('/products')} />
        
        {/* Methods Section */}
        <CategorySection
          title="Methods"
          icon={<Lightbulb className="w-5 h-5" />}
          products={methodsProducts}
          onProductClick={handleProductClick}
          onViewAll={() => navigate('/products', { state: { category: 'Methods' } })}
          bgColor="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
          accentColor="text-orange-600"
        />
        
        {/* Courses Section */}
        <CategorySection
          title="Courses"
          icon={<GraduationCap className="w-5 h-5" />}
          products={coursesProducts}
          onProductClick={handleProductClick}
          onViewAll={() => navigate('/products', { state: { category: 'Courses' } })}
          bgColor="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30"
          accentColor="text-indigo-600"
        />
        
        <ProductGrid 
          products={products}
          onProductClick={handleProductClick}
          onBuyClick={handleProductClick} 
        />
      </main>

      {/* Flash Sale Detail Modal with Countdown */}
      <FlashSaleDetailModal
        open={showFlashSaleModal}
        onOpenChange={setShowFlashSaleModal}
        item={selectedFlashSale}
        onBuyClick={(item) => {
          setShowFlashSaleModal(false);
          navigate('/product', { 
            state: { 
              product: item.productData,
              flashSalePrice: item.salePrice 
            } 
          });
        }}
      />

      {/* Onboarding Tour for New Users */}
      <OnboardingTour />

      <BottomNav />
    </div>
  );
};

export default Index;
