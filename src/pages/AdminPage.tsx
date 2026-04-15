import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminData } from '@/hooks/useAdminData';
import { useAdminOrderAlerts } from '@/hooks/useAdminOrderAlerts';
import { useAdminPageActions } from '@/hooks/admin/useAdminPageActions';
import {
  AdminOverviewTab,
  AdminControlTab,
} from '@/components/admin';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminNavigation from '@/components/admin/AdminNavigation';
import { FlashSaleModal, VariationsModal } from '@/components/admin/modals';
import AdminUserModal from '@/components/admin/modals/AdminUserModal';
import AdminOrderModal from '@/components/admin/modals/AdminOrderModal';
import AdminProductModal from '@/components/admin/modals/AdminProductModal';
import AdminBannerModal from '@/components/admin/modals/AdminBannerModal';
import AdminTempAdminModal from '@/components/admin/modals/AdminTempAdminModal';
import AdminAnnouncementModal from '@/components/admin/modals/AdminAnnouncementModal';

const VALID_TABS = ['overview', 'control'];

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin, tempAdminExpiry } = useAuth();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = VALID_TABS.includes(tab || '') ? tab! : 'overview';
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const { data, stats, loading, loadData, setData } = useAdminData(isAdmin, isTempAdmin);
  const actions = useAdminPageActions(loadData);

  // Modal states
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

  // Form states
  const [adminNote, setAdminNote] = useState('');
  const [accessLink, setAccessLink] = useState('');
  const [tempAdminEmail, setTempAdminEmail] = useState('');
  const [tempAdminHours, setTempAdminHours] = useState('24');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [bannerForm, setBannerForm] = useState({ title: '', image_url: '', link: '', is_active: true });

  // Product form
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', original_price: '', reseller_price: '',
    category: '', image_url: '', access_link: '', stock: '', is_active: true, button_style: 'primary',
    delivery_mode: 'repeated'
  });
  const [pendingVariations, setPendingVariations] = useState<any[]>([]);
  const [existingVariations, setExistingVariations] = useState<any[]>([]);
  const [newModalVariation, setNewModalVariation] = useState({ name: '', price: '', original_price: '', reseller_price: '' });

  useAdminOrderAlerts((isAdmin || isTempAdmin) && alertsEnabled, () => loadData());

  React.useEffect(() => {
    if (!isAdmin && !isTempAdmin) navigate('/');
  }, [isAdmin, isTempAdmin, navigate]);

  const resetProductForm = () => {
    setProductForm({ name: '', description: '', price: '', original_price: '', reseller_price: '', category: '', image_url: '', access_link: '', stock: '', is_active: true, button_style: 'primary', delivery_mode: 'repeated' });
    setPendingVariations([]);
    setNewModalVariation({ name: '', price: '', original_price: '', reseller_price: '' });
    setEditingProduct(null);
    setExistingVariations([]);
    setShowProductModal(false);
  };

  const handleEditProduct = async (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '', description: product.description || '',
      price: product.price?.toString() || '', original_price: product.original_price?.toString() || '',
      reseller_price: product.reseller_price?.toString() || '', category: product.category || '',
      image_url: product.image_url || '', access_link: product.access_link || '',
      stock: product.stock?.toString() || '', is_active: product.is_active !== false,
      button_style: product.button_style || 'primary',
      delivery_mode: product.delivery_mode || 'repeated'
    });
    const { data: varData } = await supabase.from('product_variations').select('*')
      .eq('product_id', product.id).order('created_at', { ascending: true });
    setExistingVariations(varData || []);
    setPendingVariations([]);
    setNewModalVariation({ name: '', price: '', original_price: '', reseller_price: '' });
    setShowProductModal(true);
  };

  const handleOpenVariations = async (product: any) => {
    setSelectedProductForVariations(product);
    setShowVariationsModal(true);
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
      <AdminHeader
        isTempAdmin={isTempAdmin}
        tempAdminExpiry={tempAdminExpiry}
        alertsEnabled={alertsEnabled}
        onToggleAlerts={() => setAlertsEnabled(!alertsEnabled)}
      />

      <main className="px-4 max-w-5xl mx-auto mt-6">
        <AdminNavigation activeTab={activeTab} onTabChange={(t) => navigate(`/admin/${t}`, { replace: true })} />

        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <AdminOverviewTab stats={stats} data={data} />
          </motion.div>
        )}

        {activeTab === 'control' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <AdminControlTab
              data={data} stats={stats} isAdmin={isAdmin}
              onShowAnnouncementModal={() => setShowAnnouncementModal(true)}
              onShowTempAdminModal={() => setShowTempAdminModal(true)}
              onRemoveTempAdmin={actions.handleRemoveTempAdmin}
              onSelectUser={(user) => { setSelectedUser(user); setShowUserModal(true); }}
              onSelectOrder={(order) => { setSelectedOrder(order); setAdminNote(order.admin_note || ''); setAccessLink(order.access_link || ''); setShowOrderModal(true); }}
              onAddProduct={() => setShowProductModal(true)}
              onEditProduct={handleEditProduct}
              onDeleteProduct={actions.handleDeleteProduct}
              onOpenVariations={handleOpenVariations}
              onShowBannerModal={() => setShowBannerModal(true)}
              onShowFlashSaleModal={() => setShowFlashSaleModal(true)}
              onDeleteBanner={actions.handleDeleteBanner}
              onToggleBanner={actions.handleToggleBanner}
              onDeleteFlashSale={actions.handleDeleteFlashSale}
              onUpdateSetting={(key, value) => actions.handleUpdateSetting(key, value, data, setData)}
              onDataChange={loadData}
            />
          </motion.div>
        )}
      </main>

      {/* Modals */}
      <AdminUserModal
        open={showUserModal} onOpenChange={setShowUserModal}
        user={selectedUser} isAdmin={isAdmin}
        onGiftBlueTick={(userId) => actions.handleGiftBlueTick(userId, () => setShowUserModal(false))}
        onGiftMoney={(amount) => actions.handleGiftMoney(selectedUser, amount, () => setShowUserModal(false))}
        onRefresh={loadData}
      />

      <AdminOrderModal
        open={showOrderModal} onOpenChange={setShowOrderModal}
        order={selectedOrder}
        adminNote={adminNote} accessLink={accessLink}
        onAdminNoteChange={setAdminNote} onAccessLinkChange={setAccessLink}
        onUpdateStatus={(orderId, status) => actions.handleUpdateOrderStatus(
          orderId, status, data.orders, adminNote, accessLink,
          () => { setAdminNote(''); setAccessLink(''); setShowOrderModal(false); }
        )}
      />

      <AdminTempAdminModal
        open={showTempAdminModal} onOpenChange={setShowTempAdminModal}
        email={tempAdminEmail} hours={tempAdminHours}
        onEmailChange={setTempAdminEmail} onHoursChange={setTempAdminHours}
        onSave={() => actions.handleAddTempAdmin(tempAdminEmail, tempAdminHours, () => { setTempAdminEmail(''); setTempAdminHours('24'); setShowTempAdminModal(false); })}
      />

      <AdminAnnouncementModal
        open={showAnnouncementModal} onOpenChange={setShowAnnouncementModal}
        title={announcementTitle} message={announcementMessage}
        onTitleChange={setAnnouncementTitle} onMessageChange={setAnnouncementMessage}
        onSave={() => actions.handleCreateAnnouncement(announcementTitle, announcementMessage, () => { setAnnouncementTitle(''); setAnnouncementMessage(''); setShowAnnouncementModal(false); })}
      />

      <AdminProductModal
        open={showProductModal} onOpenChange={setShowProductModal}
        editingProduct={editingProduct}
        productForm={productForm} setProductForm={setProductForm}
        categories={data.categories}
        existingVariations={existingVariations} setExistingVariations={setExistingVariations}
        pendingVariations={pendingVariations} setPendingVariations={setPendingVariations}
        newModalVariation={newModalVariation} setNewModalVariation={setNewModalVariation}
        onSave={() => editingProduct
          ? actions.handleUpdateProduct(editingProduct, productForm, pendingVariations, resetProductForm)
          : actions.handleAddProduct(productForm, pendingVariations, resetProductForm)
        }
        onReset={resetProductForm}
      />

      <AdminBannerModal
        open={showBannerModal} onOpenChange={setShowBannerModal}
        bannerForm={bannerForm} setBannerForm={setBannerForm}
        onSave={() => actions.handleAddBanner(bannerForm, data.banners.length, () => { setBannerForm({ title: '', image_url: '', link: '', is_active: true }); setShowBannerModal(false); })}
      />

      <FlashSaleModal open={showFlashSaleModal} onOpenChange={setShowFlashSaleModal} products={data.products} onRefresh={loadData} />
      <VariationsModal open={showVariationsModal} onOpenChange={setShowVariationsModal} product={selectedProductForVariations} />
    </div>
  );
};

export default AdminPage;
