import React, { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Search, X } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BannerSlider from '@/components/BannerSlider';
import CategoryGrid from '@/components/CategoryGrid';
import ProductGrid from '@/components/ProductGrid';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';

// Lazy load non-critical sections
const FlashSaleSlider = lazy(() => import('@/components/FlashSaleSlider'));
const FlashSaleDetailModal = lazy(() => import('@/components/FlashSaleDetailModal'));
const CategorySection = lazy(() => import('@/components/CategorySection'));
const QuickStats = lazy(() => import('@/components/QuickStats'));
const DailyBonusBanner = lazy(() => import('@/components/DailyBonusBanner'));
const OnboardingTour = lazy(() => import('@/components/OnboardingTour'));
const PersonalizedRecommendations = lazy(() => import('@/components/PersonalizedRecommendations'));

const LazyFallback = () => null;

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading, user } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const [banners, setBanners] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [methodsProducts, setMethodsProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedFlashSale, setSelectedFlashSale] = useState<any>(null);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
  const [deferredReady, setDeferredReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataLoadedRef = useRef(false);

  // Load data once
  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      loadData();
    }
    
    if (user && permission === 'default') {
      const t = setTimeout(() => requestPermission(), 2000);
      return () => clearTimeout(t);
    }
  }, [user, permission]);

  // Defer heavy sections
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setTimeout(() => setDeferredReady(true), 100);
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Prefetch critical pages only, after idle
  useEffect(() => {
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          import('@/pages/ProductsPage').catch(() => {});
          setTimeout(() => import('@/pages/ProductDetailPage').catch(() => {}), 500);
        });
      } else {
        import('@/pages/ProductsPage').catch(() => {});
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (!homeSearchQuery.trim() || homeSearchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const query = homeSearchQuery.trim().toLowerCase();
        
        // Step 1: Normal exact/partial match first
        const { data: exactData } = await supabase
          .from('products')
          .select('id, name, price, image_url, original_price, reseller_price, sold_count, rating, slug')
          .eq('is_active', true)
          .or(`name.ilike.%${query}%,seo_tags.ilike.%${query}%`)
          .limit(8);

        const mapResults = (items: any[]) => items.map(p => ({
          id: p.id, name: p.name, price: p.price, slug: p.slug,
          image: p.image_url || 'https://via.placeholder.com/200',
          originalPrice: p.original_price, reseller_price: p.reseller_price,
          soldCount: p.sold_count || 0, rating: p.rating || 4.5,
        }));

        if (exactData && exactData.length > 0) {
          setSearchResults(mapResults(exactData));
        } else {
          // Step 2: Only use smart-search (fuzzy/AI) when no exact matches
          const { data, error } = await supabase.functions.invoke('smart-search', {
            body: { query: homeSearchQuery.trim() },
          });
          if (!error && data?.products?.length) {
            setSearchResults(data.products.map((p: any) => ({
              id: p.id, name: p.name, price: p.price, slug: p.slug,
              image: p.image_url || 'https://via.placeholder.com/200',
              originalPrice: p.original_price, reseller_price: p.reseller_price,
              soldCount: p.sold_count || 0, rating: p.rating || 4.5,
            })));
          } else {
            setSearchResults([]);
          }
        }
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 400);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [homeSearchQuery]);

  const mapProduct = useCallback((p: any) => {
    const vars = (p.product_variations || [])
      .filter((v: any) => v.is_active !== false)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const firstVar = vars[0];
    return {
      id: p.id, name: p.name,
      price: firstVar ? firstVar.price : p.price,
      originalPrice: p.original_price,
      image: p.image_url || 'https://via.placeholder.com/200',
      rating: p.rating || 4.5, soldCount: p.sold_count || 0,
      reseller_price: p.reseller_price, created_at: p.created_at
    };
  }, []);

  const loadData = async () => {
    try {
      const [bannersRes, flashSalesRes, productsRes, methodsRes, categoriesRes] = await Promise.all([
        supabase.from('banners').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('flash_sales').select('*, products(*)').eq('is_active', true).gt('end_time', new Date().toISOString()),
        supabase.from('products').select('*, product_variations(*)').eq('is_active', true).limit(8),
        supabase.from('products').select('*, product_variations(*)').eq('is_active', true).ilike('category', '%methods%').limit(6),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (bannersRes.data?.length) {
        setBanners(bannersRes.data.map(b => ({ id: b.id, image: b.image_url, title: b.title, link: b.link })));
      }
      if (flashSalesRes.data) {
        setFlashSales(flashSalesRes.data.map(fs => ({
          id: fs.id, productId: fs.product_id,
          name: fs.products?.name || 'Product',
          originalPrice: fs.products?.price || 0,
          salePrice: fs.sale_price,
          image: fs.products?.image_url || 'https://via.placeholder.com/200',
          endTime: new Date(fs.end_time).getTime(),
          productData: fs.products,
          variationName: (fs as any).variation_name || null,
        })));
      }
      if (productsRes.data) setProducts(productsRes.data.map(mapProduct));
      if (methodsRes.data) setMethodsProducts(methodsRes.data.map(mapProduct));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

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
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "Are these premium accounts genuine?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, 100% genuine accounts purchased from official sources. We provide instant delivery with replacement warranty." } },
              { "@type": "Question", "name": "How fast is the delivery?", "acceptedAnswer": { "@type": "Answer", "text": "Instant delivery — credentials are sent within seconds of payment confirmation via website and Telegram bot." } },
              { "@type": "Question", "name": "What payment methods are accepted?", "acceptedAnswer": { "@type": "Answer", "text": "We accept UPI, Razorpay, Binance Pay, and wallet balance for fast and secure checkout." } },
              { "@type": "Question", "name": "Do you offer warranty?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — all premium subscriptions come with a replacement warranty for the validity period mentioned." } },
              { "@type": "Question", "name": "Why is Cheapest Premiums the best?", "acceptedAnswer": { "@type": "Answer", "text": "We offer the lowest prices in India (up to 90% off), instant delivery, genuine accounts, and 24/7 support." } }
            ]
          }
        ]}
      />
      {/* Decorative background orbs - use CSS only */}
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

        {/* Search Bar */}
        <div className="-mx-4 px-4 py-1">
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                value={homeSearchQuery}
                onChange={(e) => setHomeSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && homeSearchQuery.trim()) {
                    navigate('/products', { state: { searchQuery: homeSearchQuery.trim() } });
                  }
                }}
                placeholder="Search products..."
                className="w-full pl-12 pr-12 py-3.5 rounded-2xl gradient-primary text-white placeholder-white/60 text-sm font-medium outline-none shadow-colored-primary"
              />
              <button onClick={() => { setSearchOpen(false); setHomeSearchQuery(''); }} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
              className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl gradient-primary hover:opacity-95 transition-all active:scale-[0.98] shadow-colored-primary"
            >
              <Search className="w-5 h-5 text-white" />
              <span className="text-white/90 text-sm font-medium">Search products...</span>
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchOpen && homeSearchQuery.trim().length >= 2 && (
          <div className="space-y-2">
            {searchLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(product => (
                <button key={product.id} onClick={() => handleProductClick(product)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow text-left">
                  <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-primary font-semibold">₹{product.price}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No products found</p>
            )}
          </div>
        )}

        {user && (
          <Suspense fallback={<div className="h-48 rounded-2xl bg-muted animate-pulse" />}>
            <QuickStats />
          </Suspense>
        )}

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
