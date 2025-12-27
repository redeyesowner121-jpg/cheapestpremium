import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Store, 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  DollarSign, 
  ShoppingBag,
  ArrowLeft,
  Camera,
  Save,
  X,
  Image,
  ClipboardList,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  Send,
  TrendingUp,
  Percent
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  access_link: string | null;
  is_active: boolean;
  sold_count: number;
  created_at: string;
}

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

interface SellerOrder {
  id: string;
  product_name: string;
  product_image: string | null;
  total_price: number;
  unit_price: number;
  quantity: number;
  status: string;
  created_at: string;
  user_id: string;
  user_note: string | null;
  admin_note: string | null;
  access_link: string | null;
  buyer_name?: string;
  buyer_email?: string;
  buyer_confirmed?: boolean;
  is_withdrawable?: boolean;
}

const categories = ['OTT', 'Gaming', 'Education', 'Software', 'Social Media', 'Music', 'Cloud', 'Other'];
const PLATFORM_COMMISSION = 0.10; // 10% commission

const SellerPanelPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [selectedProductForVariations, setSelectedProductForVariations] = useState<SellerProduct | null>(null);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [activeTab, setActiveTab] = useState('products');
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [deliveryLink, setDeliveryLink] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveringOrder, setDeliveringOrder] = useState(false);

  // Product form
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: 'OTT',
    price: '',
    original_price: '',
    image_url: '',
    access_link: '',
    stock: '',
    is_active: true
  });

  // New variation form
  const [newVariation, setNewVariation] = useState({ name: '', price: '' });

  // Profile form
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSold: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    totalEarnings: 0,
    platformFees: 0
  });

  useEffect(() => {
    if (user) {
      loadProducts();
      loadStats();
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);

    // Get orders directly by seller_id first, then fallback to product name matching
    const { data: directOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    let allOrders = directOrders || [];

    // Also get orders by product name matching for backward compatibility
    const { data: sellerProducts } = await supabase
      .from('seller_products')
      .select('id, name')
      .eq('seller_id', user.id);

    if (sellerProducts && sellerProducts.length > 0) {
      const productNames = sellerProducts.map(p => `[Seller: ${profile?.name}] ${p.name}`);
      
      const { data: nameMatchedOrders } = await supabase
        .from('orders')
        .select('*')
        .in('product_name', productNames)
        .order('created_at', { ascending: false });

      if (nameMatchedOrders) {
        // Merge and deduplicate
        const existingIds = new Set(allOrders.map(o => o.id));
        const newOrders = nameMatchedOrders.filter(o => !existingIds.has(o.id));
        allOrders = [...allOrders, ...newOrders];
      }
    }

    if (allOrders.length > 0) {
      // Fetch buyer profiles
      const userIds = [...new Set(allOrders.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const ordersWithBuyers = allOrders.map(order => ({
        ...order,
        buyer_name: profiles?.find(p => p.id === order.user_id)?.name || 'Unknown',
        buyer_email: profiles?.find(p => p.id === order.user_id)?.email || ''
      }));

      // Sort by created_at
      ordersWithBuyers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(ordersWithBuyers);
    } else {
      setOrders([]);
    }
    setOrdersLoading(false);
  };

  const loadProducts = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('seller_products')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    if (!user) return;

    const { data: productsData } = await supabase
      .from('seller_products')
      .select('sold_count, price')
      .eq('seller_id', user.id);

    // Get completed orders for accurate earnings
    const { data: sellerProducts } = await supabase
      .from('seller_products')
      .select('name')
      .eq('seller_id', user.id);

    let pendingOrders = 0;
    let totalEarnings = 0;
    let platformFees = 0;

    if (sellerProducts && sellerProducts.length > 0) {
      const productNames = sellerProducts.map(p => p.name);
      
      const { data: ordersData } = await supabase
        .from('orders')
        .select('total_price, status')
        .in('product_name', productNames);

      if (ordersData) {
        pendingOrders = ordersData.filter(o => o.status === 'pending').length;
        const completedOrders = ordersData.filter(o => o.status === 'completed');
        const totalCompletedRevenue = completedOrders.reduce((sum, o) => sum + o.total_price, 0);
        platformFees = totalCompletedRevenue * PLATFORM_COMMISSION;
        totalEarnings = totalCompletedRevenue - platformFees;
      }
    }

    if (productsData) {
      const totalSold = productsData.reduce((sum, p) => sum + (p.sold_count || 0), 0);
      const totalRevenue = productsData.reduce((sum, p) => sum + ((p.sold_count || 0) * p.price), 0);
      setStats({
        totalProducts: productsData.length,
        totalSold,
        totalRevenue,
        pendingOrders,
        totalEarnings,
        platformFees
      });
    }
  };

  const handleDeliverOrder = async () => {
    if (!selectedOrder || !user) return;
    
    if (!deliveryLink.trim()) {
      toast.error('Please provide an access link');
      return;
    }

    setDeliveringOrder(true);

    try {
      // Update order status and add access link
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          access_link: deliveryLink,
          admin_note: deliveryNote || 'Delivered by seller'
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      // Add to order history
      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: 'completed',
        note: deliveryNote || 'Order delivered by seller',
        created_by: user.id
      });

      // Create notification for buyer
      await supabase.from('notifications').insert({
        user_id: selectedOrder.user_id,
        title: 'Order Delivered!',
        message: `Your order for ${selectedOrder.product_name} has been delivered. Check your order for access details.`,
        type: 'order'
      });

      toast.success('Order delivered successfully!');
      setShowDeliverModal(false);
      setSelectedOrder(null);
      setDeliveryLink('');
      setDeliveryNote('');
      loadOrders();
      loadStats();
    } catch (error) {
      console.error('Delivery error:', error);
      toast.error('Failed to deliver order');
    } finally {
      setDeliveringOrder(false);
    }
  };

  const handleAddProduct = async () => {
    if (!user) return;
    if (!productForm.name || !productForm.price) {
      toast.error('Please fill required fields');
      return;
    }

    const productData = {
      seller_id: user.id,
      name: productForm.name,
      description: productForm.description || null,
      category: productForm.category,
      price: parseFloat(productForm.price),
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      image_url: productForm.image_url || null,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      is_active: productForm.is_active
    };

    const { error } = await supabase
      .from('seller_products')
      .insert(productData);

    if (error) {
      toast.error('Failed to add product');
      return;
    }

    toast.success('Product added successfully');
    setShowProductModal(false);
    resetProductForm();
    loadProducts();
    loadStats();
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    if (!productForm.name || !productForm.price) {
      toast.error('Please fill required fields');
      return;
    }

    const { error } = await supabase
      .from('seller_products')
      .update({
        name: productForm.name,
        description: productForm.description || null,
        category: productForm.category,
        price: parseFloat(productForm.price),
        original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
        image_url: productForm.image_url || null,
        access_link: productForm.access_link || null,
        stock: productForm.stock ? parseInt(productForm.stock) : null,
        is_active: productForm.is_active
      })
      .eq('id', editingProduct.id);

    if (error) {
      toast.error('Failed to update product');
      return;
    }

    toast.success('Product updated');
    setShowProductModal(false);
    setEditingProduct(null);
    resetProductForm();
    loadProducts();
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('seller_products')
      .delete()
      .eq('id', productId);

    if (error) {
      toast.error('Failed to delete product');
      return;
    }

    toast.success('Product deleted');
    loadProducts();
    loadStats();
  };

  const handleEditProduct = (product: SellerProduct & { stock?: number | null }) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: product.price.toString(),
      original_price: product.original_price?.toString() || '',
      image_url: product.image_url || '',
      access_link: product.access_link || '',
      stock: product.stock?.toString() || '',
      is_active: product.is_active
    });
    setShowProductModal(true);
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      category: 'OTT',
      price: '',
      original_price: '',
      image_url: '',
      access_link: '',
      stock: '',
      is_active: true
    });
  };

  // Variations
  const handleOpenVariations = async (product: SellerProduct) => {
    setSelectedProductForVariations(product);
    const { data } = await supabase
      .from('seller_product_variations')
      .select('*')
      .eq('product_id', product.id);
    setVariations(data || []);
    setShowVariationsModal(true);
  };

  const handleAddVariation = async () => {
    if (!selectedProductForVariations || !newVariation.name || !newVariation.price) {
      toast.error('Please fill all fields');
      return;
    }

    const { error } = await supabase
      .from('seller_product_variations')
      .insert({
        product_id: selectedProductForVariations.id,
        name: newVariation.name,
        price: parseFloat(newVariation.price)
      });

    if (error) {
      toast.error('Failed to add variation');
      return;
    }

    toast.success('Variation added');
    setNewVariation({ name: '', price: '' });
    handleOpenVariations(selectedProductForVariations);
  };

  const handleDeleteVariation = async (variationId: string) => {
    const { error } = await supabase
      .from('seller_product_variations')
      .delete()
      .eq('id', variationId);

    if (error) {
      toast.error('Failed to delete variation');
      return;
    }

    toast.success('Variation deleted');
    if (selectedProductForVariations) {
      handleOpenVariations(selectedProductForVariations);
    }
  };

  // Profile update
  const handleUpdateProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update profile');
      return;
    }

    toast.success('Profile updated');
    setShowProfileModal(false);
    await refreshProfile();
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
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Seller Dashboard
            </h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowProfileModal(true)}>
            <Camera className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Earnings Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 mb-6 text-primary-foreground shadow-glow"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Earnings Overview
            </h2>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {PLATFORM_COMMISSION * 100}% Platform Fee
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-2xl p-4">
              <DollarSign className="w-6 h-6 mb-2" />
              <p className="text-2xl font-bold">₹{stats.totalEarnings.toFixed(2)}</p>
              <p className="text-xs opacity-80">Net Earnings</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4">
              <Percent className="w-6 h-6 mb-2" />
              <p className="text-2xl font-bold">₹{stats.platformFees.toFixed(2)}</p>
              <p className="text-xs opacity-80">Platform Fees</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center bg-white/10 rounded-xl p-3">
              <Package className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xl font-bold">{stats.totalProducts}</p>
              <p className="text-xs opacity-80">Products</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl p-3">
              <ShoppingBag className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xl font-bold">{stats.totalSold}</p>
              <p className="text-xs opacity-80">Sold</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl p-3">
              <Clock className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xl font-bold">{stats.pendingOrders}</p>
              <p className="text-xs opacity-80">Pending</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted">
            <TabsTrigger value="products" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Package className="w-4 h-4 mr-2" />
              My Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardList className="w-4 h-4 mr-2" />
              My Orders
              {stats.pendingOrders > 0 && (
                <span className="ml-2 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                  {stats.pendingOrders}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4">
            {/* Add Product Button */}
            <Button
              className="w-full mb-6 btn-gradient rounded-xl h-12"
              onClick={() => {
                setEditingProduct(null);
                resetProductForm();
                setShowProductModal(true);
              }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New Product
            </Button>

            {/* Products List */}
            <div className="space-y-3">
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground">No products yet</p>
                  <p className="text-sm text-muted-foreground">Add your first product to start selling</p>
                </div>
              ) : (
                products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-2xl p-4 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={product.image_url || 'https://via.placeholder.com/64'}
                        alt={product.name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">{product.category}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            product.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold text-primary">₹{product.price}</span>
                          {product.original_price && (
                            <span className="text-xs text-muted-foreground line-through">
                              ₹{product.original_price}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {product.sold_count} sold
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl"
                        onClick={() => handleEditProduct(product)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl"
                        onClick={() => handleOpenVariations(product)}
                      >
                        <Image className="w-4 h-4 mr-1" />
                        Variations
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-xl"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-4">
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground">Orders for your products will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order, index) => {
                  const getStatusIcon = () => {
                    switch (order.status) {
                      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />;
                      case 'pending': return <Clock className="w-4 h-4 text-warning" />;
                      case 'processing': return <Truck className="w-4 h-4 text-primary" />;
                      case 'cancelled': return <XCircle className="w-4 h-4 text-destructive" />;
                      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
                    }
                  };

                  const getStatusColor = () => {
                    switch (order.status) {
                      case 'completed': return 'bg-success/10 text-success';
                      case 'pending': return 'bg-warning/10 text-warning';
                      case 'processing': return 'bg-primary/10 text-primary';
                      case 'cancelled': return 'bg-destructive/10 text-destructive';
                      default: return 'bg-muted text-muted-foreground';
                    }
                  };

                  const isPending = order.status === 'pending';

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-card rounded-2xl p-4 shadow-card ${isPending ? 'border-2 border-warning' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={order.product_image || 'https://via.placeholder.com/64'}
                          alt={order.product_name}
                          className="w-14 h-14 rounded-xl object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{order.product_name}</h3>
                              <p className="text-xs text-muted-foreground">
                                Buyer: {order.buyer_name}
                              </p>
                            </div>
                            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full whitespace-nowrap ${getStatusColor()}`}>
                              {getStatusIcon()}
                              {order.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="font-bold text-primary">₹{order.total_price}</span>
                            <span className="text-xs text-muted-foreground">
                              Qty: {order.quantity}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {order.user_note && (
                            <p className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded-lg">
                              Note: {order.user_note}
                            </p>
                          )}
                        </div>
                      </div>

                      {order.access_link ? (
                        <div className="mt-3 p-2 bg-success/10 rounded-xl">
                          <p className="text-xs text-success font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Delivered
                          </p>
                        </div>
                      ) : isPending ? (
                        <Button
                          className="w-full mt-3 btn-gradient rounded-xl"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDeliverModal(true);
                          }}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Deliver Order
                        </Button>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Deliver Order Modal */}
      <Dialog open={showDeliverModal} onOpenChange={setShowDeliverModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Deliver Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedOrder && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <img
                  src={selectedOrder.product_image || 'https://via.placeholder.com/48'}
                  alt={selectedOrder.product_name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div>
                  <p className="font-medium">{selectedOrder.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    To: {selectedOrder.buyer_name}
                  </p>
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-1 block">Access Link *</label>
              <Input
                placeholder="Enter access link or product key"
                value={deliveryLink}
                onChange={(e) => setDeliveryLink(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This link will be shared with the buyer
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Delivery Note (Optional)</label>
              <Textarea
                placeholder="Add instructions or notes for the buyer..."
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="rounded-xl"
                rows={2}
              />
            </div>

            <Button
              className="w-full btn-gradient rounded-xl h-12"
              onClick={handleDeliverOrder}
              disabled={deliveringOrder || !deliveryLink.trim()}
            >
              {deliveringOrder ? (
                'Delivering...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Confirm Delivery
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Product Name *"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="rounded-xl"
            />
            <Textarea
              placeholder="Description"
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="rounded-xl"
              rows={3}
            />
            <Select
              value={productForm.category}
              onValueChange={(value) => setProductForm({ ...productForm, category: value })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Price *"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                className="rounded-xl"
              />
              <Input
                type="number"
                placeholder="Original Price"
                value={productForm.original_price}
                onChange={(e) => setProductForm({ ...productForm, original_price: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <Input
              placeholder="Image URL"
              value={productForm.image_url}
              onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
              className="rounded-xl"
            />
            <Input
              placeholder="Access Link (for digital products)"
              value={productForm.access_link}
              onChange={(e) => setProductForm({ ...productForm, access_link: e.target.value })}
              className="rounded-xl"
            />
            <Input
              type="number"
              placeholder="Stock Quantity (leave empty for unlimited)"
              value={productForm.stock}
              onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
              className="rounded-xl"
            />
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
              <span className="text-sm">Active</span>
              <Switch
                checked={productForm.is_active}
                onCheckedChange={(checked) => setProductForm({ ...productForm, is_active: checked })}
              />
            </div>
            <Button
              className="w-full btn-gradient rounded-xl"
              onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
            >
              <Save className="w-4 h-4 mr-2" />
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variations Modal */}
      <Dialog open={showVariationsModal} onOpenChange={setShowVariationsModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Product Variations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              {variations.map((variation) => (
                <div key={variation.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div>
                    <p className="font-medium">{variation.name}</p>
                    <p className="text-sm text-primary">₹{variation.price}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteVariation(variation.id)}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Add New Variation</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Name"
                  value={newVariation.name}
                  onChange={(e) => setNewVariation({ ...newVariation, name: e.target.value })}
                  className="rounded-xl"
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={newVariation.price}
                  onChange={(e) => setNewVariation({ ...newVariation, price: e.target.value })}
                  className="rounded-xl w-24"
                />
                <Button size="icon" onClick={handleAddVariation} className="rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Update Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-primary" />
                )}
              </div>
            </div>
            <Input
              placeholder="Profile Picture URL"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="rounded-xl"
            />
            <Button className="w-full btn-gradient rounded-xl" onClick={handleUpdateProfile}>
              <Save className="w-4 h-4 mr-2" />
              Update Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SellerPanelPage;
