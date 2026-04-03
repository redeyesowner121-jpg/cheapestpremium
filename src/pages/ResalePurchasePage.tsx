import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import { PurchaseModal } from '@/components/product';
import OrderSuccessModal from '@/components/OrderSuccessModal';
import { handleProductPurchase } from './product/purchaseHandler';
import { ProductHeader, ProductImage, ProductInfo } from './product/ProductDetailUI';
import { getUserRank } from '@/lib/ranks';

const ResalePurchasePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile, isAdmin, isTempAdmin } = useAuth();
  const { settings } = useAppSettingsContext();
  const { formatPrice } = useCurrencyFormat();

  const [resaleLink, setResaleLink] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [variation, setVariation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<{ productName: string; totalPrice: number; accessLink?: string | null }>({ productName: '', totalPrice: 0 });
  const [userNote, setUserNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  useEffect(() => {
    loadResaleData();
  }, [code]);

  const loadResaleData = async () => {
    if (!code) return;
    setLoading(true);

    const { data: link } = await supabase
      .from('resale_links')
      .select('*')
      .eq('link_code', code)
      .eq('is_active', true)
      .single();

    if (!link) {
      toast.error('Resale link not found or expired');
      navigate('/products');
      return;
    }

    setResaleLink(link);

    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', link.product_id)
      .single();

    if (prod) {
      setProduct(prod);
      setCurrentStock(prod.stock ?? null);
    }

    if (link.variation_id) {
      const { data: v } = await supabase
        .from('product_variations')
        .select('*')
        .eq('id', link.variation_id)
        .single();
      if (v) setVariation(v);
    }

    setLoading(false);
    // Auto-open purchase modal
    setShowPurchaseModal(true);
  };

  const currentPrice = resaleLink?.custom_price || 0;
  const totalPrice = currentPrice * quantity;
  const userRank = getUserRank(profile?.rank_balance || 0);
  const isOutOfStock = currentStock !== null && currentStock <= 0;
  const exceedsStock = currentStock !== null && quantity > currentStock;

  const handleBuy = (donationAmount: number = 0, discount: number = 0, appliedCouponId?: string, guestDetails?: any) => {
    handleProductPurchase(
      {
        user, profile, displayProduct: product, selectedVariation: variation,
        currentPrice, totalPrice, quantity, currentStock, userNote,
        refreshProfile, navigate, setLoading: setPurchaseLoading,
        setCurrentStock, setSuccessOrderData,
        setShowPurchaseModal, setShowSuccessModal,
      },
      donationAmount, discount, appliedCouponId, guestDetails
    );
  };

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <ProductHeader
        onBack={() => navigate('/products')}
        isAdmin={isAdmin} isTempAdmin={isTempAdmin}
        onEdit={() => {}} isFavorite={false}
        onToggleFavorite={() => {}} onShare={() => {}}
      />

      <main className="pt-16 max-w-lg mx-auto">
        <ProductImage
          displayProduct={product}
          currentPrice={currentPrice}
          basePrice={variation?.price || product.price}
          savings={0} discountType="" actualFlashSalePrice={null}
          formatPrice={formatPrice} profile={profile}
        />
        <ProductInfo
          displayProduct={product} currentStock={currentStock}
          isOutOfStock={isOutOfStock}
          variations={variation ? [variation] : []}
          selectedVariation={variation}
          onSelectVariation={() => {}}
          userRank={userRank} isReseller={false}
        />
      </main>

      <div className="fixed bottom-16 left-0 right-0 glass border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setShowPurchaseModal(true)}
            disabled={isOutOfStock}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold text-lg"
          >
            Buy Now - {formatPrice(currentPrice)}
          </button>
        </div>
      </div>

      <PurchaseModal
        open={showPurchaseModal} onOpenChange={setShowPurchaseModal}
        product={product} selectedVariation={variation}
        currentPrice={currentPrice} quantity={quantity}
        onQuantityChange={setQuantity} currentStock={currentStock}
        exceedsStock={exceedsStock} userNote={userNote}
        onUserNoteChange={setUserNote}
        walletBalance={profile?.wallet_balance || 0}
        totalPrice={totalPrice} loading={purchaseLoading}
        onBuy={handleBuy} isLoggedIn={!!user}
      />

      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => { setShowSuccessModal(false); navigate('/orders'); }}
        productName={successOrderData.productName}
        totalPrice={successOrderData.totalPrice}
        accessLink={successOrderData.accessLink}
      />
      <BottomNav />
    </div>
  );
};

export default ResalePurchasePage;
