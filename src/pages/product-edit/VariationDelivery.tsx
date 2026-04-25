import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Zap, Plus, Loader2, ChevronDown, ChevronUp, Link2, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import StructuredCredentialInput from '@/components/admin/modals/StructuredCredentialInput';
import StockItemRow from './StockItemRow';

interface Props {
  variation: any;
  productId: string;
}

const VariationDelivery: React.FC<Props> = ({ variation, productId }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'repeated' | 'unique'>(variation.delivery_mode === 'unique' ? 'unique' : 'repeated');
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [newLink, setNewLink] = useState('');
  const [bulkLinks, setBulkLinks] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [repeatedLink, setRepeatedLink] = useState(variation.access_link || '');
  const [savingLink, setSavingLink] = useState(false);
  const [repeatedOpen, setRepeatedOpen] = useState(false);

  useEffect(() => {
    setMode(variation.delivery_mode === 'unique' ? 'unique' : 'repeated');
    setRepeatedLink(variation.access_link || '');
  }, [variation.delivery_mode, variation.access_link]);

  const loadStock = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('product_stock_items').select('*')
      .eq('variation_id', variation.id).order('created_at', { ascending: true });
    setStockItems(data || []);
    setLoading(false);
  };

  useEffect(() => { if (open && mode === 'unique') loadStock(); }, [open, mode, variation.id]);

  const handleToggle = async (next: boolean) => {
    const newMode = next ? 'unique' : 'repeated';
    setMode(newMode);
    const { error } = await supabase.from('product_variations').update({ delivery_mode: newMode } as any).eq('id', variation.id);
    if (error) { toast.error('Failed to update'); setMode(mode); return; }
    toast.success(newMode === 'unique' ? '⚡ Auto delivery enabled' : '🔁 Repeated link mode');
    if (newMode === 'unique') {
      setOpen(true);
      loadStock();
    } else {
      setRepeatedOpen(true);
    }
  };

  const saveRepeatedLink = async () => {
    setSavingLink(true);
    const { error } = await (supabase as any)
      .from('product_variations')
      .update({ access_link: repeatedLink.trim() || null })
      .eq('id', variation.id);
    setSavingLink(false);
    if (error) return toast.error('Failed to save link');
    toast.success('Repeated link saved');
  };

  const addStock = async () => {
    if (!newLink.trim()) return toast.error('Enter a link or credentials');
    const { error } = await (supabase as any).from('product_stock_items').insert({
      product_id: productId, variation_id: variation.id, access_link: newLink.trim(),
    });
    if (error) return toast.error('Failed to add');
    toast.success('Stock added');
    setNewLink('');
    loadStock();
  };

  const addBulkStock = async () => {
    const links = bulkLinks.split('\n').map(l => l.trim()).filter(Boolean);
    if (links.length === 0) return toast.error('Enter at least one link');
    const items = links.map(link => ({ product_id: productId, variation_id: variation.id, access_link: link }));
    const { error } = await (supabase as any).from('product_stock_items').insert(items);
    if (error) return toast.error('Failed to add');
    toast.success(`${links.length} stock items added`);
    setBulkLinks('');
    setShowBulk(false);
    loadStock();
  };

  const deleteStock = async (id: string) => {
    await (supabase as any).from('product_stock_items').delete().eq('id', id);
    setStockItems(items => items.filter(s => s.id !== id));
  };

  const available = stockItems.filter(s => !s.is_used).length;
  const used = stockItems.filter(s => s.is_used).length;

  return (
    <div className="mt-3 rounded-xl border border-primary/10 bg-primary/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className={`w-4 h-4 shrink-0 ${mode === 'unique' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium">{mode === 'unique' ? 'Auto Delivery' : 'Repeated Link'}</span>
          {mode === 'unique' ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">📦 {available}</Badge>
              <Badge variant="outline" className="text-xs">✅ {used}</Badge>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRepeatedOpen(!repeatedOpen)}>
              {repeatedOpen ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
              Link
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'unique' && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(!open)}>
              {open ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
              Stock
            </Button>
          )}
          <Switch checked={mode === 'unique'} onCheckedChange={handleToggle} />
        </div>
      </div>

      <AnimatePresence>
        {repeatedOpen && mode === 'repeated' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link2 className="w-3.5 h-3.5" />
                <span>Same link/credentials sent to every buyer</span>
              </div>
              <StructuredCredentialInput value={repeatedLink} onChange={setRepeatedLink} />
              <Button
                onClick={saveRepeatedLink}
                disabled={savingLink || repeatedLink === (variation.access_link || '')}
                size="sm"
                className="w-full gap-1.5"
              >
                <Save className="w-4 h-4" />
                {savingLink ? 'Saving...' : 'Save Link'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && mode === 'unique' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3 space-y-3">
              <StructuredCredentialInput value={newLink} onChange={setNewLink} />
              <Button onClick={addStock} size="sm" className="w-full gap-1.5"><Plus className="w-4 h-4" /> Add Stock</Button>

              <button onClick={() => setShowBulk(!showBulk)} className="text-xs text-primary hover:underline">
                {showBulk ? 'Hide bulk add' : '+ Bulk add (one per line)'}
              </button>
              {showBulk && (
                <div className="space-y-2">
                  <Textarea placeholder="Paste links/credentials (one per line)" value={bulkLinks}
                    onChange={e => setBulkLinks(e.target.value)} rows={4} className="font-mono text-xs" />
                  <Button onClick={addBulkStock} size="sm" className="w-full">
                    Add {bulkLinks.split('\n').filter(l => l.trim()).length} items
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : stockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No stock items yet</p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                  {stockItems.map((item, idx) => (
                    <StockItemRow key={item.id} item={item} idx={idx} onDelete={deleteStock} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VariationDelivery;
