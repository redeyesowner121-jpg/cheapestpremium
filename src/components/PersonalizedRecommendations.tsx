import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Star, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  image_url: string;
  rating: number;
  sold_count: number;
  category: string;
  reseller_price?: number;
}

const PersonalizedRecommendations: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionTitle, setSectionTitle] = useState('Popular Products');

  useEffect(() => {
    if (user) {
      loadRecommendations();
    } else {
      loadPopularProducts();
    }
  }, [user]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      // Get user's order history to find their preferred categories
      const { data: orders } = await supabase
        .from('orders')
        .select('product_id, products!inner(category)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (orders && orders.length > 0) {
        // Extract categories from orders
        const purchasedProductIds = orders.map(o => o.product_id).filter(Boolean);
        const categories = [...new Set(orders.map((o: any) => o.products?.category).filter(Boolean))];

        if (categories.length > 0) {
          // Find products in same categories that user hasn't purchased
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .in('category', categories)
            .not('id', 'in', `(${purchasedProductIds.join(',')})`)
            .order('sold_count', { ascending: false })
            .limit(8);

          if (products && products.length > 0) {
            setRecommendations(products);
            setSectionTitle('Based on Your Purchases');
            setLoading(false);
            return;
          }
        }
      }

      // Fallback to popular products
      await loadPopularProducts();
    } catch (error) {
      console.error('Error loading recommendations:', error);
      await loadPopularProducts();
    }
  };

  const loadPopularProducts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sold_count', { ascending: false })
        .limit(8);

      if (data) {
        setRecommendations(data);
        setSectionTitle(user ? 'Trending Now' : 'Popular Products');
      }
    } catch (error) {
      console.error('Error loading popular products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    const productForDetail = {
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.original_price,
      image: product.image_url,
      image_url: product.image_url,
      rating: product.rating || 4.5,
      soldCount: product.sold_count || 0,
      sold_count: product.sold_count || 0,
      reseller_price: product.reseller_price
    };
    navigate(`/product/${product.slug || product.id}`, { state: { product: productForDetail } });
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-4 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-shrink-0 w-36 h-40 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 bg-gradient-to-r from-primary/5 to-accent/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{sectionTitle}</h2>
            {user && profile?.name && sectionTitle === 'Based on Your Purchases' && (
              <p className="text-xs text-muted-foreground">
                Hey {profile.name.split(' ')[0]}, you might like these
              </p>
            )}
          </div>
        </div>
        <button 
          onClick={() => navigate('/products')}
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {recommendations.map((product) => (
          <div
            key={product.id}
            onClick={() => handleProductClick(product)}
            className="flex-shrink-0 w-36 bg-card rounded-xl overflow-hidden shadow-card active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="relative">
              <img 
                src={product.image_url || 'https://via.placeholder.com/200'} 
                alt={product.name} 
                className="w-full h-20 object-cover" 
                loading="lazy" 
              />
              {product.original_price && product.original_price > product.price && (
                <div className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  {Math.round(((product.original_price - product.price) / product.original_price) * 100)}% OFF
                </div>
              )}
            </div>
            <div className="p-2">
              <h4 className="font-medium text-xs text-foreground truncate">{product.name}</h4>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                <span className="text-[10px] text-muted-foreground">{product.rating || 4.5}</span>
                <span className="text-[10px] text-muted-foreground">• {product.sold_count || 0} sold</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-primary font-bold text-sm">₹{product.price}</span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-[10px] text-muted-foreground line-through">₹{product.original_price}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

PersonalizedRecommendations.displayName = 'PersonalizedRecommendations';

export default PersonalizedRecommendations;
