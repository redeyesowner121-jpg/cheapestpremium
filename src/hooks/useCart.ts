import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
    original_price: number | null;
    image_url: string | null;
    stock: number | null;
    is_active: boolean;
    reseller_price: number | null;
    access_link: string | null;
    category: string;
  };
  variation?: {
    id: string;
    name: string;
    price: number;
    reseller_price: number | null;
    is_active: boolean;
  };
}

export const useCart = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); setCartCount(0); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*, product:products(*), variation:product_variations(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const cartItems = (data || []) as unknown as CartItem[];
      setItems(cartItems);
      setCartCount(cartItems.reduce((sum, item) => sum + item.quantity, 0));
    } catch (err) {
      console.error('Failed to load cart:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();

    if (!user) return;
    const channel = supabase
      .channel('cart-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cart_items',
        filter: `user_id=eq.${user.id}`
      }, () => fetchCart())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCart, user]);

  const addToCart = async (productId: string, variationId?: string | null, qty: number = 1) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return false;
    }

    try {
      // Upsert - if already in cart, increment quantity
      const existingFilter = supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', productId);
      
      const { data: existing } = variationId 
        ? await existingFilter.eq('variation_id', variationId).maybeSingle()
        : await existingFilter.is('variation_id', null).maybeSingle();

      if (existing) {
        await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + qty })
          .eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({
          user_id: user.id,
          product_id: productId,
          variation_id: variationId || null,
          quantity: qty,
        });
      }

      toast.success('Added to cart! 🛒');
      return true;
    } catch (err) {
      console.error('Add to cart error:', err);
      toast.error('Failed to add to cart');
      return false;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(itemId);
    try {
      await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);
    } catch (err) {
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await supabase.from('cart_items').delete().eq('id', itemId);
      toast.success('Removed from cart');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    if (!user) return;
    try {
      await supabase.from('cart_items').delete().eq('user_id', user.id);
    } catch (err) {
      toast.error('Failed to clear cart');
    }
  };

  return { items, loading, cartCount, addToCart, updateQuantity, removeItem, clearCart, refetch: fetchCart };
};
