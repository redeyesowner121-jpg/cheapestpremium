import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, GraduationCap, Search } from 'lucide-react';
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
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedFlashSale, setSelectedFlashSale] = useState<any>(null);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-request notification permission when user is logged in
    if (user && permission === 'default') {
      setTimeout(async () => {
        await requestPermission();
      }, 1500);
    }
    // Defer recommendations render
    const timer = setTimeout(() => setShowRecommendations(true), 500);
    return () => clearTimeout(timer);
  }, [user, permission]);

  const loadData = async () => {
    try {
      const [bannersRes, flashSalesRes, productsRes, methodsRes, coursesRes, categoriesRes] = await Promise.all([
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
          .select('*, product_variations(*)')
          .eq('is_active', true)
          .limit(8),
        supabase
          .from('products')
          .select('*, product_variations(*)')
          .eq('is_active', true)
          .ilike('category', '%methods%')
          .limit(6),
        supabase
          .from('products')
          .select('*, product_variations(*)')
          .eq('is_active', true)
          .ilike('category', '%courses%')
          .limit(6),
        supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
      ]);

      if (categoriesRes.error) console.error('Categories error:', categoriesRes.error);
      if (categoriesRes.data) setCategories(categoriesRes.data);

      if (bannersRes.error) console.error('Banners error:', bannersRes.error);
      if (bannersRes.data && bannersRes.data.length > 0) {
        setBanners(bannersRes.data.map(b => ({
          id: b.id,
          image: b.image_url,
          title: b.title,
          link: b.link
        })));
      }

      if (flashSalesRes.error) console.error('Flash sales error:', flashSalesRes.error);
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

      if (productsRes.error) console.error('Products error:', productsRes.error);
      if (productsRes.data) {
        setProducts(productsRes.data.map(p => {
          const vars = (p.product_variations || [])
            .filter((v: any) => v.is_active !== false)
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const firstVar = vars[0];
          const displayPrice = firstVar ? firstVar.price : p.price;
          return {
            id: p.id,
            name: p.name,
            price: displayPrice,
            originalPrice: p.original_price,
            image: p.image_url || 'https://via.placeholder.com/200',
            rating: p.rating || 4.5,
            soldCount: p.sold_count || 0,
            reseller_price: p.reseller_price,
            created_at: p.created_at
          };
        }));
      }

      if (methodsRes.error) console.error('Methods error:', methodsRes.error);
      if (methodsRes.data) {
        setMethodsProducts(methodsRes.data.map(p => {
          const vars = (p.product_variations || []).filter((v: any) => v.is_active !== false).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const firstVar = vars[0];
          return {
            id: p.id, name: p.name,
            price: firstVar ? firstVar.price : p.price,
            originalPrice: p.original_price,
            image: p.image_url || 'https://via.placeholder.com/200',
            rating: p.rating || 4.5, soldCount: p.sold_count || 0, reseller_price: p.reseller_price,
            created_at: p.created_at
          };
        }));
      }

      if (coursesRes.error) console.error('Courses error:', coursesRes.error);
      if (coursesRes.data) {
        setCoursesProducts(coursesRes.data.map(p => {
          const vars = (p.product_variations || []).filter((v: any) => v.is_active !== false).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const firstVar = vars[0];
          return {
            id: p.id, name: p.name,
            price: firstVar ? firstVar.price : p.price,
            originalPrice: p.original_price,
            image: p.image_url || 'https://via.placeholder.com/200',
            rating: p.rating || 4.5, soldCount: p.sold_count || 0, reseller_price: p.reseller_price,
            created_at: p.created_at
          };
        }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
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

        {/* Search Bar - right after stats */}
        <div className="-mx-4 px-4 py-1">
          <button
            onClick={() => navigate('/products')}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-600 hover:via-purple-600 hover:to-cyan-600 transition-all active:scale-[0.98] shadow-lg shadow-purple-500/30"
          >
            <Search className="w-5 h-5 text-white" />
            <span className="text-white/90 text-sm font-medium">Search products...</span>
          </button>
        </div>

        <FlashSaleSlider 
          items={flashSales} 
          onItemClick={(item) => {
            setSelectedFlashSale(item);
            setShowFlashSaleModal(true);
          }} 
        />
        
        {/* Personalized Recommendations - deferred */}
        {showRecommendations && <PersonalizedRecommendations />}
        
        <CategoryGrid categories={categories} onCategoryClick={() => navigate('/products')} />
        
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
