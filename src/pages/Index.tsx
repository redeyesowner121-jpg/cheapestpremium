import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BannerSlider from '@/components/BannerSlider';
import FlashSaleSlider from '@/components/FlashSaleSlider';
import FlashSaleDetailModal from '@/components/FlashSaleDetailModal';
import CategoryGrid from '@/components/CategoryGrid';
import ProductGrid from '@/components/ProductGrid';
import QuickStats from '@/components/QuickStats';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading, user } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const [banners, setBanners] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [selectedFlashSale, setSelectedFlashSale] = useState<any>(null);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-request notification permission when user is logged in
    if (user && permission === 'default') {
      // Small delay to avoid blocking initial render
      setTimeout(async () => {
        await requestPermission();
      }, 1500);
    }
  }, [user, permission]);

  const loadData = async () => {
    // Load banners
    const { data: bannersData } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    
    if (bannersData && bannersData.length > 0) {
      setBanners(bannersData.map(b => ({
        id: b.id,
        image: b.image_url,
        title: b.title,
        link: b.link
      })));
    }

    // Load flash sales
    const { data: flashSalesData } = await supabase
      .from('flash_sales')
      .select('*, products(*)')
      .eq('is_active', true)
      .gt('end_time', new Date().toISOString());
    
    if (flashSalesData) {
      setFlashSales(flashSalesData.map(fs => ({
        id: fs.id,
        productId: fs.product_id,
        name: fs.products?.name || 'Product',
        originalPrice: fs.products?.price || 0,
        salePrice: fs.sale_price,
        image: fs.products?.image_url || 'https://via.placeholder.com/200',
        endTime: new Date(fs.end_time).getTime(),
        productData: fs.products
      })));
    }

    // Load products
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .limit(8);
    
    if (productsData) {
      setProducts(productsData.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.original_price,
        image: p.image_url || 'https://via.placeholder.com/200',
        rating: p.rating || 4.5,
        soldCount: p.sold_count || 0
      })));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6">
        <BannerSlider banners={banners} />
        <QuickStats />
        <FlashSaleSlider 
          items={flashSales} 
          onItemClick={(item) => {
            setSelectedFlashSale(item);
            setShowFlashSaleModal(true);
          }} 
        />
        <CategoryGrid onCategoryClick={() => navigate('/products')} />
        <ProductGrid 
          products={products}
          onProductClick={(product) => navigate('/product', { state: { product } })}
          onBuyClick={(product) => navigate('/product', { state: { product } })} 
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

      <BottomNav />
    </div>
  );
};

export default Index;
