import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function handleAddBanner(
  title: string,
  imageUrl: string,
  link: string,
  isActive: boolean,
  sortOrder: number,
  onComplete: () => void
) {
  if (!title || !imageUrl) {
    toast.error('Please fill required fields');
    return false;
  }
  
  await supabase.from('banners').insert({
    title,
    image_url: imageUrl,
    link: link || null,
    is_active: isActive,
    sort_order: sortOrder
  });
  
  toast.success('Banner added!');
  onComplete();
  return true;
}

export async function handleDeleteBanner(bannerId: string, onComplete: () => void) {
  await supabase.from('banners').delete().eq('id', bannerId);
  toast.success('Banner deleted!');
  onComplete();
  return true;
}

export async function handleToggleBanner(bannerId: string, isActive: boolean, onComplete: () => void) {
  await supabase.from('banners').update({ is_active: !isActive }).eq('id', bannerId);
  onComplete();
  return true;
}

export async function handleAddFlashSale(
  productId: string,
  salePrice: string,
  startTime: string,
  endTime: string,
  isActive: boolean,
  onComplete: () => void
) {
  if (!productId || !salePrice || !endTime) {
    toast.error('Please fill required fields');
    return false;
  }
  
  await supabase.from('flash_sales').insert({
    product_id: productId,
    sale_price: parseFloat(salePrice),
    start_time: startTime || new Date().toISOString(),
    end_time: endTime,
    is_active: isActive
  });
  
  toast.success('Flash sale added!');
  onComplete();
  return true;
}

export async function handleDeleteFlashSale(saleId: string, onComplete: () => void) {
  await supabase.from('flash_sales').delete().eq('id', saleId);
  toast.success('Flash sale deleted!');
  onComplete();
  return true;
}

export async function handleCreateAnnouncement(
  title: string,
  message: string,
  onComplete: () => void
) {
  if (!title || !message) return false;
  
  await supabase.from('announcements').insert({
    title,
    message,
    type: 'info',
    is_active: true
  });

  toast.success('Announcement created!');
  onComplete();
  return true;
}

export async function handleAddTempAdmin(
  email: string,
  hours: string,
  onComplete: () => void
) {
  if (!email || !hours) return false;
  
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    toast.error('User not found');
    return false;
  }

  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + parseInt(hours));

  const { error } = await supabase.from('user_roles').upsert({
    user_id: user.id,
    role: 'temp_admin',
    temp_admin_expiry: expiryDate.toISOString()
  });

  if (error) {
    toast.error('Failed to add temp admin');
    return false;
  }

  toast.success('Temporary admin added!');
  onComplete();
  return true;
}

export async function handleRemoveTempAdmin(userId: string, onComplete: () => void) {
  await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'temp_admin');
  toast.success('Temporary admin removed!');
  onComplete();
  return true;
}

export async function handleUpdateSetting(key: string, value: string) {
  await supabase.from('app_settings').upsert({ 
    key, 
    value, 
    updated_at: new Date().toISOString() 
  });
  toast.success('Setting updated!');
  return true;
}
