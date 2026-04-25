import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, UserPlus, ShoppingBag, MessageCircle,
  Image, CreditCard, Users, Package, Shield, ChevronDown,
  Zap, Wallet, Ticket, Gift, FolderOpen, Award, Bot, SmilePlus, Mail, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminData, AdminStats } from '@/hooks/useAdminData';
import AdminChatPanel from '@/components/AdminChatPanel';
import AdminPaymentSettings from '@/components/AdminPaymentSettings';
import AdminSettingsTab from './AdminSettingsTab';
import DepositRequestsSection from './DepositRequestsSection';
import WithdrawalRequestsSection from './WithdrawalRequestsSection';
import AdminCouponManager from './AdminCouponManager';
import AdminRedeemCodeManager from './AdminRedeemCodeManager';
import AdminCategoryManager from '@/components/AdminCategoryManager';
import {
  AdminOrdersSection,
  AdminUsersSection,
  AdminProductsSection,
  AdminBlueTickSection,
  AdminContentSection,
} from './sections';
import AdminBotTabs from './AdminBotTabs';
import AdminCartMessagesManager from './AdminCartMessagesManager';
import AdminEmailBroadcast from './AdminEmailBroadcast';

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

type ControlSection = 'orders' | 'deposits' | 'withdrawals' | 'users' | 'products' | 'categories' | 'content' | 'coupons' | 'redeem' | 'payments' | 'chat' | 'bluetick' | 'telegram_bot' | 'cart_messages' | 'email_broadcast' | null;

const AdminControlTab: React.FC<AdminControlTabProps> = (props) => {
  const {
    data, stats, isAdmin,
    onShowAnnouncementModal, onShowTempAdminModal, onRemoveTempAdmin,
    onSelectUser, onSelectOrder,
    onAddProduct, onEditProduct, onDeleteProduct,
    onShowBannerModal, onShowFlashSaleModal,
    onDeleteBanner, onToggleBanner, onDeleteFlashSale,
    onUpdateSetting, onDataChange
  } = props;

  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ControlSection>(null);
  const [activeGroup, setActiveGroup] = useState<number>(0);
  const [orderFilter, setOrderFilter] = useState('all');

  const pendingOrders = data.orders.filter(o => o.status === 'pending').length;
  const pendingDeposits = data.depositRequests?.filter(r => r.status === 'pending').length || 0;

  const transactionGroup = [
    { id: 'orders' as ControlSection, icon: ShoppingBag, label: 'Orders', description: `${pendingOrders} pending`, color: 'bg-gradient-to-br from-orange-500 to-amber-500', badge: pendingOrders > 0 ? pendingOrders : null },
    { id: 'deposits' as ControlSection, icon: Wallet, label: 'Deposit Requests', description: `${pendingDeposits} pending`, color: 'bg-gradient-to-br from-emerald-500 to-green-500', badge: pendingDeposits > 0 ? pendingDeposits : null },
    { id: 'withdrawals' as ControlSection, icon: Wallet, label: 'Withdrawals', description: 'Withdrawal requests', color: 'bg-gradient-to-br from-red-500 to-orange-500', badge: null },
    { id: 'payments' as ControlSection, icon: CreditCard, label: 'Payments', description: 'Payment settings', color: 'bg-gradient-to-br from-indigo-500 to-violet-500', badge: null },
  ];

  const managementGroup = [
    { id: 'users' as ControlSection, icon: Users, label: 'Users', description: `${data.users.length} total`, color: 'bg-gradient-to-br from-blue-500 to-cyan-500', badge: null },
    { id: 'products' as ControlSection, icon: Package, label: 'Products', description: `${data.products.length} items`, color: 'bg-gradient-to-br from-purple-500 to-pink-500', badge: null },
    { id: 'categories' as ControlSection, icon: FolderOpen, label: 'Categories', description: 'Manage categories', color: 'bg-gradient-to-br from-amber-500 to-orange-500', badge: null },
    { id: 'content' as ControlSection, icon: Image, label: 'Content', description: 'Banners & Sales', color: 'bg-gradient-to-br from-green-500 to-emerald-500', badge: null },
    { id: 'bluetick' as ControlSection, icon: Award, label: 'Blue Tick', description: 'Manage verified badges', color: 'bg-gradient-to-br from-sky-500 to-blue-600', badge: null },
  ];

  const marketingGroup = [
    { id: 'coupons' as ControlSection, icon: Ticket, label: 'Coupons', description: 'Discount coupons', color: 'bg-gradient-to-br from-pink-500 to-rose-500', badge: null },
    { id: 'redeem' as ControlSection, icon: Gift, label: 'Redeem Codes', description: 'Gift codes for wallet', color: 'bg-gradient-to-br from-amber-500 to-yellow-500', badge: null },
    { id: 'cart_messages' as ControlSection, icon: SmilePlus, label: 'Cart Messages', description: 'Empty cart fun messages', color: 'bg-gradient-to-br from-fuchsia-500 to-purple-500', badge: null },
    { id: 'chat' as ControlSection, icon: MessageCircle, label: 'Messages', description: 'Customer support', color: 'bg-gradient-to-br from-teal-500 to-cyan-500', badge: null },
    { id: 'telegram_bot' as ControlSection, icon: Bot, label: 'Telegram Bot', description: 'Manage selling bot', color: 'bg-gradient-to-br from-blue-500 to-sky-500', badge: null },
    { id: 'email_broadcast' as ControlSection, icon: Send, label: 'Email Broadcast', description: 'Send email to users', color: 'bg-gradient-to-br from-violet-500 to-fuchsia-600', badge: null },
    { id: 'email_logs' as any as ControlSection, icon: Mail, label: 'Email Logs', description: 'Delivery status & errors', color: 'bg-gradient-to-br from-rose-500 to-red-600', badge: null, link: '/admin/email-logs' },
  ];

  const sectionGroups = [
    { title: 'Transactions', icon: CreditCard, sections: transactionGroup },
    { title: 'Management', icon: Users, sections: managementGroup },
    { title: 'Marketing & Support', icon: Ticket, sections: marketingGroup },
    ...(isAdmin ? [{ title: 'Administration', icon: Shield, sections: [] as typeof transactionGroup }] : []),
  ];

  const toggleSection = (section: ControlSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const renderSectionContent = (sectionId: ControlSection) => {
    switch (sectionId) {
      case 'orders':
        return <AdminOrdersSection orders={data.orders} orderFilter={orderFilter} onOrderFilterChange={setOrderFilter} onSelectOrder={onSelectOrder} />;
      case 'deposits':
        return <DepositRequestsSection depositRequests={data.depositRequests || []} onDataChange={onDataChange} />;
      case 'withdrawals':
        return <WithdrawalRequestsSection onDataChange={onDataChange} />;
      case 'payments':
        return <AdminPaymentSettings />;
      case 'users':
        return <AdminUsersSection users={data.users} onSelectUser={onSelectUser} onDataChange={onDataChange} />;
      case 'products':
        return <AdminProductsSection products={data.products} onAddProduct={onAddProduct} onEditProduct={onEditProduct} onDeleteProduct={onDeleteProduct} onDataChange={onDataChange} />;
      case 'categories':
        return <AdminCategoryManager products={data.products} onCategoryChange={onDataChange} />;
      case 'bluetick':
        return <AdminBlueTickSection users={data.users} settings={data.settings} onDataChange={onDataChange} />;
      case 'content':
        return <AdminContentSection banners={data.banners} flashSales={data.flashSales} onShowBannerModal={onShowBannerModal} onShowFlashSaleModal={onShowFlashSaleModal} onShowAnnouncementModal={onShowAnnouncementModal} onDeleteBanner={onDeleteBanner} onToggleBanner={onToggleBanner} onDeleteFlashSale={onDeleteFlashSale} />;
      case 'coupons':
        return <AdminCouponManager />;
      case 'redeem':
        return <AdminRedeemCodeManager />;
      case 'chat':
        return <AdminChatPanel />;
      case 'cart_messages':
        return <AdminCartMessagesManager />;
      case 'telegram_bot':
        return <AdminBotTabs />;
      case 'email_broadcast':
        return <AdminEmailBroadcast />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Control Center</h2>
          <p className="text-sm text-muted-foreground">Manage your entire store</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onShowAnnouncementModal} className="rounded-xl">
            <Bell className="w-4 h-4 mr-2" />Announce
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={onShowTempAdminModal} className="rounded-xl">
              <UserPlus className="w-4 h-4 mr-2" />Temp Admin
            </Button>
          )}
        </div>
      </div>

      {/* Group Selector */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          {sectionGroups.map((group, index) => (
            <motion.button
              key={group.title}
              onClick={() => { setActiveGroup(index); setActiveSection(null); }}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl min-w-[80px] transition-all ${
                activeGroup === index
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                  : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}
            >
              <div className={`p-3 rounded-xl ${activeGroup === index ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                <group.icon className={`w-6 h-6 ${activeGroup === index ? 'text-primary-foreground' : 'text-primary'}`} />
              </div>
              <span className="text-xs font-medium text-center leading-tight max-w-[70px]">{group.title}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          {sectionGroups[activeGroup] && (
            <>
              {React.createElement(sectionGroups[activeGroup].icon, { className: "w-4 h-4 text-primary" })}
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{sectionGroups[activeGroup].title}</h3>
              <div className="flex-1 h-px bg-border ml-2" />
            </>
          )}
        </div>

        <div className="space-y-2">
          {sectionGroups[activeGroup]?.sections.map((section) => (
            <motion.div key={section.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <button onClick={() => (section as any).link ? navigate((section as any).link) : toggleSection(section.id)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl text-white ${section.color}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{section.label}</h3>
                      {section.badge && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full animate-pulse">{section.badge}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                <motion.div animate={{ rotate: activeSection === section.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </button>

              <AnimatePresence>
                {activeSection === section.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="border-t border-border">
                    <div className="p-4">{renderSectionContent(section.id)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Administration - Settings rendered directly */}
        {isAdmin && sectionGroups[activeGroup]?.title === 'Administration' && (
          <AdminSettingsTab settings={data.settings} onUpdateSetting={onUpdateSetting} />
        )}
      </div>

      {/* Temp Admins */}
      {isAdmin && data.tempAdmins.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
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
                <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => onRemoveTempAdmin(ta.user_id)}>Remove</Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminControlTab;
