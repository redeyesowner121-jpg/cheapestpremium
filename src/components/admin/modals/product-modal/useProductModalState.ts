import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useProductModalState(editingProduct: any, productForm: any, setProductForm: (f: any) => void) {
  const [deliveryType, setDeliveryType] = useState<'link' | 'credentials'>('link');
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [newStockLink, setNewStockLink] = useState('');
  const [loadingStock, setLoadingStock] = useState(false);
  const deliveryMode: 'repeated' | 'unique' = productForm.delivery_mode === 'unique' ? 'unique' : 'repeated';

  const loadStockItems = async (productId: string) => {
    setLoadingStock(true);
    const { data } = await supabase
      .from('product_stock_items' as any)
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    setStockItems(data || []);
    setLoadingStock(false);
  };

  useEffect(() => {
    if (editingProduct) {
      setProductForm((prev: any) => ({
        ...prev,
        delivery_mode: editingProduct.delivery_mode === 'unique' ? 'unique' : 'repeated',
      }));
      const link = editingProduct.access_link || '';
      if (link.includes('ID:') && link.includes('Password:')) {
        setDeliveryType('credentials');
        const idMatch = link.match(/ID:\s*(.+)/);
        const pwMatch = link.match(/Password:\s*(.+)/);
        setCredUsername(idMatch?.[1]?.trim() || '');
        setCredPassword(pwMatch?.[1]?.trim() || '');
      } else {
        setDeliveryType('link');
        setCredUsername('');
        setCredPassword('');
      }
      if (editingProduct.delivery_mode === 'unique') loadStockItems(editingProduct.id);
    } else {
      setDeliveryType('link');
      setCredUsername('');
      setCredPassword('');
      setStockItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProduct]);

  const updateAccessLink = (type: 'link' | 'credentials', link?: string, user?: string, pass?: string) => {
    if (type === 'credentials') {
      setProductForm({ ...productForm, access_link: `ID: ${user || credUsername}\nPassword: ${pass || credPassword}` });
    } else {
      setProductForm({ ...productForm, access_link: link ?? productForm.access_link });
    }
  };

  const handleDeliveryModeChange = (mode: 'repeated' | 'unique') => {
    setProductForm((prev: any) => ({ ...prev, delivery_mode: mode }));
    if (mode === 'unique' && editingProduct) loadStockItems(editingProduct.id);
  };

  const handleAddStockItem = async () => {
    if (!newStockLink.trim()) { toast.error('Please enter a link or credentials'); return; }
    if (!editingProduct) { toast.error('Please save the product first, then add stock items'); return; }
    const { error } = await (supabase as any)
      .from('product_stock_items')
      .insert({ product_id: editingProduct.id, access_link: newStockLink.trim() });
    if (error) { toast.error('Failed to add stock item'); return; }
    toast.success('Stock item added!');
    setNewStockLink('');
    loadStockItems(editingProduct.id);
  };

  const handleDeleteStockItem = async (itemId: string) => {
    const { error } = await (supabase as any).from('product_stock_items').delete().eq('id', itemId);
    if (error) { toast.error('Failed to delete'); return; }
    setStockItems(stockItems.filter(s => s.id !== itemId));
    toast.success('Stock item removed');
  };

  return {
    deliveryType, setDeliveryType,
    credUsername, setCredUsername,
    credPassword, setCredPassword,
    stockItems, loadingStock,
    newStockLink, setNewStockLink,
    deliveryMode,
    updateAccessLink, handleDeliveryModeChange,
    handleAddStockItem, handleDeleteStockItem,
  };
}
