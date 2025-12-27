import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Users,
  ShoppingBag,
  DollarSign,
  Settings,
  Image,
  Zap,
  Bell,
  UserPlus,
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  ChevronRight,
  Award,
  TrendingUp,
  MessageCircle,
  Shield,
  Timer,
  Phone,
  Download,
  ExternalLink,
  Mail,
  Calendar,
  CreditCard,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import BlueTick from '@/components/BlueTick';
import AdminChatPanel from '@/components/AdminChatPanel';
import AdminAnalytics from '@/components/AdminAnalytics';
import { toast } from 'sonner';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin, tempAdminExpiry, profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [tempAdmins, setTempAdmins] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  
  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTempAdminModal, setShowTempAdminModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProductForVariations, setSelectedProductForVariations] = useState<any>(null);
  const [productVariations, setProductVariations] = useState<any[]>([]);
  const [newVariation, setNewVariation] = useState({ name: '', price: '' });
  
  // Form states
  const [giftAmount, setGiftAmount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [accessLink, setAccessLink] = useState('');
  const [tempAdminEmail, setTempAdminEmail] = useState('');
  const [tempAdminHours, setTempAdminHours] = useState('24');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  
  // Product form
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    category: '',
    image_url: '',
    access_link: '',
    stock: '',
    is_active: true
  });
  
  // Banner form
  const [bannerForm, setBannerForm] = useState({
    title: '',
    image_url: '',
    link: '',
    is_active: true
  });
  
  // Flash sale form
  const [flashSaleForm, setFlashSaleForm] = useState({
    product_id: '',
    sale_price: '',
    start_time: '',
    end_time: '',
    is_active: true
  });

  useEffect(() => {
    if (!isAdmin && !isTempAdmin) {
      navigate('/');
      return;
    }
    loadData();
  }, [isAdmin, isTempAdmin, navigate]);

  const loadData = async () => {
    setLoading(true);
    
    // Load users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(usersData || []);

    // Load orders with profile info
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Fetch user profiles for orders
    if (ordersData) {
      const userIds = [...new Set(ordersData.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', userIds);
      
      const ordersWithProfiles = ordersData.map(order => ({
        ...order,
        profiles: profiles?.find(p => p.id === order.user_id)
      }));
      setOrders(ordersWithProfiles);
    }

    // Load products
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    setProducts(productsData || []);

    // Load banners
    const { data: bannersData } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });
    setBanners(bannersData || []);
    
    // Load flash sales
    const { data: flashSalesData } = await supabase
      .from('flash_sales')
      .select('*, products(name, image_url)')
      .order('created_at', { ascending: false });
    setFlashSales(flashSalesData || []);

    // Load announcements
    const { data: announcementsData } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements(announcementsData || []);

    // Load temp admins (only for main admin)
    if (isAdmin) {
      const { data: tempAdminsData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'temp_admin');
      
      if (tempAdminsData) {
        const userIds = tempAdminsData.map(ta => ta.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        const tempAdminsWithProfiles = tempAdminsData.map(ta => ({
          ...ta,
          profiles: profiles?.find(p => p.id === ta.user_id)
        }));
        setTempAdmins(tempAdminsWithProfiles);
      }
    }

    // Load settings
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('*');
    const settingsObj: any = {};
    settingsData?.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    setSettings(settingsObj);

    setLoading(false);
  };

  // Stats
  const totalUsers = users.length;
  const totalDeposits = users.reduce((sum, u) => sum + (u.total_deposit || 0), 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const blueTickUsers = users.filter(u => u.has_blue_check).length;
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  }).length;
  
  // Low stock products (threshold from settings or default to 5)
  const lowStockThreshold = parseInt(settings.low_stock_threshold || '5');
  const lowStockProducts = products.filter(p => p.stock !== null && p.stock <= lowStockThreshold && p.stock > 0);
  const outOfStockProducts = products.filter(p => p.stock !== null && p.stock <= 0);

  // Filter users
  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (orderStatusFilter === 'all') return true;
    return o.status === orderStatusFilter;
  });

  // User actions
  const handleGiftBlueTick = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ has_blue_check: true }).eq('id', userId);
    if (error) {
      toast.error('Failed to gift blue tick');
      return;
    }
    toast.success('Blue Tick gifted successfully!');
    setShowUserModal(false);
    loadData();
  };

  const handleGiftMoney = async () => {
    if (!selectedUser || !giftAmount) return;
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    const newBalance = (selectedUser.wallet_balance || 0) + amount;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', selectedUser.id);
    
    if (updateError) {
      toast.error('Failed to gift money');
      return;
    }

    await supabase.from('transactions').insert({
      user_id: selectedUser.id,
      type: 'gift',
      amount,
      status: 'completed',
      description: `Admin gift - Rs${amount}`
    });

    toast.success(`Rs${amount} gifted to ${selectedUser.name}`);
    setGiftAmount('');
    setShowUserModal(false);
    loadData();
  };

  // Order actions
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const order = orders.find(o => o.id === orderId);
    
    const updateData: any = { 
      status, 
      admin_note: adminNote || null,
      updated_at: new Date().toISOString()
    };
    
    if (accessLink) {
      updateData.access_link = accessLink;
    }

    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    
    if (error) {
      toast.error('Failed to update order');
      return;
    }

    // Send notification to user
    if (order) {
      let notificationTitle = '';
      let notificationMessage = '';
      
      switch (status) {
        case 'completed':
          notificationTitle = 'Order Completed! ✅';
          notificationMessage = `Your order for ${order.product_name} has been completed.`;
          break;
        case 'processing':
          notificationTitle = 'Order Processing 🔄';
          notificationMessage = `Your order for ${order.product_name} is being processed.`;
          break;
        case 'cancelled':
          notificationTitle = 'Order Cancelled ❌';
          notificationMessage = `Your order for ${order.product_name} has been cancelled. Refund added to wallet.`;
          break;
        case 'refunded':
          notificationTitle = 'Order Refunded 💰';
          notificationMessage = `Your order for ${order.product_name} has been refunded.`;
          break;
        default:
          notificationTitle = 'Order Update';
          notificationMessage = `Your order for ${order.product_name} status: ${status}`;
      }

      await supabase.from('notifications').insert({
        user_id: order.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: 'order'
      });
    }

    // If cancelled/rejected, refund
    if (status === 'cancelled' || status === 'refunded') {
      if (order) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', order.user_id)
          .single();
        
        if (userProfile) {
          await supabase.from('profiles').update({
            wallet_balance: (userProfile.wallet_balance || 0) + order.total_price
          }).eq('id', order.user_id);

          await supabase.from('transactions').insert({
            user_id: order.user_id,
            type: 'refund',
            amount: order.total_price,
            status: 'completed',
            description: `Order refund - ${order.product_name}`
          });
        }
      }
    }

    toast.success('Order updated!');
    setAdminNote('');
    setAccessLink('');
    setShowOrderModal(false);
    loadData();
  };

  // Temp Admin actions
  const handleAddTempAdmin = async () => {
    if (!tempAdminEmail || !tempAdminHours) return;
    
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', tempAdminEmail)
      .maybeSingle();

    if (!user) {
      toast.error('User not found');
      return;
    }

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(tempAdminHours));

    const { error } = await supabase.from('user_roles').upsert({
      user_id: user.id,
      role: 'temp_admin',
      temp_admin_expiry: expiryDate.toISOString()
    });

    if (error) {
      toast.error('Failed to add temp admin');
      return;
    }

    toast.success('Temporary admin added!');
    setTempAdminEmail('');
    setTempAdminHours('24');
    setShowTempAdminModal(false);
    loadData();
  };

  const handleRemoveTempAdmin = async (userId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'temp_admin');
    toast.success('Temporary admin removed!');
    loadData();
  };

  // Announcement actions
  const handleCreateAnnouncement = async () => {
    if (!announcementTitle || !announcementMessage) return;
    
    await supabase.from('announcements').insert({
      title: announcementTitle,
      message: announcementMessage,
      type: 'info',
      is_active: true
    });

    toast.success('Announcement created!');
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setShowAnnouncementModal(false);
    loadData();
  };
  
  // Product actions
  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.price || !productForm.category) {
      toast.error('Please fill required fields');
      return;
    }
    
    const { error } = await supabase.from('products').insert({
      name: productForm.name,
      description: productForm.description,
      price: parseFloat(productForm.price),
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category,
      image_url: productForm.image_url,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      is_active: productForm.is_active
    });
    
    if (error) {
      toast.error('Failed to add product');
      return;
    }
    
    toast.success('Product added!');
    setProductForm({ name: '', description: '', price: '', original_price: '', category: '', image_url: '', access_link: '', stock: '', is_active: true });
    setShowProductModal(false);
    loadData();
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      original_price: product.original_price?.toString() || '',
      category: product.category || '',
      image_url: product.image_url || '',
      access_link: product.access_link || '',
      stock: product.stock?.toString() || '',
      is_active: product.is_active !== false
    });
    setShowProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !productForm.name || !productForm.price || !productForm.category) {
      toast.error('Please fill required fields');
      return;
    }
    
    const { error } = await supabase.from('products').update({
      name: productForm.name,
      description: productForm.description,
      price: parseFloat(productForm.price),
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category,
      image_url: productForm.image_url,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      is_active: productForm.is_active
    }).eq('id', editingProduct.id);
    
    if (error) {
      toast.error('Failed to update product');
      return;
    }
    
    toast.success('Product updated!');
    setProductForm({ name: '', description: '', price: '', original_price: '', category: '', image_url: '', access_link: '', stock: '', is_active: true });
    setEditingProduct(null);
    setShowProductModal(false);
    loadData();
  };
  
  const handleDeleteProduct = async (productId: string) => {
    // Check if product has orders
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);
    
    if (orderCount && orderCount > 0) {
      // Product has orders - deactivate instead of delete
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
      
      if (error) {
        console.error('Deactivate error:', error);
        toast.error('Failed to deactivate product');
        return;
      }
      toast.success('Product deactivated (has existing orders)');
      loadData();
      return;
    }
    
    // No orders - safe to delete
    // First delete variations
    await supabase.from('product_variations').delete().eq('product_id', productId);
    
    // Then delete product
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete product: ' + error.message);
      return;
    }
    toast.success('Product deleted!');
    loadData();
  };

  // Variations actions
  const handleOpenVariations = async (product: any) => {
    setSelectedProductForVariations(product);
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: true });
    setProductVariations(data || []);
    setShowVariationsModal(true);
  };

  const handleAddVariation = async () => {
    if (!newVariation.name || !newVariation.price || !selectedProductForVariations) {
      toast.error('Please fill variation name and price');
      return;
    }
    
    const { error } = await supabase.from('product_variations').insert({
      product_id: selectedProductForVariations.id,
      name: newVariation.name,
      price: parseFloat(newVariation.price)
    });

    if (error) {
      toast.error('Failed to add variation');
      return;
    }

    toast.success('Variation added!');
    setNewVariation({ name: '', price: '' });
    handleOpenVariations(selectedProductForVariations);
  };

  const handleDeleteVariation = async (variationId: string) => {
    await supabase.from('product_variations').delete().eq('id', variationId);
    toast.success('Variation deleted!');
    if (selectedProductForVariations) {
      handleOpenVariations(selectedProductForVariations);
    }
  };
  
  // Banner actions
  const handleAddBanner = async () => {
    if (!bannerForm.title || !bannerForm.image_url) {
      toast.error('Please fill required fields');
      return;
    }
    
    const { error } = await supabase.from('banners').insert({
      title: bannerForm.title,
      image_url: bannerForm.image_url,
      link: bannerForm.link || null,
      is_active: bannerForm.is_active,
      sort_order: banners.length
    });
    
    if (error) {
      toast.error('Failed to add banner');
      return;
    }
    
    toast.success('Banner added!');
    setBannerForm({ title: '', image_url: '', link: '', is_active: true });
    setShowBannerModal(false);
    loadData();
  };
  
  const handleDeleteBanner = async (bannerId: string) => {
    await supabase.from('banners').delete().eq('id', bannerId);
    toast.success('Banner deleted!');
    loadData();
  };
  
  const handleToggleBanner = async (bannerId: string, isActive: boolean) => {
    await supabase.from('banners').update({ is_active: !isActive }).eq('id', bannerId);
    loadData();
  };
  
  // Flash sale actions
  const handleAddFlashSale = async () => {
    if (!flashSaleForm.product_id || !flashSaleForm.sale_price || !flashSaleForm.end_time) {
      toast.error('Please fill required fields');
      return;
    }
    
    const { error } = await supabase.from('flash_sales').insert({
      product_id: flashSaleForm.product_id,
      sale_price: parseFloat(flashSaleForm.sale_price),
      start_time: flashSaleForm.start_time || new Date().toISOString(),
      end_time: flashSaleForm.end_time,
      is_active: flashSaleForm.is_active
    });
    
    if (error) {
      toast.error('Failed to add flash sale');
      return;
    }
    
    toast.success('Flash sale added!');
    setFlashSaleForm({ product_id: '', sale_price: '', start_time: '', end_time: '', is_active: true });
    setShowFlashSaleModal(false);
    loadData();
  };
  
  const handleDeleteFlashSale = async (saleId: string) => {
    await supabase.from('flash_sales').delete().eq('id', saleId);
    toast.success('Flash sale deleted!');
    loadData();
  };

  // Settings update
  const handleUpdateSetting = async (key: string, value: string) => {
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    setSettings({ ...settings, [key]: value });
    toast.success('Setting updated!');
  };

  // Initialize default settings if empty
  const defaultSettings = [
    'app_name', 'contact_whatsapp', 'contact_email', 'payment_qr_code',
    'min_deposit', 'referral_bonus', 'login_bonus', 'daily_bonus_min',
    'daily_bonus_max', 'blue_tick_threshold', 'single_deposit_bonus_threshold',
    'single_deposit_bonus_amount', 'currency_symbol', 'app_language',
    'maintenance_mode', 'allow_registration', 'auto_approve_orders',
    'notification_enabled', 'razorpay_enabled', 'google_login_enabled'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Admin Panel
            </h1>
            {isTempAdmin && tempAdminExpiry && (
              <p className="text-xs text-accent flex items-center gap-1">
                <Timer className="w-3 h-3" />
                Expires: {new Date(tempAdminExpiry).toLocaleString()}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/chat')}>
            <Phone className="w-4 h-4 mr-2" />
            Contact Users
          </Button>
        </div>
      </header>

      <main className="px-4 max-w-4xl mx-auto mt-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="p-2 rounded-xl bg-primary/10 w-fit mb-2">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="p-2 rounded-xl bg-success/10 w-fit mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-foreground">₹{totalDeposits.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Deposits</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="p-2 rounded-xl bg-accent/10 w-fit mb-2">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="p-2 rounded-xl bg-secondary/10 w-fit mb-2">
              <Clock className="w-5 h-5 text-secondary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{pendingOrders}</p>
            <p className="text-xs text-muted-foreground">Pending Orders</p>
          </motion.div>
        </div>
        
        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-xl p-3 shadow-card text-center">
            <Award className="w-5 h-5 text-accent mx-auto mb-1" />
            <p className="font-bold text-foreground">{blueTickUsers}</p>
            <p className="text-[10px] text-muted-foreground">Blue Tick Users</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-card text-center">
            <Calendar className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="font-bold text-foreground">{todayOrders}</p>
            <p className="text-[10px] text-muted-foreground">Today's Orders</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-card text-center">
            <Package className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="font-bold text-foreground">{products.length}</p>
            <p className="text-[10px] text-muted-foreground">Products</p>
          </div>
        </div>

        {/* Low Stock Alert */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 mb-6"
          >
            <h3 className="font-semibold text-destructive flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5" />
              Stock Alerts
            </h3>
            {outOfStockProducts.length > 0 && (
              <div className="mb-2">
                <p className="text-sm font-medium text-destructive">Out of Stock ({outOfStockProducts.length}):</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {outOfStockProducts.slice(0, 5).map(p => (
                    <span key={p.id} className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded">
                      {p.name}
                    </span>
                  ))}
                  {outOfStockProducts.length > 5 && (
                    <span className="text-xs text-destructive">+{outOfStockProducts.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
            {lowStockProducts.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600">Low Stock ({lowStockProducts.length}):</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lowStockProducts.slice(0, 5).map(p => (
                    <span key={p.id} className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded">
                      {p.name} ({p.stock})
                    </span>
                  ))}
                  {lowStockProducts.length > 5 && (
                    <span className="text-xs text-yellow-600">+{lowStockProducts.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar mb-4">
            <TabsTrigger value="dashboard" className="flex-1 text-xs">Dashboard</TabsTrigger>
            <TabsTrigger value="users" className="flex-1 text-xs">Users</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 text-xs">Orders</TabsTrigger>
            <TabsTrigger value="products" className="flex-1 text-xs">Products</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 text-xs">Chat</TabsTrigger>
            <TabsTrigger value="content" className="flex-1 text-xs">Content</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Analytics Section */}
            <AdminAnalytics orders={orders} products={products} />
            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
                onClick={() => setShowAnnouncementModal(true)}
              >
                <Bell className="w-6 h-6 text-primary" />
                <span className="text-xs">Announcement</span>
              </Button>
              
              {isAdmin && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
                  onClick={() => setShowTempAdminModal(true)}
                >
                  <UserPlus className="w-6 h-6 text-secondary" />
                  <span className="text-xs">Add Temp Admin</span>
                </Button>
              )}

              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
                onClick={() => setActiveTab('orders')}
              >
                <ShoppingBag className="w-6 h-6 text-accent" />
                <span className="text-xs">Manage Orders</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
                onClick={() => navigate('/chat')}
              >
                <MessageCircle className="w-6 h-6 text-success" />
                <span className="text-xs">Messages</span>
              </Button>
            </div>

            {/* Temp Admins List (Only for main admin) */}
            {isAdmin && tempAdmins.length > 0 && (
              <div className="bg-card rounded-2xl p-4 shadow-card">
                <h3 className="font-semibold text-foreground mb-3">Temporary Admins</h3>
                <div className="space-y-2">
                  {tempAdmins.map((ta: any) => (
                    <div key={ta.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                      <div>
                        <p className="font-medium text-foreground">{ta.profiles?.name || ta.profiles?.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(ta.temp_admin_expiry).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveTempAdmin(ta.user_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            <div className="bg-card rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Recent Orders</h3>
                <button onClick={() => setActiveTab('orders')} className="text-sm text-primary">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {orders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                    <img src={order.product_image || 'https://via.placeholder.com/50'} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{order.product_name}</p>
                      <p className="text-xs text-muted-foreground">{order.profiles?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">₹{order.total_price}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        order.status === 'completed' ? 'bg-success/10 text-success' :
                        order.status === 'pending' ? 'bg-primary/10 text-primary' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Search users..." 
                className="pl-12 h-12 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredUsers.map((user: any) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-2xl p-4 shadow-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground flex items-center gap-1">
                        {user.name}
                        {user.has_blue_check && <BlueTick size="sm" />}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Balance: ₹{user.wallet_balance || 0}</span>
                        <span>Deposit: ₹{user.total_deposit || 0}</span>
                        <span>Orders: {user.total_orders || 0}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Joined: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowUserModal(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {['all', 'pending', 'processing', 'completed', 'cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setOrderStatusFilter(status)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    orderStatusFilter === status 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== 'all' && (
                    <span className="ml-1 text-xs">
                      ({orders.filter(o => o.status === status).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredOrders.map((order: any) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-2xl p-4 shadow-card"
                >
                  <div className="flex items-start gap-4">
                    <img src={order.product_image || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{order.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.profiles?.name} • {order.profiles?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Phone: {order.profiles?.phone || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Qty: {order.quantity} | Total: ₹{order.total_price}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      {order.user_note && (
                        <p className="text-xs text-primary mt-1 bg-primary/5 p-2 rounded">
                          📝 Note: {order.user_note}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'completed' ? 'bg-success/10 text-success' :
                        order.status === 'pending' ? 'bg-primary/10 text-primary' :
                        order.status === 'processing' ? 'bg-accent/10 text-accent' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {order.status}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setSelectedOrder(order);
                          setAdminNote(order.admin_note || '');
                          setAccessLink(order.access_link || '');
                          setShowOrderModal(true);
                        }}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Button className="w-full btn-gradient rounded-xl" onClick={() => setShowProductModal(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Add New Product
            </Button>

            <div className="space-y-3">
              {products.map((product: any) => (
                <div key={product.id} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4">
                  <img src={product.image_url || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-primary font-bold">₹{product.price}</p>
                      {product.original_price && (
                        <p className="text-xs text-muted-foreground line-through">₹{product.original_price}</p>
                      )}
                    </div>
                    {product.access_link && (
                      <p className="text-xs text-success flex items-center gap-1 mt-1">
                        <Download className="w-3 h-3" />
                        Has download link
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => handleOpenVariations(product)} title="Variations">
                      <Package className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => handleEditProduct(product)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => handleDeleteProduct(product.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          {/* Chat Tab */}
          <TabsContent value="chat">
            <AdminChatPanel />
          </TabsContent>
          
          {/* Content Tab (Banners & Flash Sales) */}
          <TabsContent value="content" className="space-y-6">
            {/* Banners Section */}
            <div className="bg-card rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Image className="w-5 h-5 text-primary" />
                  Banners
                </h3>
                <Button size="sm" onClick={() => setShowBannerModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {banners.map((banner: any) => (
                  <div key={banner.id} className="flex items-center gap-3 p-2 bg-muted rounded-xl">
                    <img src={banner.image_url} alt="" className="w-24 h-12 rounded object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{banner.title}</p>
                      {banner.link && <p className="text-xs text-muted-foreground truncate">{banner.link}</p>}
                    </div>
                    <Switch 
                      checked={banner.is_active} 
                      onCheckedChange={() => handleToggleBanner(banner.id, banner.is_active)}
                    />
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDeleteBanner(banner.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {banners.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">No banners yet</p>
                )}
              </div>
            </div>
            
            {/* Flash Sales Section */}
            <div className="bg-card rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent" />
                  Flash Sales
                </h3>
                <Button size="sm" onClick={() => setShowFlashSaleModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {flashSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center gap-3 p-2 bg-muted rounded-xl">
                    <img src={sale.products?.image_url || 'https://via.placeholder.com/50'} alt="" className="w-12 h-12 rounded object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{sale.products?.name}</p>
                      <p className="text-xs text-success font-bold">₹{sale.sale_price}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Ends: {new Date(sale.end_time).toLocaleString()}
                      </p>
                    </div>
                    <Switch checked={sale.is_active} />
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDeleteFlashSale(sale.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {flashSales.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">No flash sales yet</p>
                )}
              </div>
            </div>
            
            {/* Announcements Section */}
            <div className="bg-card rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-5 h-5 text-secondary" />
                  Announcements
                </h3>
                <Button size="sm" onClick={() => setShowAnnouncementModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {announcements.map((ann: any) => (
                  <div key={ann.id} className="p-3 bg-muted rounded-xl">
                    <p className="font-medium text-sm">{ann.title}</p>
                    <p className="text-xs text-muted-foreground">{ann.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(ann.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">No announcements yet</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab (Only for main admin) */}
          {isAdmin && (
            <TabsContent value="settings" className="space-y-4">
              <div className="bg-card rounded-2xl p-4 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">App Settings (20+ Options)</h3>
                
                <div className="space-y-4">
                  {/* App Info */}
                  <div className="border-b border-border pb-4">
                    <h4 className="text-sm font-medium text-primary mb-2">App Information</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">App Name</span>
                        <Input
                          value={settings.app_name || 'RKR Premium Store'}
                          onChange={(e) => handleUpdateSetting('app_name', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Language</span>
                        <Input
                          value={settings.app_language || 'English'}
                          onChange={(e) => handleUpdateSetting('app_language', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Currency Symbol</span>
                        <Input
                          value={settings.currency_symbol || '₹'}
                          onChange={(e) => handleUpdateSetting('currency_symbol', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact */}
                  <div className="border-b border-border pb-4">
                    <h4 className="text-sm font-medium text-primary mb-2">Contact Info</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">WhatsApp</span>
                        <Input
                          value={settings.contact_whatsapp || '+918900684167'}
                          onChange={(e) => handleUpdateSetting('contact_whatsapp', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <Input
                          value={settings.contact_email || ''}
                          onChange={(e) => handleUpdateSetting('contact_email', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Payments */}
                  <div className="border-b border-border pb-4">
                    <h4 className="text-sm font-medium text-primary mb-2">Payment Settings</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Min Deposit (Rs)</span>
                        <Input
                          value={settings.min_deposit || '10'}
                          onChange={(e) => handleUpdateSetting('min_deposit', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Payment QR Code URL</span>
                        <Input
                          value={settings.payment_qr_code || ''}
                          onChange={(e) => handleUpdateSetting('payment_qr_code', e.target.value)}
                          className="w-40 h-8 text-sm"
                          placeholder="QR code URL"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Bonuses */}
                  <div className="border-b border-border pb-4">
                    <h4 className="text-sm font-medium text-primary mb-2">Bonus Settings</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Login Bonus (Rs)</span>
                        <Input
                          value={settings.login_bonus || '0'}
                          onChange={(e) => handleUpdateSetting('login_bonus', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Daily Bonus Min (Rs)</span>
                        <Input
                          value={settings.daily_bonus_min || '0.10'}
                          onChange={(e) => handleUpdateSetting('daily_bonus_min', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Daily Bonus Max (Rs)</span>
                        <Input
                          value={settings.daily_bonus_max || '0.60'}
                          onChange={(e) => handleUpdateSetting('daily_bonus_max', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Referral Bonus (Rs)</span>
                        <Input
                          value={settings.referral_bonus || '10'}
                          onChange={(e) => handleUpdateSetting('referral_bonus', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Blue Tick */}
                  <div className="border-b border-border pb-4">
                    <h4 className="text-sm font-medium text-primary mb-2">Blue Tick Settings</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Deposit Threshold (Rs)</span>
                        <Input
                          value={settings.blue_tick_threshold || '1000'}
                          onChange={(e) => handleUpdateSetting('blue_tick_threshold', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Single Deposit Bonus Threshold</span>
                        <Input
                          value={settings.single_deposit_bonus_threshold || '1000'}
                          onChange={(e) => handleUpdateSetting('single_deposit_bonus_threshold', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Single Deposit Bonus Amount</span>
                        <Input
                          value={settings.single_deposit_bonus_amount || '100'}
                          onChange={(e) => handleUpdateSetting('single_deposit_bonus_amount', e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Features */}
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">Feature Toggles</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Maintenance Mode</span>
                        <Switch 
                          checked={settings.maintenance_mode === 'true'} 
                          onCheckedChange={(v) => handleUpdateSetting('maintenance_mode', v.toString())}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Allow Registration</span>
                        <Switch 
                          checked={settings.allow_registration !== 'false'} 
                          onCheckedChange={(v) => handleUpdateSetting('allow_registration', v.toString())}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Razorpay Enabled</span>
                        <Switch 
                          checked={settings.razorpay_enabled !== 'false'} 
                          onCheckedChange={(v) => handleUpdateSetting('razorpay_enabled', v.toString())}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Google Login</span>
                        <Switch 
                          checked={settings.google_login_enabled !== 'false'} 
                          onCheckedChange={(v) => handleUpdateSetting('google_login_enabled', v.toString())}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Notifications Enabled</span>
                        <Switch 
                          checked={settings.notification_enabled !== 'false'} 
                          onCheckedChange={(v) => handleUpdateSetting('notification_enabled', v.toString())}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Auto Approve Orders</span>
                        <Switch 
                          checked={settings.auto_approve_orders === 'true'} 
                          onCheckedChange={(v) => handleUpdateSetting('auto_approve_orders', v.toString())}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* User Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  {selectedUser.name?.charAt(0) || 'U'}
                </div>
                <h3 className="font-bold text-foreground mt-2 flex items-center justify-center gap-1">
                  {selectedUser.name}
                  {selectedUser.has_blue_check && <BlueTick />}
                </h3>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.phone || 'No phone'}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted rounded-xl p-2">
                  <p className="font-bold">₹{selectedUser.wallet_balance || 0}</p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
                <div className="bg-muted rounded-xl p-2">
                  <p className="font-bold">₹{selectedUser.total_deposit || 0}</p>
                  <p className="text-xs text-muted-foreground">Deposited</p>
                </div>
                <div className="bg-muted rounded-xl p-2">
                  <p className="font-bold">{selectedUser.total_orders || 0}</p>
                  <p className="text-xs text-muted-foreground">Orders</p>
                </div>
              </div>
              
              <div className="bg-muted rounded-xl p-3 text-sm">
                <p><strong>Referral Code:</strong> {selectedUser.referral_code}</p>
                <p><strong>Referred By:</strong> {selectedUser.referred_by || 'None'}</p>
                <p><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                <p><strong>Notifications:</strong> {selectedUser.notifications_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>

              <div className="flex gap-2">
                {!selectedUser.has_blue_check && (
                  <Button
                    onClick={() => handleGiftBlueTick(selectedUser.id)}
                    className="flex-1 btn-gradient"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    Gift Blue Tick
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/chat')}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleGiftMoney}>
                  <Gift className="w-4 h-4 mr-2" />
                  Gift Money
                </Button>
              </div>

              {/* Make Seller Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  // Check if already a seller
                  const { data: existingRole } = await supabase
                    .from('user_roles')
                    .select('id')
                    .eq('user_id', selectedUser.id)
                    .eq('role', 'seller')
                    .maybeSingle();

                  if (existingRole) {
                    // Remove seller role
                    await supabase
                      .from('user_roles')
                      .delete()
                      .eq('id', existingRole.id);
                    toast.success('Seller role removed - User is now a normal user');
                  } else {
                    // Add seller role
                    await supabase
                      .from('user_roles')
                      .insert({ user_id: selectedUser.id, role: 'seller' });
                    toast.success('User is now a seller!');
                  }
                  setShowUserModal(false);
                  loadData();
                }}
              >
                <Shield className="w-4 h-4 mr-2" />
                Toggle Seller Role
              </Button>

              {/* Delete User - Only for main admin */}
              {isAdmin && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    if (!confirm(`Are you sure you want to delete ${selectedUser.name}? This will remove all their data including orders, transactions, and messages.`)) return;
                    
                    // Delete user roles first
                    await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
                    
                    // Delete notifications
                    await supabase.from('notifications').delete().eq('user_id', selectedUser.id);
                    
                    // Delete transactions
                    await supabase.from('transactions').delete().eq('user_id', selectedUser.id);
                    
                    // Delete orders
                    await supabase.from('orders').delete().eq('user_id', selectedUser.id);
                    
                    // Delete profile
                    const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
                    
                    if (error) {
                      toast.error('Failed to delete user');
                      return;
                    }
                    
                    toast.success('User deleted successfully');
                    setShowUserModal(false);
                    loadData();
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Order</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted rounded-xl">
                <img src={selectedOrder.product_image || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <div>
                  <p className="font-semibold">{selectedOrder.product_name}</p>
                  <p className="text-sm text-muted-foreground">Qty: {selectedOrder.quantity}</p>
                  <p className="font-bold text-primary">₹{selectedOrder.total_price}</p>
                </div>
              </div>
              
              {/* Customer Info */}
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p className="font-medium">Customer Details:</p>
                <p>Name: {selectedOrder.profiles?.name}</p>
                <p>Email: {selectedOrder.profiles?.email}</p>
                <p>Phone: {selectedOrder.profiles?.phone || 'N/A'}</p>
                <p>Date: {new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>

              {selectedOrder.user_note && (
                <div className="p-3 bg-primary/5 rounded-xl">
                  <p className="text-xs font-medium mb-1">Customer Note:</p>
                  <p className="text-sm">{selectedOrder.user_note}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium mb-1 block">Access/Download Link (Optional)</label>
                <Input
                  placeholder="https://..."
                  value={accessLink}
                  onChange={(e) => setAccessLink(e.target.value)}
                />
              </div>

              <Textarea
                placeholder="Add note for customer..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'processing')}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Processing
                </Button>
                <Button
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'completed')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled')}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel & Refund
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Temp Admin Modal */}
      <Dialog open={showTempAdminModal} onOpenChange={setShowTempAdminModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Temporary Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="User email"
              value={tempAdminEmail}
              onChange={(e) => setTempAdminEmail(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Duration (hours)"
              value={tempAdminHours}
              onChange={(e) => setTempAdminHours(e.target.value)}
            />
            <Button className="w-full btn-gradient" onClick={handleAddTempAdmin}>
              Add Temporary Admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Announcement Modal */}
      <Dialog open={showAnnouncementModal} onOpenChange={setShowAnnouncementModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Title"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
            />
            <Textarea
              placeholder="Message"
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              rows={4}
            />
            <Button className="w-full btn-gradient" onClick={handleCreateAnnouncement}>
              <Bell className="w-4 h-4 mr-2" />
              Send Announcement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add/Edit Product Modal */}
      <Dialog open={showProductModal} onOpenChange={(open) => {
        setShowProductModal(open);
        if (!open) {
          setEditingProduct(null);
          setProductForm({ name: '', description: '', price: '', original_price: '', category: '', image_url: '', access_link: '', stock: '', is_active: true });
        }
      }}>
        <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Product Name *"
              value={productForm.name}
              onChange={(e) => setProductForm({...productForm, name: e.target.value})}
            />
            <Textarea
              placeholder="Description"
              value={productForm.description}
              onChange={(e) => setProductForm({...productForm, description: e.target.value})}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Price *"
                value={productForm.price}
                onChange={(e) => setProductForm({...productForm, price: e.target.value})}
              />
              <Input
                type="number"
                placeholder="Original Price"
                value={productForm.original_price}
                onChange={(e) => setProductForm({...productForm, original_price: e.target.value})}
              />
            </div>
            <Input
              placeholder="Category *"
              value={productForm.category}
              onChange={(e) => setProductForm({...productForm, category: e.target.value})}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Image</label>
              <Input
                placeholder="Image URL (paste link)"
                value={productForm.image_url}
                onChange={(e) => setProductForm({...productForm, image_url: e.target.value})}
              />
              <div className="text-center text-xs text-muted-foreground">or</div>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  if (file.size > 2 * 1024 * 1024) {
                    toast.error('Image must be less than 2MB');
                    return;
                  }
                  
                  toast.loading('Uploading image...');
                  
                  const fileExt = file.name.split('.').pop();
                  const fileName = `product-${Date.now()}.${fileExt}`;
                  
                  const { error } = await supabase.storage
                    .from('chat-images')
                    .upload(`products/${fileName}`, file);
                  
                  if (error) {
                    toast.dismiss();
                    toast.error('Failed to upload');
                    return;
                  }
                  
                  const { data } = supabase.storage
                    .from('chat-images')
                    .getPublicUrl(`products/${fileName}`);
                  
                  setProductForm({...productForm, image_url: data.publicUrl});
                  toast.dismiss();
                  toast.success('Image uploaded!');
                }}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            <Input
              placeholder="Access/Download Link (Optional)"
              value={productForm.access_link}
              onChange={(e) => setProductForm({...productForm, access_link: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Stock Quantity (leave empty for unlimited)"
              value={productForm.stock}
              onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch 
                checked={productForm.is_active} 
                onCheckedChange={(v) => setProductForm({...productForm, is_active: v})}
              />
            </div>
            <Button className="w-full btn-gradient" onClick={editingProduct ? handleUpdateProduct : handleAddProduct}>
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Banner Modal */}
      <Dialog open={showBannerModal} onOpenChange={setShowBannerModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Banner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Banner Title *"
              value={bannerForm.title}
              onChange={(e) => setBannerForm({...bannerForm, title: e.target.value})}
            />
            <Input
              placeholder="Image URL *"
              value={bannerForm.image_url}
              onChange={(e) => setBannerForm({...bannerForm, image_url: e.target.value})}
            />
            <Input
              placeholder="Link (Optional)"
              value={bannerForm.link}
              onChange={(e) => setBannerForm({...bannerForm, link: e.target.value})}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch 
                checked={bannerForm.is_active} 
                onCheckedChange={(v) => setBannerForm({...bannerForm, is_active: v})}
              />
            </div>
            <Button className="w-full btn-gradient" onClick={handleAddBanner}>
              Add Banner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Flash Sale Modal */}
      <Dialog open={showFlashSaleModal} onOpenChange={setShowFlashSaleModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Flash Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full h-10 px-3 rounded-xl border border-input bg-background"
              value={flashSaleForm.product_id}
              onChange={(e) => setFlashSaleForm({...flashSaleForm, product_id: e.target.value})}
            >
              <option value="">Select Product *</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Sale Price *"
              value={flashSaleForm.sale_price}
              onChange={(e) => setFlashSaleForm({...flashSaleForm, sale_price: e.target.value})}
            />
            <div>
              <label className="text-xs text-muted-foreground">End Time *</label>
              <Input
                type="datetime-local"
                value={flashSaleForm.end_time}
                onChange={(e) => setFlashSaleForm({...flashSaleForm, end_time: e.target.value})}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch 
                checked={flashSaleForm.is_active} 
                onCheckedChange={(v) => setFlashSaleForm({...flashSaleForm, is_active: v})}
              />
            </div>
            <Button className="w-full btn-gradient" onClick={handleAddFlashSale}>
              Add Flash Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Product Variations Modal */}
      <Dialog open={showVariationsModal} onOpenChange={setShowVariationsModal}>
        <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Variations</DialogTitle>
            <DialogDescription>
              {selectedProductForVariations?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing Variations */}
            <div className="space-y-2">
              {productVariations.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-primary font-bold text-sm">₹{v.price}</p>
                  </div>
                  <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDeleteVariation(v.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {productVariations.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No variations yet</p>
              )}
            </div>
            
            {/* Add New Variation */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-2">Add New Variation</h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  placeholder="Variation Name"
                  value={newVariation.name}
                  onChange={(e) => setNewVariation({...newVariation, name: e.target.value})}
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={newVariation.price}
                  onChange={(e) => setNewVariation({...newVariation, price: e.target.value})}
                />
              </div>
              <Button className="w-full" onClick={handleAddVariation}>
                <Plus className="w-4 h-4 mr-1" />
                Add Variation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
