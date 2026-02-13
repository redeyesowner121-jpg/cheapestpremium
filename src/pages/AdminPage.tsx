import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Users,
  ShoppingBag,
  Settings,
  Image,
  Bell,
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Plus,
  Award,
  TrendingUp,
  MessageCircle,
  Shield,
  Timer,
  CreditCard,
  Package,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import AdminPaymentSettings from '@/components/AdminPaymentSettings';
import { useAdminData } from '@/hooks/useAdminData';
import { useAdminOrderAlerts } from '@/hooks/useAdminOrderAlerts';
import { 
  AdminDashboard, 
  AdminUsersTab, 
  AdminOrdersTab, 
  AdminProductsTab, 
  AdminContentTab,
  AdminSettingsTab,
  AdminOverviewTab,
  AdminControlTab
} from '@/components/admin';
import { FlashSaleModal, VariationsModal } from '@/components/admin/modals';
import { toast } from 'sonner';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin, tempAdminExpiry, profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  
  // Use custom hook for data loading
  const { data, stats, loading, loadData, setData } = useAdminData(isAdmin, isTempAdmin);
  
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
  
  // Variations for product modal
  const [pendingVariations, setPendingVariations] = useState<{name: string, price: string, reseller_price: string}[]>([]);
  const [existingVariations, setExistingVariations] = useState<any[]>([]);
  const [newModalVariation, setNewModalVariation] = useState({ name: '', price: '', reseller_price: '' });
  
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
    reseller_price: '',
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

  // Admin order alerts with sound
  useAdminOrderAlerts(
    (isAdmin || isTempAdmin) && alertsEnabled,
    () => loadData()
  );

  // Redirect if not admin
  React.useEffect(() => {
    if (!isAdmin && !isTempAdmin) {
      navigate('/');
    }
  }, [isAdmin, isTempAdmin, navigate]);

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
    const order = data.orders.find(o => o.id === orderId);
    
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
    
    const { data: newProduct, error } = await supabase.from('products').insert({
      name: productForm.name,
      description: productForm.description,
      price: parseFloat(productForm.price),
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category,
      image_url: productForm.image_url,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      is_active: productForm.is_active
    }).select().single();
    
    if (error || !newProduct) {
      toast.error('Failed to add product');
      return;
    }
    
    // Add pending variations if any
    if (pendingVariations.length > 0) {
      const variationsToInsert = pendingVariations.map(v => ({
        product_id: newProduct.id,
        name: v.name,
        price: parseFloat(v.price),
        reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
      }));
      
      await supabase.from('product_variations').insert(variationsToInsert);
    }
    
    toast.success('Product added!');
    resetProductForm();
    loadData();
  };

  const resetProductForm = () => {
    setProductForm({ name: '', description: '', price: '', original_price: '', reseller_price: '', category: '', image_url: '', access_link: '', stock: '', is_active: true });
    setPendingVariations([]);
    setNewModalVariation({ name: '', price: '', reseller_price: '' });
    setEditingProduct(null);
    setExistingVariations([]);
    setShowProductModal(false);
  };

  const handleEditProduct = async (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      original_price: product.original_price?.toString() || '',
      reseller_price: product.reseller_price?.toString() || '',
      category: product.category || '',
      image_url: product.image_url || '',
      access_link: product.access_link || '',
      stock: product.stock?.toString() || '',
      is_active: product.is_active !== false
    });
    
    // Load existing variations
    const { data: variationsData } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: true });
    setExistingVariations(variationsData || []);
    setPendingVariations([]);
    setNewModalVariation({ name: '', price: '', reseller_price: '' });
    
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
    
    // Add any new pending variations for this product
    if (pendingVariations.length > 0) {
      const variationsToInsert = pendingVariations.map(v => ({
        product_id: editingProduct.id,
        name: v.name,
        price: parseFloat(v.price),
        reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
      }));
      
      await supabase.from('product_variations').insert(variationsToInsert);
    }
    
    toast.success('Product updated!');
    resetProductForm();
    loadData();
  };
  
  const handleAddModalVariation = () => {
    if (!newModalVariation.name || !newModalVariation.price) {
      toast.error('Please fill variation name and price');
      return;
    }
    
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id,
        name: newModalVariation.name,
        price: parseFloat(newModalVariation.price),
        reseller_price: newModalVariation.reseller_price ? parseFloat(newModalVariation.reseller_price) : null
      }).then(({ error }) => {
        if (error) {
          toast.error('Failed to add variation');
          return;
        }
        
        supabase
          .from('product_variations')
          .select('*')
          .eq('product_id', editingProduct.id)
          .order('created_at', { ascending: true })
          .then(({ data: varData }) => {
            setExistingVariations(varData || []);
          });
        
        toast.success('Variation added!');
        setNewModalVariation({ name: '', price: '', reseller_price: '' });
      });
    } else {
      setPendingVariations([...pendingVariations, { ...newModalVariation }]);
      setNewModalVariation({ name: '', price: '', reseller_price: '' });
    }
  };
  
  const handleDeleteModalVariation = async (variationId: string, isExisting: boolean) => {
    if (isExisting) {
      await supabase.from('product_variations').delete().eq('id', variationId);
      setExistingVariations(existingVariations.filter(v => v.id !== variationId));
      toast.success('Variation deleted!');
    } else {
      const index = parseInt(variationId);
      setPendingVariations(pendingVariations.filter((_, i) => i !== index));
    }
  };
  
  const quickVariationTemplates = [
    { name: '1 Month', price: '49', reseller_price: '' },
    { name: '3 Months', price: '129', reseller_price: '' },
    { name: '6 Months', price: '249', reseller_price: '' },
    { name: '1 Year', price: '449', reseller_price: '' },
  ];
  
  const handleDeleteProduct = async (productId: string) => {
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);
    
    if (orderCount && orderCount > 0) {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
      
      if (error) {
        toast.error('Failed to deactivate product');
        return;
      }
      toast.success('Product deactivated (has existing orders)');
      loadData();
      return;
    }
    
    await supabase.from('product_variations').delete().eq('product_id', productId);
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      toast.error('Failed to delete product');
      return;
    }
    toast.success('Product deleted!');
    loadData();
  };

  const handleOpenVariations = async (product: any) => {
    setSelectedProductForVariations(product);
    const { data: varData } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: true });
    setProductVariations(varData || []);
    setShowVariationsModal(true);
  };

  const handleAddVariation = async () => {
    if (!newVariation.name || !newVariation.price || !selectedProductForVariations) {
      toast.error('Please fill variation name and price');
      return;
    }
    
    await supabase.from('product_variations').insert({
      product_id: selectedProductForVariations.id,
      name: newVariation.name,
      price: parseFloat(newVariation.price)
    });

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
    
    await supabase.from('banners').insert({
      title: bannerForm.title,
      image_url: bannerForm.image_url,
      link: bannerForm.link || null,
      is_active: bannerForm.is_active,
      sort_order: data.banners.length
    });
    
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
    
    await supabase.from('flash_sales').insert({
      product_id: flashSaleForm.product_id,
      sale_price: parseFloat(flashSaleForm.sale_price),
      start_time: flashSaleForm.start_time || new Date().toISOString(),
      end_time: flashSaleForm.end_time,
      is_active: flashSaleForm.is_active
    });
    
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
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setData({ ...data, settings: { ...data.settings, [key]: value } });
    toast.success('Setting updated!');
  };

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
      <header className="bg-gradient-to-r from-primary/10 via-background to-accent/10 sticky top-0 z-50 px-4 py-3 border-b border-border/50 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <motion.button 
            onClick={() => navigate('/')} 
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Admin Dashboard
            </h1>
            {isTempAdmin && tempAdminExpiry && (
              <p className="text-xs text-accent flex items-center gap-1">
                <Timer className="w-3 h-3" />
                Expires: {new Date(tempAdminExpiry).toLocaleString()}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="icon" 
                variant={alertsEnabled ? "default" : "outline"}
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                title={alertsEnabled ? "Alerts ON" : "Alerts OFF"}
                className="rounded-xl"
              >
                {alertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="sm" variant="outline" onClick={() => navigate('/chat')} className="rounded-xl">
                <MessageCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="px-4 max-w-5xl mx-auto mt-6">
        {/* Beautiful 2-Button Navigation */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('overview')}
            className={`relative overflow-hidden rounded-3xl p-6 transition-all ${
              activeTab === 'overview' 
                ? 'bg-gradient-to-br from-primary via-primary/90 to-accent shadow-lg shadow-primary/25' 
                : 'bg-card border border-border hover:border-primary/50 hover:shadow-md'
            }`}
          >
            <div className={`flex flex-col items-center gap-3 ${activeTab === 'overview' ? 'text-primary-foreground' : 'text-foreground'}`}>
              <div className={`p-4 rounded-2xl ${activeTab === 'overview' ? 'bg-white/20' : 'bg-primary/10'}`}>
                <TrendingUp className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">Analytics</h3>
                <p className={`text-sm mt-1 ${activeTab === 'overview' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  Overview & Reports
                </p>
              </div>
            </div>
            {activeTab === 'overview' && (
              <motion.div 
                layoutId="activeIndicator"
                className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent -z-10"
              />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('control')}
            className={`relative overflow-hidden rounded-3xl p-6 transition-all ${
              activeTab === 'control' 
                ? 'bg-gradient-to-br from-secondary via-secondary/90 to-accent shadow-lg shadow-secondary/25' 
                : 'bg-card border border-border hover:border-secondary/50 hover:shadow-md'
            }`}
          >
            <div className={`flex flex-col items-center gap-3 ${activeTab === 'control' ? 'text-secondary-foreground' : 'text-foreground'}`}>
              <div className={`p-4 rounded-2xl ${activeTab === 'control' ? 'bg-white/20' : 'bg-secondary/10'}`}>
                <Shield className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">Control</h3>
                <p className={`text-sm mt-1 ${activeTab === 'control' ? 'text-secondary-foreground/70' : 'text-muted-foreground'}`}>
                  Manage Everything
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Content Area */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AdminOverviewTab 
              stats={stats}
              data={data}
            />
          </motion.div>
        )}

        {activeTab === 'control' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AdminControlTab 
              data={data}
              stats={stats}
              isAdmin={isAdmin}
              onShowAnnouncementModal={() => setShowAnnouncementModal(true)}
              onShowTempAdminModal={() => setShowTempAdminModal(true)}
              onRemoveTempAdmin={handleRemoveTempAdmin}
              onSelectUser={(user) => {
                setSelectedUser(user);
                setShowUserModal(true);
              }}
              onSelectOrder={(order) => {
                setSelectedOrder(order);
                setAdminNote(order.admin_note || '');
                setAccessLink(order.access_link || '');
                setShowOrderModal(true);
              }}
              onAddProduct={() => setShowProductModal(true)}
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              onOpenVariations={handleOpenVariations}
              onShowBannerModal={() => setShowBannerModal(true)}
              onShowFlashSaleModal={() => setShowFlashSaleModal(true)}
              onDeleteBanner={handleDeleteBanner}
              onToggleBanner={handleToggleBanner}
              onDeleteFlashSale={handleDeleteFlashSale}
              onUpdateSetting={handleUpdateSetting}
              onDataChange={loadData}
            />
          </motion.div>
        )}
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
                <p><strong>Rank Balance:</strong> ₹{selectedUser.rank_balance || 0}</p>
              </div>

              <div className="flex gap-2">
                {!selectedUser.has_blue_check && (
                  <Button onClick={() => handleGiftBlueTick(selectedUser.id)} className="flex-1 btn-gradient">
                    <Award className="w-4 h-4 mr-2" />
                    Gift Blue Tick
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => navigate('/chat')}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">💼 Reseller Status</span>
                  {selectedUser.is_reseller && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>
                  )}
                </div>
                <Switch 
                  checked={selectedUser.is_reseller || false}
                  onCheckedChange={async (checked) => {
                    await supabase.from('profiles').update({ is_reseller: checked }).eq('id', selectedUser.id);
                    toast.success(checked ? 'User is now a Reseller!' : 'Reseller status removed');
                    setSelectedUser({ ...selectedUser, is_reseller: checked });
                    loadData();
                  }}
                />
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

              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const { data: existingRole } = await supabase
                    .from('user_roles')
                    .select('id')
                    .eq('user_id', selectedUser.id)
                    .eq('role', 'seller')
                    .maybeSingle();

                  if (existingRole) {
                    await supabase.from('user_roles').delete().eq('id', existingRole.id);
                    toast.success('Seller role removed');
                  } else {
                    await supabase.from('user_roles').insert({ user_id: selectedUser.id, role: 'seller' });
                    toast.success('User is now a seller!');
                  }
                  setShowUserModal(false);
                  loadData();
                }}
              >
                <Shield className="w-4 h-4 mr-2" />
                Toggle Seller Role
              </Button>

              {isAdmin && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    if (!confirm(`Are you sure you want to delete ${selectedUser.name}?`)) return;
                    
                    await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
                    await supabase.from('notifications').delete().eq('user_id', selectedUser.id);
                    await supabase.from('transactions').delete().eq('user_id', selectedUser.id);
                    await supabase.from('orders').delete().eq('user_id', selectedUser.id);
                    await supabase.from('profiles').delete().eq('id', selectedUser.id);
                    
                    toast.success('User deleted');
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
              
              <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
                <p className="font-medium">Customer Details:</p>
                <p>Name: {selectedOrder.profiles?.name}</p>
                <p>Email: {selectedOrder.profiles?.email}</p>
                <p>Phone: {selectedOrder.profiles?.phone || 'N/A'}</p>
              </div>

              {selectedOrder.user_note && (
                <div className="p-3 bg-primary/5 rounded-xl">
                  <p className="text-xs font-medium mb-1">Customer Note:</p>
                  <p className="text-sm">{selectedOrder.user_note}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium mb-1 block">Access Link</label>
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
                <Button variant="outline" onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'processing')}>
                  <Clock className="w-4 h-4 mr-2" />
                  Processing
                </Button>
                <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'completed')}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              </div>
              <Button variant="destructive" className="w-full" onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled')}>
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
            <Input type="email" placeholder="User email" value={tempAdminEmail} onChange={(e) => setTempAdminEmail(e.target.value)} />
            <Input type="number" placeholder="Duration (hours)" value={tempAdminHours} onChange={(e) => setTempAdminHours(e.target.value)} />
            <Button className="w-full btn-gradient" onClick={handleAddTempAdmin}>Add Temporary Admin</Button>
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
            <Input placeholder="Title" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
            <Textarea placeholder="Message" value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} rows={4} />
            <Button className="w-full btn-gradient" onClick={handleCreateAnnouncement}>
              <Bell className="w-4 h-4 mr-2" />
              Send Announcement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={(open) => {
        if (!open) resetProductForm();
        else setShowProductModal(open);
      }}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Product Name *" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} />
            <Textarea placeholder="Description" value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} rows={2} />
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Price *" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} />
              <Input type="number" placeholder="Original" value={productForm.original_price} onChange={(e) => setProductForm({...productForm, original_price: e.target.value})} />
              <Input type="number" placeholder="Reseller" value={productForm.reseller_price} onChange={(e) => setProductForm({...productForm, reseller_price: e.target.value})} />
            </div>
            <Select value={productForm.category} onValueChange={(value) => setProductForm({...productForm, category: value})}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {data.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Image URL" value={productForm.image_url} onChange={(e) => setProductForm({...productForm, image_url: e.target.value})} />
            <Input placeholder="Access Link (Optional)" value={productForm.access_link} onChange={(e) => setProductForm({...productForm, access_link: e.target.value})} />
            <Input type="number" placeholder="Stock (empty=unlimited)" value={productForm.stock} onChange={(e) => setProductForm({...productForm, stock: e.target.value})} />
            <div className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch checked={productForm.is_active} onCheckedChange={(v) => setProductForm({...productForm, is_active: v})} />
            </div>
            
            {/* Variations Section */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Variations (Optional)
              </h4>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {quickVariationTemplates.map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
                    onClick={() => {
                      if (editingProduct) {
                        supabase.from('product_variations').insert({
                          product_id: editingProduct.id,
                          name: template.name,
                          price: parseFloat(template.price)
                        }).then(() => {
                          supabase.from('product_variations')
                            .select('*')
                            .eq('product_id', editingProduct.id)
                            .order('created_at', { ascending: true })
                            .then(({ data: varData }) => setExistingVariations(varData || []));
                          toast.success(`${template.name} added!`);
                        });
                      } else {
                        setPendingVariations([...pendingVariations, { ...template }]);
                      }
                    }}
                  >
                    + {template.name}
                  </button>
                ))}
              </div>
              
              {existingVariations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {existingVariations.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-2 bg-muted rounded-xl">
                      <span className="text-sm">{v.name} - ₹{v.price}</span>
                      <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDeleteModalVariation(v.id, true)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {pendingVariations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {pendingVariations.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-accent/10 rounded-xl">
                      <span className="text-sm">{v.name} - ₹{v.price}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleDeleteModalVariation(idx.toString(), false)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={newModalVariation.name} onChange={(e) => setNewModalVariation({...newModalVariation, name: e.target.value})} />
                <Input type="number" placeholder="Price" value={newModalVariation.price} onChange={(e) => setNewModalVariation({...newModalVariation, price: e.target.value})} />
              </div>
              <div className="flex gap-2 mt-2">
                <Input type="number" placeholder="Reseller Price" value={newModalVariation.reseller_price} onChange={(e) => setNewModalVariation({...newModalVariation, reseller_price: e.target.value})} />
                <Button onClick={handleAddModalVariation}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
            </div>
            
            <Button className="w-full btn-gradient" onClick={editingProduct ? handleUpdateProduct : handleAddProduct}>
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Banner Modal */}
      <Dialog open={showBannerModal} onOpenChange={setShowBannerModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Banner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Banner Title *" value={bannerForm.title} onChange={(e) => setBannerForm({...bannerForm, title: e.target.value})} />
            <Input placeholder="Image URL *" value={bannerForm.image_url} onChange={(e) => setBannerForm({...bannerForm, image_url: e.target.value})} />
            <Input placeholder="Link (Optional)" value={bannerForm.link} onChange={(e) => setBannerForm({...bannerForm, link: e.target.value})} />
            <div className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch checked={bannerForm.is_active} onCheckedChange={(v) => setBannerForm({...bannerForm, is_active: v})} />
            </div>
            <Button className="w-full btn-gradient" onClick={handleAddBanner}>Add Banner</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Flash Sale Modal */}
      <FlashSaleModal
        open={showFlashSaleModal}
        onOpenChange={setShowFlashSaleModal}
        products={data.products}
        onRefresh={loadData}
      />
      
      {/* Variations Modal */}
      <VariationsModal
        open={showVariationsModal}
        onOpenChange={setShowVariationsModal}
        product={selectedProductForVariations}
      />
    </div>
  );
};

export default AdminPage;
