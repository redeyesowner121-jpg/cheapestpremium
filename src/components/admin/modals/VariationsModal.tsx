import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VariationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

const VariationsModal: React.FC<VariationsModalProps> = ({
  open,
  onOpenChange,
  product,
}) => {
  const [variations, setVariations] = React.useState<any[]>([]);
  const [newVariation, setNewVariation] = React.useState({ name: '', price: '', reseller_price: '' });

  React.useEffect(() => {
    if (product && open) {
      loadVariations();
    }
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
      reseller_price: newVariation.reseller_price ? parseFloat(newVariation.reseller_price) : null
    });

    toast.success('Variation added!');
    setNewVariation({ name: '', price: '', reseller_price: '' });
    loadVariations();
  };

  const handleDeleteVariation = async (variationId: string) => {
    await supabase.from('product_variations').delete().eq('id', variationId);
    toast.success('Variation deleted!');
    loadVariations();
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Variations</DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {variations.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-primary font-bold text-sm">
                    ₹{v.price}
                    {v.reseller_price && <span className="text-muted-foreground font-normal ml-2">(R: ₹{v.reseller_price})</span>}
                  </p>
                </div>
                <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDeleteVariation(v.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {variations.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">No variations yet</p>
            )}
          </div>
          
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-2">Add New Variation</h4>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input 
                placeholder="Variation Name" 
                value={newVariation.name} 
                onChange={(e) => setNewVariation({...newVariation, name: e.target.value})} 
              />
              <Input 
                type="number" 
                placeholder="Price" 
                value={newVariation.price} 
                onChange={(e) => setNewVariation({...newVariation, price: e.target.value})} 
              />
            </div>
            <div className="flex gap-2">
              <Input 
                type="number" 
                placeholder="Reseller Price" 
                value={newVariation.reseller_price} 
                onChange={(e) => setNewVariation({...newVariation, reseller_price: e.target.value})} 
              />
              <Button onClick={handleAddVariation}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VariationsModal;
