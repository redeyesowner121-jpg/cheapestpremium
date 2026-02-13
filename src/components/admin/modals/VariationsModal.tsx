import React from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
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
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({ name: '', price: '', reseller_price: '' });

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

  const startEdit = (v: any) => {
    setEditingId(v.id);
    setEditForm({
      name: v.name,
      price: String(v.price),
      reseller_price: v.reseller_price ? String(v.reseller_price) : '',
    });
  };

  const handleUpdateVariation = async () => {
    if (!editingId || !editForm.name || !editForm.price) {
      toast.error('Name and price are required');
      return;
    }

    const { error } = await supabase
      .from('product_variations')
      .update({
        name: editForm.name,
        price: parseFloat(editForm.price),
        reseller_price: editForm.reseller_price ? parseFloat(editForm.reseller_price) : null,
      })
      .eq('id', editingId);

    if (error) {
      toast.error('Failed to update variation');
      return;
    }

    toast.success('Variation updated!');
    setEditingId(null);
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
              <div key={v.id} className="p-3 bg-muted rounded-xl">
                {editingId === v.id ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      />
                      <Input
                        type="number"
                        placeholder="Reseller Price"
                        value={editForm.reseller_price}
                        onChange={(e) => setEditForm({ ...editForm, reseller_price: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={handleUpdateVariation}>
                        <Check className="w-3 h-3 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      <p className="text-primary font-bold text-sm">
                        ₹{v.price}
                        {v.reseller_price && <span className="text-muted-foreground font-normal ml-2">(R: ₹{v.reseller_price})</span>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => startEdit(v)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDeleteVariation(v.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
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
