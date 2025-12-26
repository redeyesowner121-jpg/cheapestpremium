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
  Timer
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
import { toast } from 'sonner';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin, tempAdminExpiry, profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [tempAdmins, setTempAdmins] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTempAdminModal, setShowTempAdminModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Form states
  const [giftAmount, setGiftAmount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [tempAdminEmail, setTempAdminEmail] = useState('');
  const [tempAdminHours, setTempAdminHours] = useState('24');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

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

    // Load orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    setOrders(ordersData || []);

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
        .select('*, profiles(name, email)')
        .eq('role', 'temp_admin');
      setTempAdmins(tempAdminsData || []);
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

  // User actions
  const handleGiftBlueTick = async (userId: string) => {
    await supabase.from('profiles').update({ has_blue_check: true }).eq('id', userId);
    toast.success('Blue Tick gifted!');
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
    await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', selectedUser.id);
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
    await supabase.from('orders').update({ 
      status, 
      admin_note: adminNote,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);

    // If cancelled/rejected, refund
    if (status === 'cancelled' || status === 'refunded') {
      const order = orders.find(o => o.id === orderId);
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

    await supabase.from('user_roles').upsert({
      user_id: user.id,
      role: 'temp_admin',
      temp_admin_expiry: expiryDate.toISOString()
    });

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

  // Settings update
  const handleUpdateSetting = async (key: string, value: string) => {
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    setSettings({ ...settings, [key]: value });
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar mb-4">
            <TabsTrigger value="dashboard" className="flex-1">Dashboard</TabsTrigger>
            <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1">Orders</TabsTrigger>
            <TabsTrigger value="products" className="flex-1">Products</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
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
                    <img src={order.product_image} alt="" className="w-12 h-12 rounded-lg object-cover" />
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
              <Input placeholder="Search users..." className="pl-12 h-12 rounded-xl" />
            </div>

            <div className="space-y-3">
              {users.map((user: any) => (
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
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Balance: ₹{user.wallet_balance || 0}</span>
                        <span>Deposit: ₹{user.total_deposit || 0}</span>
                        <span>Orders: {user.total_orders || 0}</span>
                      </div>
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
                  className="px-4 py-2 rounded-xl bg-muted text-sm font-medium whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {orders.map((order: any) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-2xl p-4 shadow-card"
                >
                  <div className="flex items-start gap-4">
                    <img src={order.product_image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{order.product_name}</p>
                      <p className="text-sm text-muted-foreground">{order.profiles?.name} - {order.profiles?.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Qty: {order.quantity} | Total: ₹{order.total_price}
                      </p>
                      {order.user_note && (
                        <p className="text-xs text-primary mt-1">Note: {order.user_note}</p>
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
            <Button className="w-full btn-gradient rounded-xl">
              <Plus className="w-5 h-5 mr-2" />
              Add New Product
            </Button>

            <div className="space-y-3">
              {products.map((product: any) => (
                <div key={product.id} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4">
                  <img src={product.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                    <p className="text-primary font-bold">₹{product.price}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline"><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Settings Tab (Only for main admin) */}
          {isAdmin && (
            <TabsContent value="settings" className="space-y-4">
              <div className="bg-card rounded-2xl p-4 shadow-card space-y-4">
                <h3 className="font-semibold text-foreground">App Settings</h3>
                
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <Input
                      value={value as string}
                      onChange={(e) => handleUpdateSetting(key, e.target.value)}
                      className="w-32 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-2xl p-4 shadow-card">
                <h3 className="font-semibold text-foreground mb-3">Banners</h3>
                <div className="space-y-2">
                  {banners.map((banner: any) => (
                    <div key={banner.id} className="flex items-center gap-3 p-2 bg-muted rounded-xl">
                      <img src={banner.image_url} alt="" className="w-20 h-10 rounded object-cover" />
                      <span className="flex-1 text-sm">{banner.title}</span>
                      <Switch checked={banner.is_active} />
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-3">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Banner
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* User Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-sm rounded-3xl">
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Manage Order</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={selectedOrder.product_image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <div>
                  <p className="font-semibold">{selectedOrder.product_name}</p>
                  <p className="text-sm text-muted-foreground">Qty: {selectedOrder.quantity}</p>
                  <p className="font-bold text-primary">₹{selectedOrder.total_price}</p>
                </div>
              </div>

              {selectedOrder.user_note && (
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-xs font-medium mb-1">Customer Note:</p>
                  <p className="text-sm">{selectedOrder.user_note}</p>
                </div>
              )}

              <Textarea
                placeholder="Add note for customer..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'completed')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled')}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel & Refund
                </Button>
              </div>
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
    </div>
  );
};

export default AdminPage;
