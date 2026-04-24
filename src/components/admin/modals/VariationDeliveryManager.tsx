import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Zap, Link2, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import BulkStockImportModal from './BulkStockImportModal';
import { parseCredential } from '@/lib/credentialParser';

interface VariationDeliveryManagerProps {
  variation: {
    id: string;
    name: string;
    delivery_mode?: string | null;
    access_link?: string | null;
    product_id?: string;
  };
}

const VariationDeliveryManager: React.FC<VariationDeliveryManagerProps> = ({ variation }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'repeated' | 'unique'>(
    variation.delivery_mode === 'unique' ? 'unique' : 'repeated'
  );
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [newLink, setNewLink] = useState('');
  const [loading, setLoading] = useState(false);

  // Repeated link state
  const [repeatedLink, setRepeatedLink] = useState(variation.access_link || '');
  const [savingLink, setSavingLink] = useState(false);
  const [repeatedOpen, setRepeatedOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    setMode(variation.delivery_mode === 'unique' ? 'unique' : 'repeated');
    setRepeatedLink(variation.access_link || '');
  }, [variation.delivery_mode, variation.access_link]);

  const loadStock = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('product_stock_items')
      .select('*')
      .eq('variation_id', variation.id)
      .order('created_at', { ascending: true });
    setStockItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open && mode === 'unique') loadStock();
  }, [open, mode, variation.id]);

  const handleToggle = async (next: boolean) => {
    const newMode = next ? 'unique' : 'repeated';
    setMode(newMode);
    const { error } = await supabase
      .from('product_variations')
      .update({ delivery_mode: newMode } as any)
      .eq('id', variation.id);
    if (error) {
      toast.error('Failed to update delivery mode');
      setMode(mode);
      return;
    }
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
    const { error } = await (supabase as any)
      .from('product_stock_items')
      .insert({
        product_id: variation.product_id,
        variation_id: variation.id,
        access_link: newLink.trim(),
      });
    if (error) return toast.error('Failed to add: ' + error.message);
    toast.success('Stock added');
    setNewLink('');
    loadStock();
  };

  const deleteStock = async (id: string) => {
    const { error } = await (supabase as any).from('product_stock_items').delete().eq('id', id);
    if (error) return toast.error('Failed to delete');
    setStockItems((items) => items.filter((s) => s.id !== id));
  };

  const available = stockItems.filter((s) => !s.is_used).length;
  const used = stockItems.filter((s) => s.is_used).length;

  return (
    <div className="ml-4 mt-1.5 mb-1 border-l-2 border-primary/15 pl-3">
      <div className="flex items-center justify-between gap-2 py-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className={`w-3 h-3 shrink-0 ${mode === 'unique' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-[11px] font-medium text-muted-foreground">
            {mode === 'unique' ? 'Auto Delivery' : 'Repeated Link'}
          </span>
          {mode === 'unique' ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Stock
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRepeatedOpen(!repeatedOpen)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              {repeatedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Link
            </button>
          )}
        </div>
        <Switch
          checked={mode === 'unique'}
          onCheckedChange={handleToggle}
          className="scale-75"
        />
      </div>

      {/* Repeated link input */}
      <AnimatePresence>
        {repeatedOpen && mode === 'repeated' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Link2 className="w-3 h-3" />
                <span>Same link/credentials sent to every buyer</span>
              </div>
              <Textarea
                placeholder="https://... or Email|Password"
                value={repeatedLink}
                onChange={(e) => setRepeatedLink(e.target.value)}
                className="text-[11px] min-h-[50px] py-1.5 font-mono resize-none"
                rows={2}
              />
              <Button
                size="sm"
                onClick={saveRepeatedLink}
                disabled={savingLink || repeatedLink === (variation.access_link || '')}
                className="h-7 w-full text-[11px] gap-1"
              >
                <Save className="w-3 h-3" />
                {savingLink ? 'Saving...' : 'Save Link'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unique stock list */}
      <AnimatePresence>
        {open && mode === 'unique' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] h-5">📦 {available}</Badge>
                <Badge variant="outline" className="text-[10px] h-5">✅ {used}</Badge>
              </div>

              <div className="space-y-1.5">
                <Textarea
                  placeholder={`Link, or ID|Password|2FA, or:\nEmail: x@y.com\nPassword: pass\n2FA: SECRET`}
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="text-[11px] min-h-[80px] py-1.5 font-mono resize-none"
                  rows={4}
                />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={addStock} className="h-7 flex-1 text-[11px] gap-1">
                    <Plus className="w-3 h-3" /> Add One
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} className="h-7 flex-1 text-[11px] gap-1">
                    <Upload className="w-3 h-3" /> Bulk Import
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  💡 Multi-line credentials supported (Email + Password + 2FA in one entry)
                </p>
              </div>

              {loading ? (
                <p className="text-[10px] text-muted-foreground text-center">Loading...</p>
              ) : stockItems.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-1">No stock yet</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {stockItems.map((item, idx) => {
                    const p = parseCredential(item.access_link);
                    const summary = p.email
                      ? `${p.email}${p.twoFASecret ? ' • 🔐' : ''}${p.password ? ' • 🔑' : ''}`
                      : item.access_link.split('\n')[0];
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border ${
                          item.is_used ? 'bg-muted/40 opacity-60' : 'bg-background'
                        }`}
                      >
                        <span className="text-muted-foreground w-4 shrink-0">#{idx + 1}</span>
                        <span className="truncate flex-1 font-mono">{summary}</span>
                        {item.is_used ? (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">Used</Badge>
                        ) : (
                          <button onClick={() => deleteStock(item.id)} className="text-destructive shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VariationDeliveryManager;
