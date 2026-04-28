import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BannerSlider from '@/components/BannerSlider';
import CategoryGrid from '@/components/CategoryGrid';
import ProductGrid from '@/components/ProductGrid';
import QuickStats from '@/components/QuickStats';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useHomeData } from './home/useHomeData';
import HomeSearchBar from './home/HomeSearchBar';
import { homeFaqJsonLd } from './home/homeJsonLd';

// Lazy load non-critical sections
const FlashSaleSlider = lazy(() => import('@/components/FlashSaleSlider'));
const FlashSaleDetailModal = lazy(() => import('@/components/FlashSaleDetailModal'));
const CategorySection = lazy(() => import('@/components/CategorySection'));
const DailyBonusBanner = lazy(() => import('@/components/DailyBonusBanner'));
const OnboardingTour = lazy(() => import('@/components/OnboardingTour'));
const PersonalizedRecommendations = lazy(() => import('@/components/PersonalizedRecommendations'));

const LazyFallback = () => null;

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const { banners, flashSales, products, methodsProducts, categories } = useHomeData();

  const [selectedFlashSale, setSelectedFlashSale] = useState<any>(null);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
  const [deferredReady, setDeferredReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');

  useEffect(() => {
    if (user && permission === 'default') {
      const t = setTimeout(() => requestPermission(), 2000);
      return () => clearTimeout(t);
    }
  }, [user, permission]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setTimeout(() => setDeferredReady(true), 100));
    return () => cancelAnimationFrame(t);
  }, []);

  // Prefetch ProductDetail after long idle
  useEffect(() => {
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          import('@/pages/ProductDetailPage').catch(() => {});
        }, { timeout: 8000 });
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleProductClick = useCallback((product: any) => {
    navigate(`/product/${product.slug || product.id}`, {
      state: {
        product: {
          id: product.id, name: product.name, price: product.price,
          originalPrice: product.originalPrice, image: product.image,
          image_url: product.image, rating: product.rating || 4.5,
          soldCount: product.soldCount || 0, sold_count: product.soldCount || 0,
          reseller_price: product.reseller_price
        }
      }
    });
  }, [navigate]);

  const handleFlashSaleClick = useCallback((item: any) => {
    setSelectedFlashSale(item);
    setShowFlashSaleModal(true);
  }, []);

  const handleFlashSaleBuy = useCallback((item: any) => {
    setShowFlashSaleModal(false);
    navigate('/product', { state: { product: item.productData, flashSalePrice: item.salePrice } });
  }, [navigate]);

  const handleCategoryClick = useCallback(() => navigate('/products'), [navigate]);
  const handleMethodsViewAll = useCallback(() => navigate('/products', { state: { category: 'Methods' } }), [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden bg-page-gradient">
      <SEOHead
        canonicalPath="/"
        description="Buy cheapest premium subscriptions in India — Netflix, Spotify, YouTube Premium, Canva Pro, ChatGPT Plus & more at lowest prices. Instant delivery, 100% genuine accounts. Save up to 90%."
        keywords="cheap netflix india, buy spotify premium cheap, youtube premium cheap, canva pro cheap, chatgpt plus india, cheapest premium subscription, ott cheap india, premium accounts wholesale"
        jsonLd={homeFaqJsonLd}
      />
      <div className="fixed top-20 -left-32 w-64 h-64 rounded-full bg-primary/8 blur-3xl pointer-events-none will-change-transform" />
      <div className="fixed top-1/3 -right-32 w-72 h-72 rounded-full bg-secondary/8 blur-3xl pointer-events-none will-change-transform" />
      
      <Header />
      
      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6 relative z-10">
        {user && (
          <Suspense fallback={<LazyFallback />}>
            <DailyBonusBanner />
          </Suspense>
        )}
        
        <BannerSlider banners={banners} />

        <HomeSearchBar
          open={searchOpen}
          setOpen={setSearchOpen}
          query={homeSearchQuery}
          setQuery={setHomeSearchQuery}
          onProductClick={handleProductClick}
        />

        {user && <QuickStats />}

        {deferredReady && (
          <Suspense fallback={<LazyFallback />}>
            <FlashSaleSlider items={flashSales} onItemClick={handleFlashSaleClick} />
          </Suspense>
        )}
        
        {deferredReady && (
          <Suspense fallback={<LazyFallback />}>
            <PersonalizedRecommendations />
          </Suspense>
        )}
        
        <CategoryGrid categories={categories} onCategoryClick={handleCategoryClick} />
        
        {deferredReady && methodsProducts.length > 0 && (
          <Suspense fallback={<LazyFallback />}>
            <CategorySection
              title="Methods"
              icon={<Lightbulb className="w-5 h-5" />}
              products={methodsProducts}
              onProductClick={handleProductClick}
              onViewAll={handleMethodsViewAll}
              bgColor="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
              accentColor="text-orange-600"
            />
          </Suspense>
        )}
        
        <ProductGrid products={products} onProductClick={handleProductClick} onBuyClick={handleProductClick} />
      </main>

      {showFlashSaleModal && (
        <Suspense fallback={<LazyFallback />}>
          <FlashSaleDetailModal
            open={showFlashSaleModal}
            onOpenChange={setShowFlashSaleModal}
            item={selectedFlashSale}
            onBuyClick={handleFlashSaleBuy}
          />
        </Suspense>
      )}

      <Suspense fallback={<LazyFallback />}>
        <OnboardingTour />
      </Suspense>

      <BottomNav />
    </div>
  );
};

export default Index;
