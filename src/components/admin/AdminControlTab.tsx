import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, UserPlus, ShoppingBag, MessageCircle, Settings, 
  Image, CreditCard, Users, Package, Shield, ChevronRight,
  ChevronDown, Search, Plus, Edit, Trash2, Tags, Award,
  Clock, CheckCircle, XCircle, Zap, Wallet, Ticket, Gift, Check, X, FolderOpen, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminData, AdminStats } from '@/hooks/useAdminData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import BlueTick from '@/components/BlueTick';
import AdminChatPanel from '@/components/AdminChatPanel';
import AdminPaymentSettings from '@/components/AdminPaymentSettings';
import AdminSettingsTab from './AdminSettingsTab';
import DepositRequestsSection from './DepositRequestsSection';
import AdminCouponManager from './AdminCouponManager';
import AdminRedeemCodeManager from './AdminRedeemCodeManager';
import AdminCategoryManager from '@/components/AdminCategoryManager';

interface AdminControlTabProps {
  data: AdminData;
  stats: AdminStats;
  isAdmin: boolean;
  onShowAnnouncementModal: () => void;
  onShowTempAdminModal: () => void;
  onRemoveTempAdmin: (userId: string) => void;
  onSelectUser: (user: any) => void;
  onSelectOrder: (order: any) => void;
  onAddProduct: () => void;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (productId: string) => void;
  onOpenVariations: (product: any) => void;
  onShowBannerModal: () => void;
  onShowFlashSaleModal: () => void;
  onDeleteBanner: (bannerId: string) => void;
  onToggleBanner: (bannerId: string, isActive: boolean) => void;
  onDeleteFlashSale: (saleId: string) => void;
  onUpdateSetting: (key: string, value: string) => void;
  onDataChange: () => void;
}

type ControlSection = 'orders' | 'deposits' | 'users' | 'products' | 'categories' | 'content' | 'coupons' | 'redeem' | 'payments' | 'chat' | 'settings' | 'bluetick' | null;

const AdminControlTab: React.FC<AdminControlTabProps> = ({
  data,
  stats,
  isAdmin,
  onShowAnnouncementModal,
  onShowTempAdminModal,
  onRemoveTempAdmin,
  onSelectUser,
  onSelectOrder,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onOpenVariations,
  onShowBannerModal,
  onShowFlashSaleModal,
  onDeleteBanner,
  onToggleBanner,
  onDeleteFlashSale,
  onUpdateSetting,
  onDataChange
}) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ControlSection>(null);
  const [activeGroup, setActiveGroup] = useState<number>(0);
  const [userSearch, setUserSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState('');
  const [seoProduct, setSeoProduct] = useState<any>(null);
  const [seoTags, setSeoTags] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);
  const [blueTickSearch, setBlueTickSearch] = useState('');
  const [blueTickPrice, setBlueTickPrice] = useState('');
  const [savingBTPrice, setSavingBTPrice] = useState(false);

  const handleSaveSeo = async () => {
    if (!seoProduct) return;
    setSavingSeo(true);
    const { error } = await supabase
      .from('products')
      .update({ seo_tags: seoTags.trim() || null })
      .eq('id', seoProduct.id);
    setSavingSeo(false);
    if (error) {
      toast.error('Failed to save SEO tags');
      return;
    }
    toast.success('SEO tags updated!');
    setSeoProduct(null);
    onDataChange();
  };

  const handleInlineBalanceSave = async (user: any) => {
    const newBalance = parseFloat(editBalanceValue);
    if (isNaN(newBalance) || newBalance < 0) {
      toast.error('Invalid balance');
      return;
    }
    const oldBalance = user.wallet_balance || 0;
    const diff = newBalance - oldBalance;

    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update balance');
      return;
    }

    if (diff !== 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: diff > 0 ? 'admin_credit' : 'admin_debit',
        amount: Math.abs(diff),
        status: 'completed',
        description: `Admin balance adjustment: ₹${oldBalance} → ₹${newBalance}`
      });
    }

    toast.success(`Balance updated to ₹${newBalance}`);
    setEditingBalanceId(null);
    setEditBalanceValue('');
    onDataChange();
  };

  const pendingOrders = data.orders.filter(o => o.status === 'pending').length;
  const pendingDeposits = data.depositRequests?.filter(r => r.status === 'pending').length || 0;

  // Group 1: Orders, Deposits, Payments
  const transactionGroup = [
    { 
      id: 'orders' as ControlSection, 
      icon: ShoppingBag, 
      label: 'Orders', 
      description: `${pendingOrders} pending`,
      color: 'bg-gradient-to-br from-orange-500 to-amber-500',
      badge: pendingOrders > 0 ? pendingOrders : null
    },
    { 
      id: 'deposits' as ControlSection, 
      icon: Wallet, 
      label: 'Deposit Requests', 
      description: `${pendingDeposits} pending`,
      color: 'bg-gradient-to-br from-emerald-500 to-green-500',
      badge: pendingDeposits > 0 ? pendingDeposits : null
    },
    { 
      id: 'payments' as ControlSection, 
      icon: CreditCard, 
      label: 'Payments', 
      description: 'Payment settings',
      color: 'bg-gradient-to-br from-indigo-500 to-violet-500',
      badge: null
    },
  ];

  // Group 2: Users, Products, Content
  const managementGroup = [
    { 
      id: 'users' as ControlSection, 
      icon: Users, 
      label: 'Users', 
      description: `${data.users.length} total`,
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
      badge: null
    },
    { 
      id: 'products' as ControlSection, 
      icon: Package, 
      label: 'Products', 
      description: `${data.products.length} items`,
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      badge: null
    },
    { 
      id: 'categories' as ControlSection, 
      icon: FolderOpen, 
      label: 'Categories', 
      description: 'Manage categories',
      color: 'bg-gradient-to-br from-amber-500 to-orange-500',
      badge: null
    },
    { 
      id: 'content' as ControlSection, 
      icon: Image, 
      label: 'Content', 
      description: 'Banners & Sales',
      color: 'bg-gradient-to-br from-green-500 to-emerald-500',
      badge: null
    },
    { 
      id: 'bluetick' as ControlSection, 
      icon: Award, 
      label: 'Blue Tick', 
      description: 'Manage verified badges',
      color: 'bg-gradient-to-br from-sky-500 to-blue-600',
      badge: null
    },
  ];

  // Group 3: Coupons, Redeem Codes, Messages
  const marketingGroup = [
    { 
      id: 'coupons' as ControlSection, 
      icon: Ticket, 
      label: 'Coupons', 
      description: 'Discount coupons',
      color: 'bg-gradient-to-br from-pink-500 to-rose-500',
      badge: null
    },
    { 
      id: 'redeem' as ControlSection, 
      icon: Gift, 
      label: 'Redeem Codes', 
      description: 'Gift codes for wallet',
      color: 'bg-gradient-to-br from-amber-500 to-yellow-500',
      badge: null
    },
    { 
      id: 'chat' as ControlSection, 
      icon: MessageCircle, 
      label: 'Messages', 
      description: 'Customer support',
      color: 'bg-gradient-to-br from-teal-500 to-cyan-500',
      badge: null
    },
  ];

  // Group 4: Settings, Temp Admins (admin only)
  const adminGroup = isAdmin ? [
    { 
      id: 'settings' as ControlSection, 
      icon: Settings, 
      label: 'Settings', 
      description: 'App configuration',
      color: 'bg-gradient-to-br from-slate-500 to-gray-600',
      badge: null
    },
  ] : [];

  const sectionGroups = [
    { title: 'Transactions', icon: CreditCard, sections: transactionGroup },
    { title: 'Management', icon: Users, sections: managementGroup },
    { title: 'Marketing & Support', icon: Ticket, sections: marketingGroup },
    ...(isAdmin ? [{ title: 'Administration', icon: Shield, sections: adminGroup }] : []),
  ];

  const allSections = [...transactionGroup, ...managementGroup, ...marketingGroup, ...adminGroup];

  const filteredUsers = data.users.filter(u => 
    userSearch === '' || 
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredOrders = data.orders.filter(o => 
    orderFilter === 'all' || o.status === orderFilter
  );

  const filteredProducts = data.products.filter(p =>
    productSearch === '' ||
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const toggleSection = (section: ControlSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Control Center</h2>
          <p className="text-sm text-muted-foreground">Manage your entire store</p>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={onShowAnnouncementModal}
            className="rounded-xl"
          >
            <Bell className="w-4 h-4 mr-2" />
            Announce
          </Button>
          {isAdmin && (
            <Button 
              size="sm"
              onClick={onShowTempAdminModal}
              className="rounded-xl"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Temp Admin
            </Button>
          )}
        </div>
      </div>

      {/* Horizontal Group Selector - Category Style */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          {sectionGroups.map((group, index) => (
            <motion.button
              key={group.title}
              onClick={() => {
                setActiveGroup(index);
                setActiveSection(null);
              }}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl min-w-[80px] transition-all ${
                activeGroup === index
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                  : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}
            >
              <div className={`p-3 rounded-xl ${
                activeGroup === index 
                  ? 'bg-primary-foreground/20' 
                  : 'bg-muted'
              }`}>
                <group.icon className={`w-6 h-6 ${
                  activeGroup === index ? 'text-primary-foreground' : 'text-primary'
                }`} />
              </div>
              <span className="text-xs font-medium text-center leading-tight max-w-[70px]">
                {group.title}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Selected Group Sections */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          {sectionGroups[activeGroup] && (
            <>
              {React.createElement(sectionGroups[activeGroup].icon, { className: "w-4 h-4 text-primary" })}
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {sectionGroups[activeGroup].title}
              </h3>
              <div className="flex-1 h-px bg-border ml-2" />
            </>
          )}
        </div>

        {/* Group Sections */}
        <div className="space-y-2">
          {sectionGroups[activeGroup]?.sections.map((section) => (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl text-white ${section.color}`}>
                        <section.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{section.label}</h3>
                          {section.badge && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full animate-pulse">
                              {section.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{section.description}</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: activeSection === section.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </button>

                  {/* Section Content */}
                  <AnimatePresence>
                    {activeSection === section.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-border"
                      >
                        <div className="p-4">
                          {/* Orders Section */}
                          {section.id === 'orders' && (
                            <div className="space-y-4">
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {['all', 'pending', 'processing', 'completed', 'cancelled'].map(status => (
                                  <button
                                    key={status}
                                    onClick={() => setOrderFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                      orderFilter === status 
                                        ? 'bg-primary text-primary-foreground' 
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                  >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                {filteredOrders.slice(0, 10).map((order: any) => (
                                  <div
                                    key={order.id}
                                    onClick={() => onSelectOrder(order)}
                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                                  >
                                    <img src={order.product_image || '/placeholder.svg'} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground text-sm truncate">{order.product_name}</p>
                                      <p className="text-xs text-muted-foreground">{order.profiles?.name}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-foreground">₹{order.total_price}</p>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        order.status === 'completed' ? 'bg-success/10 text-success' :
                                        order.status === 'pending' ? 'bg-warning/10 text-warning' :
                                        order.status === 'processing' ? 'bg-primary/10 text-primary' :
                                        'bg-destructive/10 text-destructive'
                                      }`}>
                                        {order.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {filteredOrders.length === 0 && (
                                  <p className="text-center text-muted-foreground py-4">No orders found</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Deposits Section */}
                          {section.id === 'deposits' && (
                            <DepositRequestsSection 
                              depositRequests={data.depositRequests || []}
                              onDataChange={onDataChange}
                            />
                          )}

                          {/* Payments Section */}
                          {section.id === 'payments' && (
                            <AdminPaymentSettings />
                          )}

                          {/* Users Section */}
                          {section.id === 'users' && (
                            <div className="space-y-4">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Search users..."
                                  value={userSearch}
                                  onChange={(e) => setUserSearch(e.target.value)}
                                  className="pl-10 rounded-xl"
                                />
                              </div>
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                {filteredUsers.slice(0, 15).map((user: any) => (
                                  <div
                                    key={user.id}
                                    onClick={() => onSelectUser(user)}
                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-bold">
                                      {(user.name || 'U')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1">
                                        <p className="font-medium text-foreground text-sm truncate">{user.name}</p>
                                        {user.has_blue_check && <BlueTick />}
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                                      {editingBalanceId === user.id ? (
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="number"
                                            value={editBalanceValue}
                                            onChange={(e) => setEditBalanceValue(e.target.value)}
                                            className="h-6 w-16 text-xs px-1"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleInlineBalanceSave(user);
                                              if (e.key === 'Escape') setEditingBalanceId(null);
                                            }}
                                          />
                                          <button onClick={() => handleInlineBalanceSave(user)} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => setEditingBalanceId(null)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                      ) : (
                                        <p
                                          className="font-bold text-foreground text-sm cursor-pointer hover:text-primary hover:underline transition-colors"
                                          onClick={() => { setEditingBalanceId(user.id); setEditBalanceValue(String(user.wallet_balance || 0)); }}
                                          title="Click to edit balance"
                                        >
                                          ₹{user.wallet_balance || 0}
                                        </p>
                                      )}
                                      <p className="text-xs text-muted-foreground">{user.total_orders || 0} orders</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Products Section */}
                          {section.id === 'products' && (
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search products..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="pl-10 rounded-xl"
                                  />
                                </div>
                                <Button onClick={onAddProduct} className="rounded-xl">
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add
                                </Button>
                              </div>
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                {filteredProducts.map((product: any) => (
                                  <div
                                    key={product.id}
                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
                                  >
                                    <img src={product.image_url || '/placeholder.svg'} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                                      <p className="text-xs text-muted-foreground">{product.category}</p>
                                    </div>
                                    <div className="text-right mr-2">
                                      <p className="font-bold text-foreground">₹{product.price}</p>
                                      <p className="text-xs text-muted-foreground">Stock: {product.stock ?? '∞'}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button size="icon" variant="ghost" onClick={() => onEditProduct(product)} className="h-8 w-8">
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => { setSeoProduct(product); setSeoTags(product.seo_tags || ''); }} className="h-8 w-8" title="SEO Tags">
                                        <Tags className="w-4 h-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => onDeleteProduct(product.id)} className="h-8 w-8 text-destructive">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Categories Section */}
                          {section.id === 'categories' && (
                            <AdminCategoryManager products={data.products} onCategoryChange={onDataChange} />
                          )}

                          {/* Blue Tick Section */}
                          {section.id === 'bluetick' && (
                            <div className="space-y-4">
                              {/* Set Blue Tick Price */}
                              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-primary" />
                                  Blue Tick Purchase Price
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  ইউজাররা এই প্রাইসে ওয়ালেট থেকে Blue Tick কিনতে পারবে। 0 দিলে purchase অপশন বন্ধ হবে।
                                </p>
                                <div className="flex gap-2">
                                  <div className="flex items-center gap-1 flex-1">
                                    <span className="text-sm text-muted-foreground">₹</span>
                                    <Input
                                      type="number"
                                      placeholder={data.settings?.blue_tick_price || '0'}
                                      value={blueTickPrice}
                                      onChange={(e) => setBlueTickPrice(e.target.value)}
                                      className="rounded-xl"
                                    />
                                  </div>
                                  <Button
                                    disabled={savingBTPrice || !blueTickPrice}
                                    className="rounded-xl"
                                    onClick={async () => {
                                      setSavingBTPrice(true);
                                      await supabase.from('app_settings').upsert(
                                        { key: 'blue_tick_price', value: blueTickPrice, updated_at: new Date().toISOString() },
                                        { onConflict: 'key' }
                                      );
                                      toast.success(`Blue Tick price set to ₹${blueTickPrice}`);
                                      setBlueTickPrice('');
                                      setSavingBTPrice(false);
                                      onDataChange();
                                    }}
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Current price: <span className="font-semibold text-foreground">₹{data.settings?.blue_tick_price || '0 (disabled)'}</span>
                                </p>
                              </div>

                              {/* Search & Gift Blue Tick */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                  <Gift className="w-4 h-4 text-accent" />
                                  Gift Blue Tick to User
                                </h4>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search user to gift blue tick..."
                                    value={blueTickSearch}
                                    onChange={(e) => setBlueTickSearch(e.target.value)}
                                    className="pl-10 rounded-xl"
                                  />
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {data.users
                                    .filter(u => 
                                      blueTickSearch && (
                                        u.name?.toLowerCase().includes(blueTickSearch.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(blueTickSearch.toLowerCase())
                                      )
                                    )
                                    .slice(0, 10)
                                    .map((user: any) => (
                                      <div
                                        key={user.id}
                                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
                                      >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white">
                                          {(user.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1">
                                            <p className="font-medium text-foreground text-sm truncate">{user.name}</p>
                                            {user.has_blue_check && <BlueTick size="sm" />}
                                          </div>
                                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                        </div>
                                        {user.has_blue_check ? (
                                          <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded-full font-medium flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Verified
                                          </span>
                                        ) : (
                                          <Button
                                            size="sm"
                                            className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white"
                                            onClick={async () => {
                                              await supabase.from('profiles').update({ has_blue_check: true }).eq('id', user.id);
                                              await supabase.from('notifications').insert({
                                                user_id: user.id,
                                                title: 'Blue Tick Received! ✅',
                                                message: 'Congratulations! You have been gifted a verified Blue Tick badge!',
                                                type: 'reward'
                                              });
                                              toast.success(`Blue Tick gifted to ${user.name}!`);
                                              onDataChange();
                                            }}
                                          >
                                            <Award className="w-3.5 h-3.5 mr-1" />
                                            Gift
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  {blueTickSearch && data.users.filter(u => 
                                    u.name?.toLowerCase().includes(blueTickSearch.toLowerCase()) ||
                                    u.email?.toLowerCase().includes(blueTickSearch.toLowerCase())
                                  ).length === 0 && (
                                    <p className="text-center text-muted-foreground py-4 text-sm">No users found</p>
                                  )}
                                  {!blueTickSearch && (
                                    <p className="text-center text-muted-foreground py-4 text-sm">Search for a user above</p>
                                  )}
                                </div>
                              </div>

                              {/* Blue Tick Users List */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                  <BlueTick size="sm" />
                                  Verified Users ({data.users.filter(u => u.has_blue_check).length})
                                </h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {data.users.filter(u => u.has_blue_check).map((user: any) => (
                                    <div key={user.id} className="flex items-center gap-3 p-3 bg-sky-50 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-800">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white text-sm">
                                        {(user.name || 'U')[0].toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                                          {user.name} <BlueTick size="sm" />
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive h-7 text-xs"
                                        onClick={async () => {
                                          if (!confirm(`Remove Blue Tick from ${user.name}?`)) return;
                                          await supabase.from('profiles').update({ has_blue_check: false }).eq('id', user.id);
                                          toast.success(`Blue Tick removed from ${user.name}`);
                                          onDataChange();
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  ))}
                                  {data.users.filter(u => u.has_blue_check).length === 0 && (
                                    <p className="text-center text-muted-foreground py-4 text-sm">No verified users yet</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Content Section */}
                          {section.id === 'content' && (
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <Button onClick={onShowBannerModal} variant="outline" className="flex-1 rounded-xl">
                                  <Image className="w-4 h-4 mr-2" />
                                  Add Banner
                                </Button>
                                <Button onClick={onShowFlashSaleModal} variant="outline" className="flex-1 rounded-xl">
                                  <Zap className="w-4 h-4 mr-2" />
                                  Add Flash Sale
                                </Button>
                                <Button onClick={onShowAnnouncementModal} variant="outline" className="flex-1 rounded-xl">
                                  <Bell className="w-4 h-4 mr-2" />
                                  Announce
                                </Button>
                              </div>
                              
                              {/* Banners */}
                              <div>
                                <h4 className="font-semibold text-foreground mb-2">Banners ({data.banners.length})</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {data.banners.map((banner: any) => (
                                    <div key={banner.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                                      <img src={banner.image_url} alt="" className="w-16 h-10 rounded object-cover" />
                                      <p className="flex-1 text-sm font-medium truncate">{banner.title}</p>
                                      <Button size="sm" variant="ghost" onClick={() => onToggleBanner(banner.id, banner.is_active)}>
                                        {banner.is_active ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => onDeleteBanner(banner.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Flash Sales */}
                              <div>
                                <h4 className="font-semibold text-foreground mb-2">Flash Sales ({data.flashSales.length})</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {data.flashSales.map((sale: any) => (
                                    <div key={sale.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                      <div>
                                        <p className="text-sm font-medium">{sale.products?.name}</p>
                                        <p className="text-xs text-muted-foreground">₹{sale.sale_price}</p>
                                      </div>
                                      <Button size="sm" variant="ghost" onClick={() => onDeleteFlashSale(sale.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Coupons Section */}
                          {section.id === 'coupons' && (
                            <AdminCouponManager />
                          )}

                          {/* Redeem Codes Section */}
                          {section.id === 'redeem' && (
                            <AdminRedeemCodeManager />
                          )}

                          {/* Chat Section */}
                          {section.id === 'chat' && (
                            <AdminChatPanel />
                          )}

                          {/* Settings Section */}
                          {section.id === 'settings' && isAdmin && (
                            <AdminSettingsTab 
                              settings={data.settings}
                              onUpdateSetting={onUpdateSetting}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>

      {/* Temp Admins Section */}
      {isAdmin && data.tempAdmins.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Active Temp Admins ({data.tempAdmins.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {data.tempAdmins.map((ta: any) => (
              <div key={ta.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                    <span className="font-bold">{(ta.profiles?.name || 'U')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ta.profiles?.name || ta.profiles?.email}</p>
                    <p className="text-xs text-muted-foreground">Expires: {new Date(ta.temp_admin_expiry).toLocaleString()}</p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => onRemoveTempAdmin(ta.user_id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      {/* SEO Tags Modal */}
      <Dialog open={!!seoProduct} onOpenChange={(open) => !open && setSeoProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SEO Tags - {seoProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">কমা দিয়ে আলাদা করে ট্যাগ লিখুন (e.g. netflix, premium, ott)</p>
            <Textarea
              value={seoTags}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSeoTags(e.target.value)}
              placeholder="tag1, tag2, tag3..."
              rows={3}
            />
            <Button className="w-full" onClick={handleSaveSeo} disabled={savingSeo}>
              {savingSeo ? 'Saving...' : 'Save SEO Tags'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminControlTab;