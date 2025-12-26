import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BannerSlider from '@/components/BannerSlider';
import FlashSaleSlider from '@/components/FlashSaleSlider';
import CategoryGrid from '@/components/CategoryGrid';
import ProductGrid from '@/components/ProductGrid';
import QuickStats from '@/components/QuickStats';
import { useAuth } from '@/contexts/AuthContext';

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userData) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6">
        <BannerSlider />
        <QuickStats />
        <FlashSaleSlider onItemClick={() => navigate('/products')} />
        <CategoryGrid onCategoryClick={() => navigate('/products')} />
        <ProductGrid onBuyClick={() => navigate('/products')} />
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
