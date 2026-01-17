import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, UserPlus, ShoppingBag, MessageCircle, Settings, 
  Image, CreditCard, Users, Package, Shield, ChevronRight,
  ChevronDown, Search, Plus, Edit, Trash2, Eye, Award,
  Clock, CheckCircle, XCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { AdminData, AdminStats } from '@/hooks/useAdminData';
import BlueTick from '@/components/BlueTick';
import AdminChatPanel from '@/components/AdminChatPanel';
import AdminPaymentSettings from '@/components/AdminPaymentSettings';
import AdminSettingsTab from './AdminSettingsTab';

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

type ControlSection = 'orders' | 'users' | 'products' | 'content' | 'payments' | 'chat' | 'settings' | null;

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
  const [userSearch, setUserSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');

  const pendingOrders = data.orders.filter(o => o.status === 'pending').length;

  const controlSections = [
    { 
      id: 'orders' as ControlSection, 
      icon: ShoppingBag, 
      label: 'Orders', 
      description: `${pendingOrders} pending`,
      color: 'bg-gradient-to-br from-orange-500 to-amber-500',
      badge: pendingOrders > 0 ? pendingOrders : null
    },
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
      id: 'content' as ControlSection, 
      icon: Image, 
      label: 'Content', 
      description: 'Banners & Sales',
      color: 'bg-gradient-to-br from-green-500 to-emerald-500',
      badge: null
    },
    { 
      id: 'payments' as ControlSection, 
      icon: CreditCard, 
      label: 'Payments', 
      description: 'Payment settings',
      color: 'bg-gradient-to-br from-indigo-500 to-violet-500',
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
    ...(isAdmin ? [{ 
      id: 'settings' as ControlSection, 
      icon: Settings, 
      label: 'Settings', 
      description: 'App configuration',
      color: 'bg-gradient-to-br from-slate-500 to-gray-600',
      badge: null
    }] : [])
  ];

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

      {/* Control Section Cards */}
      <div className="space-y-3">
        {controlSections.map((section) => (
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
                              <div className="text-right">
                                <p className="font-bold text-foreground text-sm">₹{user.wallet_balance || 0}</p>
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
                                <Button size="icon" variant="ghost" onClick={() => onOpenVariations(product)} className="h-8 w-8">
                                  <Eye className="w-4 h-4" />
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

                    {/* Payments Section */}
                    {section.id === 'payments' && (
                      <AdminPaymentSettings />
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
    </div>
  );
};

export default AdminControlTab;