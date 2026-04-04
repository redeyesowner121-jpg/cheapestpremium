import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAdminPageActions = (loadData: () => void) => {
  // User actions
  const handleGiftBlueTick = async (userId: string, onDone: () => void) => {
    const { error } = await supabase.from('profiles').update({ has_blue_check: true }).eq('id', userId);
    if (error) { toast.error('Failed to gift blue tick'); return; }
    toast.success('Blue Tick gifted successfully!');
    onDone();
    loadData();
  };

  const handleGiftMoney = async (selectedUser: any, giftAmount: string, onDone: () => void) => {
    if (!selectedUser || !giftAmount) return;
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Invalid amount'); return; }

    const newBalance = (selectedUser.wallet_balance || 0) + amount;
    const { error } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', selectedUser.id);
    if (error) { toast.error('Failed to gift money'); return; }

    await supabase.from('transactions').insert({
      user_id: selectedUser.id, type: 'gift', amount, status: 'completed',
      description: `Admin gift - Rs${amount}`
    });

    toast.success(`Rs${amount} gifted to ${selectedUser.name}`);
    onDone();
    loadData();
  };

  // Order actions
  const handleUpdateOrderStatus = async (
    orderId: string, status: string, orders: any[],
    adminNote: string, accessLink: string, onDone: () => void
  ) => {
    const order = orders.find(o => o.id === orderId);
    const updateData: any = { status, admin_note: adminNote || null, updated_at: new Date().toISOString() };
    if (accessLink) updateData.access_link = accessLink;

    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) { toast.error('Failed to update order'); return; }

    if (order) {
      let notificationTitle = '', notificationMessage = '';
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
        user_id: order.user_id, title: notificationTitle, message: notificationMessage, type: 'order'
      });
    }

    if ((status === 'cancelled' || status === 'refunded') && order) {
      const { data: userProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', order.user_id).single();
      if (userProfile) {
        await supabase.from('profiles').update({ wallet_balance: (userProfile.wallet_balance || 0) + order.total_price }).eq('id', order.user_id);
        await supabase.from('transactions').insert({
          user_id: order.user_id, type: 'refund', amount: order.total_price,
          status: 'completed', description: `Order refund - ${order.product_name}`
        });
      }
    }

    toast.success('Order updated!');
    onDone();
    loadData();
  };

  // Temp Admin actions
  const handleAddTempAdmin = async (email: string, hours: string, onDone: () => void) => {
    if (!email || !hours) return;
    const { data: user } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!user) { toast.error('User not found'); return; }

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(hours));

    const { error } = await supabase.from('user_roles').upsert({
      user_id: user.id, role: 'temp_admin', temp_admin_expiry: expiryDate.toISOString()
    });
    if (error) { toast.error('Failed to add temp admin'); return; }

    toast.success('Temporary admin added!');
    onDone();
    loadData();
  };

  const handleRemoveTempAdmin = async (userId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'temp_admin');
    toast.success('Temporary admin removed!');
    loadData();
  };

  // Announcement actions
  const handleCreateAnnouncement = async (title: string, message: string, onDone: () => void) => {
    if (!title || !message) return;
    await supabase.from('announcements').insert({ title, message, type: 'info', is_active: true });
    toast.success('Announcement created!');
    onDone();
    loadData();
  };

  // Product actions
  const handleAddProduct = async (
    productForm: any, pendingVariations: any[], onDone: () => void
  ) => {
    if (!productForm.name || !productForm.category) {
      toast.error('Product Name ও Category অবশ্যই পূরণ করুন'); return;
    }

    const baseSlug = productForm.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'product';
    const slugSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const productSlug = `${baseSlug}-${slugSuffix}`;

    const { data: newProduct, error } = await supabase.from('products').insert({
      name: productForm.name, description: productForm.description,
      price: productForm.price ? parseFloat(productForm.price) : 0,
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category, image_url: productForm.image_url,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      is_active: productForm.is_active,
      slug: productSlug
    }).select().single();

    if (error || !newProduct) { toast.error('Failed to add product'); return; }

    if (pendingVariations.length > 0) {
      await supabase.from('product_variations').insert(
        pendingVariations.map(v => ({
          product_id: newProduct.id, name: v.name,
          price: parseFloat(v.price),
          original_price: v.original_price ? parseFloat(v.original_price) : null,
          reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
        }))
      );
    }

    toast.success('Product added!');
    onDone();
    loadData();
  };

  const handleUpdateProduct = async (
    editingProduct: any, productForm: any, pendingVariations: any[], onDone: () => void
  ) => {
    if (!editingProduct || !productForm.name || !productForm.category) {
      toast.error('Product Name ও Category অবশ্যই পূরণ করুন'); return;
    }

    const { error } = await supabase.from('products').update({
      name: productForm.name, description: productForm.description,
      price: productForm.price ? parseFloat(productForm.price) : 0,
      original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
      category: productForm.category, image_url: productForm.image_url,
      access_link: productForm.access_link || null,
      stock: productForm.stock ? parseInt(productForm.stock) : null,
      is_active: productForm.is_active
    }).eq('id', editingProduct.id);

    if (error) { toast.error('Failed to update product'); return; }

    if (pendingVariations.length > 0) {
      await supabase.from('product_variations').insert(
        pendingVariations.map(v => ({
          product_id: editingProduct.id, name: v.name,
          price: parseFloat(v.price),
          original_price: v.original_price ? parseFloat(v.original_price) : null,
          reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
        }))
      );
    }

    toast.success('Product updated!');
    onDone();
    loadData();
  };

  const handleDeleteProduct = async (productId: string) => {
    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('product_id', productId);
    if (count && count > 0) {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', productId);
      if (error) { toast.error('Failed to deactivate product'); return; }
      toast.success('Product deactivated (has existing orders)');
      loadData(); return;
    }
    await supabase.from('product_variations').delete().eq('product_id', productId);
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) { toast.error('Failed to delete product'); return; }
    toast.success('Product deleted!');
    loadData();
  };

  // Banner actions
  const handleAddBanner = async (bannerForm: any, bannersCount: number, onDone: () => void) => {
    if (!bannerForm.title || !bannerForm.image_url) { toast.error('Please fill required fields'); return; }
    await supabase.from('banners').insert({
      title: bannerForm.title, image_url: bannerForm.image_url,
      link: bannerForm.link || null, is_active: bannerForm.is_active, sort_order: bannersCount
    });
    toast.success('Banner added!');
    onDone();
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
  const handleDeleteFlashSale = async (saleId: string) => {
    await supabase.from('flash_sales').delete().eq('id', saleId);
    toast.success('Flash sale deleted!');
    loadData();
  };

  // Settings
  const handleUpdateSetting = async (key: string, value: string, data: any, setData: (d: any) => void) => {
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setData({ ...data, settings: { ...data.settings, [key]: value } });
    toast.success('Setting updated!');
  };

  return {
    handleGiftBlueTick, handleGiftMoney,
    handleUpdateOrderStatus,
    handleAddTempAdmin, handleRemoveTempAdmin,
    handleCreateAnnouncement,
    handleAddProduct, handleUpdateProduct, handleDeleteProduct,
    handleAddBanner, handleDeleteBanner, handleToggleBanner,
    handleDeleteFlashSale,
    handleUpdateSetting,
  };
};
