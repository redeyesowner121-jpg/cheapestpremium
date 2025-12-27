import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Store, Star, Package, ArrowLeft, Search, ShoppingBag, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Seller {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  has_blue_check: boolean;
  product_count: number;
}

interface SellerProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  rating: number;
  sold_count: number;
}

const SellersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [userNote, setUserNote] = useState('');

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    setLoading(true);
    
    // Get all users with seller role
    const { data: sellerRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'seller');

    if (rolesError || !sellerRoles?.length) {
      setLoading(false);
      return;
    }

    const sellerIds = sellerRoles.map(r => r.user_id);

    // Get profiles of sellers
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', sellerIds);

    if (profiles) {
      // Get product counts for each seller
      const sellersWithCounts = await Promise.all(
        profiles.map(async (profile) => {
          const { count } = await supabase
            .from('seller_products')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', profile.id)
            .eq('is_active', true);
          
          return {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            has_blue_check: profile.has_blue_check || false,
            product_count: count || 0
          };
        })
      );
      setSellers(sellersWithCounts);
    }
    setLoading(false);
  };

  const loadSellerProducts = async (sellerId: string) => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from('seller_products')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      setSellerProducts(data);
    }
    setLoadingProducts(false);
  };

  const handleSelectSeller = (seller: Seller) => {
    setSelectedSeller(seller);
    loadSellerProducts(seller.id);
  };

  const handleBuyProduct = async () => {
    if (!selectedProduct || !user || !profile || !selectedSeller) {
      toast.error('Please login to purchase');
      return;
    }

    const totalPrice = selectedProduct.price * quantity;
    const platformCommission = totalPrice * 0.10; // 10% platform fee
    const sellerEarnings = totalPrice - platformCommission;

    if ((profile.wallet_balance || 0) < totalPrice) {
      toast.error('Insufficient wallet balance');
      navigate('/wallet');
      return;
    }

    // Deduct from buyer's wallet
    const newBalance = (profile.wallet_balance || 0) - totalPrice;
    await supabase
      .from('profiles')
      .update({ 
        wallet_balance: newBalance,
        total_orders: (profile.total_orders || 0) + 1
      })
      .eq('id', user.id);

    // Credit seller's wallet (90% after 10% commission)
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', selectedSeller.id)
      .single();

    if (sellerProfile) {
      await supabase
        .from('profiles')
        .update({ wallet_balance: (sellerProfile.wallet_balance || 0) + sellerEarnings })
        .eq('id', selectedSeller.id);

      // Create transaction for seller earnings
      await supabase.from('transactions').insert({
        user_id: selectedSeller.id,
        type: 'sale',
        amount: sellerEarnings,
        status: 'completed',
        description: `Sale: ${selectedProduct.name} (10% commission deducted)`
      });

      // Notify seller
      await supabase.from('notifications').insert({
        user_id: selectedSeller.id,
        title: 'New Sale! 💰',
        message: `You sold ${selectedProduct.name} for ₹${totalPrice}. ₹${sellerEarnings.toFixed(2)} credited (10% platform fee deducted).`,
        type: 'sale'
      });
    }

    // Create order
    const { error: orderError } = await supabase.from('orders').insert({
      user_id: user.id,
      product_name: `[Seller: ${selectedSeller.name}] ${selectedProduct.name}`,
      product_image: selectedProduct.image_url,
      unit_price: selectedProduct.price,
      total_price: totalPrice,
      quantity: quantity,
      user_note: userNote,
      status: 'pending'
    });

    if (orderError) {
      toast.error('Failed to place order');
      return;
    }

    // Create transaction for buyer
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'purchase',
      amount: -totalPrice,
      status: 'completed',
      description: `Purchase: ${selectedProduct.name}`
    });

    // Create notification for buyer
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Order Placed',
      message: `Your order for ${selectedProduct.name} has been placed successfully!`,
      type: 'order'
    });

    // Update seller product sold count
    await supabase
      .from('seller_products')
      .update({ sold_count: (selectedProduct.sold_count || 0) + quantity })
      .eq('id', selectedProduct.id);

    toast.success('Order placed successfully!');
    setShowPurchaseModal(false);
    setSelectedProduct(null);
    setQuantity(1);
    setUserNote('');
    await refreshProfile();
    navigate('/orders');
  };

  const filteredSellers = sellers.filter(seller =>
    seller.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Sellers
          </h1>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search sellers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>

        {/* Sellers List */}
        {!selectedSeller ? (
          <div className="space-y-3">
            {filteredSellers.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">No sellers yet</p>
                <p className="text-sm text-muted-foreground">
                  Sellers will appear here when they join
                </p>
              </div>
            ) : (
              filteredSellers.map((seller, index) => (
                <motion.button
                  key={seller.id}
                  onClick={() => handleSelectSeller(seller)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full bg-card rounded-2xl p-4 shadow-card flex items-center gap-4"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                      {seller.avatar_url ? (
                        <img src={seller.avatar_url} alt={seller.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        seller.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {seller.has_blue_check && (
                      <div className="absolute -bottom-1 -right-1">
                        <BlueTick size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-foreground flex items-center gap-1">
                      {seller.name}
                      {seller.has_blue_check && <BlueTick size="sm" />}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {seller.product_count} Products
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              ))
            )}
          </div>
        ) : (
          /* Seller Products View */
          <div>
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => {
                setSelectedSeller(null);
                setSellerProducts([]);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sellers
            </Button>

            <div className="flex items-center gap-4 mb-6 p-4 bg-card rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {selectedSeller.avatar_url ? (
                  <img src={selectedSeller.avatar_url} alt={selectedSeller.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  selectedSeller.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {selectedSeller.name}
                  {selectedSeller.has_blue_check && <BlueTick size="md" />}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedSeller.product_count} Products Available
                </p>
              </div>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sellerProducts.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No products available</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sellerProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-2xl shadow-card overflow-hidden"
                  >
                    <img
                      src={product.image_url || 'https://via.placeholder.com/200'}
                      alt={product.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-3">
                      <h3 className="font-medium text-foreground text-sm truncate">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs text-muted-foreground">
                          {product.rating || 0} • {product.sold_count || 0} sold
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold text-primary">₹{product.price}</span>
                        {product.original_price && (
                          <span className="text-xs text-muted-foreground line-through">
                            ₹{product.original_price}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-2 btn-gradient rounded-xl text-xs"
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowPurchaseModal(true);
                        }}
                      >
                        Buy Now
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Purchase Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedProduct.image_url || 'https://via.placeholder.com/80'}
                  alt={selectedProduct.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-semibold">{selectedProduct.name}</h3>
                  <p className="text-primary font-bold">₹{selectedProduct.price}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Quantity</label>
                <div className="flex items-center gap-3 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <span className="font-bold text-lg">{quantity}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Note (optional)</label>
                <Input
                  placeholder="Add a note..."
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-xl">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-primary">
                  ₹{selectedProduct.price * quantity}
                </span>
              </div>

              <Button className="w-full btn-gradient" onClick={handleBuyProduct}>
                Pay ₹{selectedProduct.price * quantity}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SellersPage;
