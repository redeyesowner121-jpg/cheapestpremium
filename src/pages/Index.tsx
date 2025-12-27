import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BannerSlider from '@/components/BannerSlider';
import FlashSaleSlider from '@/components/FlashSaleSlider';
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

  useEffect(() => {
    loadData();
    
    // Show notification banner if permission not granted
    if (permission === 'default') {
      setTimeout(() => setShowNotificationBanner(true), 2000);
    }
  }, [permission]);

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
        {/* Notification Permission Banner */}
        {showNotificationBanner && permission === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="p-2 bg-primary/20 rounded-xl">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground">Enable Notifications</p>
              <p className="text-xs text-muted-foreground">Get updates on orders, offers & messages</p>
            </div>
            <Button 
              size="sm" 
              className="btn-gradient"
              onClick={async () => {
                await requestPermission();
                setShowNotificationBanner(false);
              }}
            >
              Enable
            </Button>
          </motion.div>
        )}
        
        <BannerSlider banners={banners} />
        <QuickStats />
        <FlashSaleSlider 
          items={flashSales} 
          onItemClick={(item) => navigate('/products', { state: { flashSale: item } })} 
        />
        <CategoryGrid onCategoryClick={() => navigate('/products')} />
        <ProductGrid 
          products={products}
          onProductClick={(product) => navigate('/product', { state: { product } })}
          onBuyClick={(product) => navigate('/product', { state: { product } })} 
        />
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
