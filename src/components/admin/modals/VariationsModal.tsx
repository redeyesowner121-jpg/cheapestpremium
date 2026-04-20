import React from 'react';
import { Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import VariationItem from './VariationItem';
import AddVariationForm from './AddVariationForm';
import VariationDeliveryManager from './VariationDeliveryManager';

interface VariationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

const VariationsModal: React.FC<VariationsModalProps> = ({ open, onOpenChange, product }) => {
  const [variations, setVariations] = React.useState<any[]>([]);
  const [newVariation, setNewVariation] = React.useState({ name: '', price: '', original_price: '', reseller_price: '' });

  React.useEffect(() => {
    if (product && open) loadVariations();
  }, [product, open]);

  const loadVariations = async () => {
    const { data } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: true });
    setVariations(data || []);
  };

  const handleAddVariation = async () => {
    if (!newVariation.name || !newVariation.price || !product) {
      toast.error('Please fill variation name and price');
      return;
    }
    await supabase.from('product_variations').insert({
      product_id: product.id,
      name: newVariation.name,
      price: parseFloat(newVariation.price),
      original_price: newVariation.original_price ? parseFloat(newVariation.original_price) : null,
      reseller_price: newVariation.reseller_price ? parseFloat(newVariation.reseller_price) : null,
    });
    toast.success('Variation added!');
    setNewVariation({ name: '', price: '', original_price: '', reseller_price: '' });
    loadVariations();
  };

  const handleEdit = async (id: string, data: { name: string; price: string; original_price: string; reseller_price: string }) => {
    if (!data.name || !data.price) {
      toast.error('Name and price are required');
      return;
    }
    const { error } = await supabase.from('product_variations').update({
      name: data.name,
      price: parseFloat(data.price),
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      reseller_price: data.reseller_price ? parseFloat(data.reseller_price) : null,
    }).eq('id', id);
    if (error) {
      console.error('Update variation error:', error);
      toast.error('Failed to update variation: ' + error.message);
      return;
    }
    toast.success('Variation updated!');
    loadVariations();
  };

  const handleDelete = async (id: string) => {
    // First clean up references in other tables
    await supabase.from('price_history').delete().eq('variation_id', id);
    await supabase.from('cart_items').delete().eq('variation_id', id);
    
    const { error } = await supabase.from('product_variations').delete().eq('id', id);
    if (error) {
      console.error('Delete variation error:', error);
      toast.error('Failed to delete variation: ' + error.message);
      return;
    }
    toast.success('Variation deleted!');
    loadVariations();
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Variations
          </DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {variations.map((v) => (
              <div key={v.id}>
                <VariationItem variation={v} onEdit={handleEdit} onDelete={handleDelete} />
                {variations.length >= 2 && (
                  <VariationDeliveryManager variation={{ ...v, product_id: product.id }} />
                )}
              </div>
            ))}
          </AnimatePresence>

          {variations.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No variations yet
            </div>
          )}

          <AddVariationForm value={newVariation} onChange={setNewVariation} onAdd={handleAddVariation} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VariationsModal;
