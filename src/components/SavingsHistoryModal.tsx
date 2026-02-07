import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ShoppingBag, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SavingsItem {
  id: string;
  product_name: string;
  product_image: string | null;
  total_price: number;
  original_price: number;
  savings: number;
  created_at: string;
}

interface SavingsHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalSavings: number;
}

const SavingsHistoryModal: React.FC<SavingsHistoryModalProps> = ({
  open,
  onOpenChange,
  totalSavings,
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<SavingsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const fetchHistory = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('orders')
        .select('id, product_name, product_image, total_price, product_id, created_at, quantity')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Fetch original prices for products
        const productIds = [...new Set(data.map(o => o.product_id).filter(Boolean))];
        const { data: products } = await supabase
          .from('products')
          .select('id, original_price, price')
          .in('id', productIds.length > 0 ? productIds : ['none']);

        const productMap = new Map(products?.map(p => [p.id, p]) || []);

        const savingsItems: SavingsItem[] = data
          .map(order => {
            const product = order.product_id ? productMap.get(order.product_id) : null;
            const originalPrice = product?.original_price || product?.price || order.total_price;
            const qty = order.quantity || 1;
            const savings = (originalPrice * qty) - order.total_price;
            return {
              id: order.id,
              product_name: order.product_name,
              product_image: order.product_image,
              total_price: order.total_price,
              original_price: originalPrice * qty,
              savings,
              created_at: order.created_at,
            };
          })
          .filter(item => item.savings > 0);

        setItems(savingsItems);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [open, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Savings History
          </DialogTitle>
        </DialogHeader>

        {/* Total Banner */}
        <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Savings</p>
          <p className="text-3xl font-bold text-success">₹{totalSavings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            You saved across {items.length} orders! 🎉
          </p>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No savings yet</p>
            </div>
          ) : (
            items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-sm"
              >
                {item.product_image ? (
                  <img
                    src={item.product_image}
                    alt={item.product_name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="line-through">₹{item.original_price.toFixed(0)}</span>
                    {' → '}
                    <span className="text-primary font-medium">₹{item.total_price.toFixed(0)}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">
                    -₹{item.savings.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">saved</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SavingsHistoryModal;
