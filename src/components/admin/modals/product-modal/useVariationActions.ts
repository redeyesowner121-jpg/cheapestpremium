import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EMPTY_VARIATION = { name: '', price: '', original_price: '', reseller_price: '', description: '', delivery_message: '', delivery_mode: 'repeated', access_link: '' };

export function useVariationActions(opts: {
  editingProduct: any;
  existingVariations: any[];
  setExistingVariations: (v: any[]) => void;
  pendingVariations: any[];
  setPendingVariations: (v: any[]) => void;
  newModalVariation: any;
  setNewModalVariation: (v: any) => void;
}) {
  const { editingProduct, existingVariations, setExistingVariations,
    pendingVariations, setPendingVariations, newModalVariation, setNewModalVariation } = opts;

  const refreshExisting = async () => {
    if (!editingProduct) return;
    const { data } = await supabase.from('product_variations').select('*')
      .eq('product_id', editingProduct.id).order('created_at', { ascending: true });
    setExistingVariations(data || []);
  };

  const updatePendingVariation = (index: number, updates: Record<string, any>) => {
    setPendingVariations(pendingVariations.map((v, i) => i === index ? { ...v, ...updates } : v));
  };

  const handleAddModalVariation = () => {
    if (!newModalVariation.name || !newModalVariation.price) {
      toast.error('Please fill variation name and price'); return;
    }
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id,
        name: newModalVariation.name,
        price: parseFloat(newModalVariation.price),
        original_price: newModalVariation.original_price ? parseFloat(newModalVariation.original_price) : null,
        reseller_price: newModalVariation.reseller_price ? parseFloat(newModalVariation.reseller_price) : null,
        description: newModalVariation.description || null,
        delivery_message: newModalVariation.delivery_message || null,
        delivery_mode: newModalVariation.delivery_mode === 'unique' ? 'unique' : 'repeated',
        access_link: newModalVariation.access_link?.trim() || null,
      }).then(({ error }) => {
        if (error) { toast.error('Failed to add variation'); return; }
        refreshExisting();
        toast.success('Variation added!');
        setNewModalVariation({ ...EMPTY_VARIATION });
      });
    } else {
      setPendingVariations([...pendingVariations, {
        ...newModalVariation,
        delivery_mode: newModalVariation.delivery_mode === 'unique' ? 'unique' : 'repeated',
        access_link: newModalVariation.access_link || '',
      }]);
      setNewModalVariation({ ...EMPTY_VARIATION });
    }
  };

  const handleEditVariation = async (id: string, data: any) => {
    if (!data.name || !data.price) { toast.error('Name and price are required'); return; }
    const { error } = await supabase.from('product_variations').update({
      name: data.name,
      price: parseFloat(data.price),
      original_price: data.original_price ? parseFloat(data.original_price) : null,
      reseller_price: data.reseller_price ? parseFloat(data.reseller_price) : null,
      description: data.description || null,
      delivery_message: data.delivery_message || null,
    }).eq('id', id);
    if (error) { toast.error('Failed to update variation'); return; }
    toast.success('Variation updated!');
    refreshExisting();
  };

  const handleDeleteVariation = async (variationId: string) => {
    await supabase.from('price_history').delete().eq('variation_id', variationId);
    await supabase.from('cart_items').delete().eq('variation_id', variationId);
    const { error } = await supabase.from('product_variations').delete().eq('id', variationId);
    if (error) { toast.error('Failed to delete variation: ' + error.message); return; }
    setExistingVariations(existingVariations.filter(v => v.id !== variationId));
    toast.success('Variation deleted!');
  };

  const handleDeletePending = (idx: string) => {
    const index = parseInt(idx);
    setPendingVariations(pendingVariations.filter((_, i) => i !== index));
  };

  const handleQuickTemplate = (template: any) => {
    if (editingProduct) {
      supabase.from('product_variations').insert({
        product_id: editingProduct.id, name: template.name, price: parseFloat(template.price),
      }).then(() => {
        refreshExisting();
        toast.success(`${template.name} added!`);
      });
    } else {
      setPendingVariations([...pendingVariations, { ...template, delivery_mode: 'repeated', access_link: '' }]);
    }
  };

  return {
    updatePendingVariation, handleAddModalVariation, handleEditVariation,
    handleDeleteVariation, handleDeletePending, handleQuickTemplate,
  };
}
