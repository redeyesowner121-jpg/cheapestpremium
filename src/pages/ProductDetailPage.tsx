import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import OrderSuccessModal from '@/components/OrderSuccessModal';
import { PurchaseModal } from '@/components/product';
import ResellModal from '@/components/product/ResellModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { handleProductPurchase } from './product/purchaseHandler';
import { ProductHeader, ProductImage, ProductInfo, ProductBottomBar } from './product/ProductDetailUI';

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  reseller_price?: number | null;
  is_active: boolean;
}

const ProductDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: productId } = useParams();
  const { user, profile, refreshProfile, isAdmin, isTempAdmin } = useAuth();
  const { settings } = useAppSettingsContext();
  const { formatPrice } = useCurrencyFormat();
  const stateProduct = location.state?.product;
  const flashSalePrice = location.state?.flashSalePrice;
  const flashSale = location.state?.flashSale;

  const [product, setProduct] = useState<any>(stateProduct || null);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<{ productName: string; totalPrice: number; accessLink?: string | null }>({ productName: '', totalPrice: 0 });
  const [userNote, setUserNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [showResellModal, setShowResellModal] = useState(false);

  useEffect(() => {
    if (!stateProduct && productId) loadProductById(productId);
    else if (stateProduct) {
      setProduct(flashSale?.productData || stateProduct);
      setCurrentStock(stateProduct.stock ?? null);
      loadVariations(stateProduct.id);
    }
  }, [productId, stateProduct]);

  const loadProductById = async (id: string) => {
    setLoadingProduct(true);
    const productColumns = 'id,name,price,original_price,image_url,category,description,rating,sold_count,stock,is_active,created_at,updated_at,reseller_price,seo_tags,slug';
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const slugLower = id.toLowerCase();
    const query = isUUID
      ? supabase.from('products').select(productColumns).eq('id', id).single()
      : supabase.from('products').select(productColumns).ilike('slug', slugLower).single();
    const { data, error } = await query;
    if (error || !data) { toast.error('Product not found'); navigate('/products'); return; }
    setProduct(data);
    setCurrentStock(data.stock ?? null);
    loadVariations(data.id);
    // Replace UUID in URL with slug for clean sharing links
    if (isUUID && data.slug && id !== data.slug) {
      window.history.replaceState(null, '', `/product/${data.slug}`);
    }
    setLoadingProduct(false);
  };

  const loadVariations = async (id: string) => {
    const { data } = await supabase.from('product_variations').select('*').eq('product_id', id).eq('is_active', true).order('created_at', { ascending: true });
    if (data && data.length > 0) {
      setVariations(data);
      if (!selectedVariation) setSelectedVariation(data[0]);
    } else if (data) setVariations(data);
  };

  // Compute stock dynamically based on delivery mode
  useEffect(() => {
    const computeStock = async () => {
      if (!product) return;
      
      const variation = selectedVariation;
      const varDeliveryMode = (variation as any)?.delivery_mode;
      const productDeliveryMode = (product as any)?.delivery_mode;
      
      // If variation has unique delivery mode, count its unused stock items
      if (variation && varDeliveryMode === 'unique') {
        const { count } = await (supabase as any)
          .from('product_stock_items')
          .select('*', { count: 'exact', head: true })
          .eq('variation_id', variation.id)
          .eq('is_used', false);
        setCurrentStock(count ?? 0);
        return;
      }
      
      // If product has unique delivery mode (no variation-level), count product-level stock
      if (productDeliveryMode === 'unique' && (!variation || varDeliveryMode !== 'unique')) {
        const { count } = await (supabase as any)
          .from('product_stock_items')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .is('variation_id', null)
          .eq('is_used', false);
        setCurrentStock(count ?? 0);
        return;
      }
      
      // For repeated/manual delivery: use admin-set stock or null (infinity)
      setCurrentStock(product.stock ?? null);
    };
    
    computeStock();
  }, [product, selectedVariation]);

  const displayProduct = flashSale?.productData || product;
  const isOutOfStock = currentStock !== null && currentStock <= 0;
  const exceedsStock = currentStock !== null && quantity > currentStock;
  const userRank = getUserRank(profile?.rank_balance || 0);
  const isReseller = profile?.is_reseller || false;
  const actualFlashSalePrice = flashSalePrice || flashSale?.salePrice;
  const basePrice = selectedVariation?.price || displayProduct?.price || 0;
  const applicableResellerPrice = selectedVariation ? (selectedVariation?.reseller_price || null) : (displayProduct?.reseller_price || null);
  const { finalPrice: rankDiscountedPrice, savings, discountType } = calculateFinalPrice(actualFlashSalePrice || basePrice, actualFlashSalePrice ? null : applicableResellerPrice, userRank, isReseller);
  const currentPrice = actualFlashSalePrice || rankDiscountedPrice;
  const totalPrice = currentPrice * quantity;

  const handleBack = () => { window.history.length > 1 ? navigate(-1) : navigate('/products'); };

  const handleShare = async () => {
    const productSlug = displayProduct?.slug || displayProduct?.id;
    const productUrl = `${settings.app_url}/product/${productSlug}`;
    const shareText = `Check out ${displayProduct?.name} at ${settings.app_name}! Only ${formatPrice(currentPrice)}`;
    if (navigator.share) {
      try { await navigator.share({ title: displayProduct?.name, text: shareText, url: productUrl }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(`${shareText}\n${productUrl}`); toast.success('Link copied to clipboard!'); } catch { toast.error('Failed to share'); }
  };

  const handleBuy = (donationAmount: number = 0, discount: number = 0, appliedCouponId?: string, guestDetails?: { name: string; email: string; phone: string }) => {
    handleProductPurchase(
      { user, profile, displayProduct, selectedVariation, currentPrice, totalPrice, quantity, currentStock, userNote, refreshProfile, navigate, setLoading, setCurrentStock, setSuccessOrderData, setShowPurchaseModal, setShowSuccessModal },
      donationAmount, discount, appliedCouponId, guestDetails
    );
  };

  if (!displayProduct || loadingProduct) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEOHead
        title={`${displayProduct.name} - Buy at ₹${Math.round(currentPrice)}`}
        description={displayProduct.description || `Buy ${displayProduct.name} at the cheapest price. Instant delivery, 100% genuine. Only ₹${Math.round(currentPrice)} at Cheapest Premiums.`}
        canonicalPath={`/product/${displayProduct.slug || displayProduct.id}`}
        ogImage={displayProduct.image_url || undefined}
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": displayProduct.name,
          "description": displayProduct.description || `Buy ${displayProduct.name} at cheapest price`,
          "image": displayProduct.image_url,
          "url": `https://cheapest-premiums.in/product/${displayProduct.slug || displayProduct.id}`,
          "offers": {
            "@type": "Offer",
            "price": Math.round(currentPrice),
            "priceCurrency": "INR",
            "availability": isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            "seller": { "@type": "Organization", "name": "Cheapest Premiums" }
          },
          ...(displayProduct.rating ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": displayProduct.rating, "bestRating": 5, "ratingCount": displayProduct.sold_count || 1 } } : {})
        }}
      />
      <ProductHeader onBack={handleBack} isAdmin={isAdmin} isTempAdmin={isTempAdmin} onEdit={() => navigate('/admin', { state: { editProduct: displayProduct } })} isFavorite={isFavorite} onToggleFavorite={() => setIsFavorite(!isFavorite)} onShare={handleShare} />

      <main className="pt-16 max-w-lg mx-auto">
        <ProductImage displayProduct={displayProduct} currentPrice={currentPrice} basePrice={basePrice} savings={savings} discountType={discountType} actualFlashSalePrice={actualFlashSalePrice} formatPrice={formatPrice} profile={profile} />
        <ProductInfo displayProduct={displayProduct} currentStock={currentStock} isOutOfStock={isOutOfStock} variations={variations} selectedVariation={selectedVariation} onSelectVariation={setSelectedVariation} userRank={userRank} isReseller={isReseller} />
      </main>

      <ProductBottomBar displayProduct={displayProduct} currentPrice={currentPrice} formatPrice={formatPrice} settings={settings} selectedVariation={selectedVariation} isOutOfStock={isOutOfStock} isReseller={isReseller} onResell={() => setShowResellModal(true)} />

      <PurchaseModal open={showPurchaseModal} onOpenChange={setShowPurchaseModal} product={displayProduct} selectedVariation={selectedVariation} currentPrice={currentPrice} quantity={quantity} onQuantityChange={setQuantity} currentStock={currentStock} exceedsStock={exceedsStock} userNote={userNote} onUserNoteChange={setUserNote} walletBalance={profile?.wallet_balance || 0} totalPrice={totalPrice} loading={loading} onBuy={handleBuy} flashSaleId={flashSale?.id} isLoggedIn={!!user} />

      {isReseller && user && (
        <ResellModal open={showResellModal} onOpenChange={setShowResellModal} product={displayProduct} selectedVariation={selectedVariation} resellerPrice={applicableResellerPrice || basePrice} userId={user.id} />
      )}

      <OrderSuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} productName={successOrderData.productName} totalPrice={successOrderData.totalPrice} accessLink={successOrderData.accessLink} />
      <BottomNav />
    </div>
  );
};

export default ProductDetailPage;
