import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Package, Search, Image as ImageIcon,
  Loader2, Eye, EyeOff, Link2, Hash, Layers, Settings2,
  Zap, Plus, Trash2, ChevronDown, ChevronUp, Pencil,
  Check, X, IndianRupee, Tag, Users, BadgePercent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import MultiImageUpload from '@/components/ui/multi-image-upload';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Variation Delivery Manager (inline for edit page) ───
const VariationDelivery: React.FC<{ variation: any; productId: string }> = ({ variation, productId }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'repeated' | 'unique'>(variation.delivery_mode === 'unique' ? 'unique' : 'repeated');
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [newLink, setNewLink] = useState('');
  const [bulkLinks, setBulkLinks] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMode(variation.delivery_mode === 'unique' ? 'unique' : 'repeated'); }, [variation.delivery_mode]);

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
    toast.success(newMode === 'unique' ? '⚡ Auto delivery enabled' : 'Manual delivery');
    if (newMode === 'unique') { setOpen(true); loadStock(); }
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
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${mode === 'unique' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium">Auto Delivery</span>
          {mode === 'unique' && (
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">📦 {available}</Badge>
              <Badge variant="outline" className="text-xs">✅ {used}</Badge>
            </div>
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
        {open && mode === 'unique' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3 space-y-3">
              {/* Single add */}
              <div className="flex gap-2">
                <Input placeholder="Link or ID|Password" value={newLink} onChange={e => setNewLink(e.target.value)}
                  className="font-mono text-sm" onKeyDown={e => e.key === 'Enter' && addStock()} />
                <Button onClick={addStock} size="sm" className="shrink-0"><Plus className="w-4 h-4" /></Button>
              </div>

              {/* Bulk add toggle */}
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

              {/* Stock list */}
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : stockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No stock items yet</p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {stockItems.map((item, idx) => (
                    <div key={item.id}
                      className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg border ${item.is_used ? 'bg-muted/40 opacity-60' : 'bg-background'}`}>
                      <span className="text-muted-foreground w-6 shrink-0 text-xs pt-0.5">#{idx + 1}</span>
                      <span className="flex-1 font-mono text-xs break-all whitespace-pre-wrap">{item.access_link}</span>
                      {item.is_used ? (
                        <Badge variant="secondary" className="text-xs shrink-0">Used</Badge>
                      ) : (
                        <button onClick={() => deleteStock(item.id)} className="text-destructive shrink-0 hover:bg-destructive/10 p-1 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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

// ─── Main Page ───
const ProductEditPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin } = useAuth();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [newVar, setNewVar] = useState({ name: '', price: '', original_price: '', reseller_price: '' });
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [editVarForm, setEditVarForm] = useState({ name: '', price: '', original_price: '', reseller_price: '' });

  const [form, setForm] = useState({
    name: '', description: '', price: '', original_price: '', reseller_price: '',
    category: '', images: [] as string[], access_link: '', stock: '',
    is_active: true, seo_tags: '', delivery_mode: 'repeated',
  });
  const [usdRate, setUsdRate] = useState(70);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'usd_to_inr_rate').maybeSingle()
      .then(({ data }) => { if (data?.value) setUsdRate(parseFloat(data.value)); });
  }, []);

  useEffect(() => {
    if (!(isAdmin || isTempAdmin)) { navigate('/'); return; }
    loadProduct();
    loadCategories();
  }, [slug, isAdmin, isTempAdmin]);

  const loadProduct = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*')
      .or(`slug.eq.${slug},name.ilike.${slug}`).single();
    if (!data) { toast.error('Product not found'); navigate('/admin/products'); return; }
    setProduct(data);

    const images: string[] = [];
    if (data.image_url) {
      try { const p = JSON.parse(data.image_url); if (Array.isArray(p)) images.push(...p); else images.push(data.image_url); }
      catch { images.push(data.image_url); }
    }

    setForm({
      name: data.name || '', description: data.description || '',
      price: data.price?.toString() || '', original_price: data.original_price?.toString() || '',
      reseller_price: data.reseller_price?.toString() || '', category: data.category || '',
      images, access_link: data.access_link || '', stock: data.stock?.toString() || '',
      is_active: data.is_active !== false, seo_tags: data.seo_tags || '',
      delivery_mode: data.delivery_mode || 'repeated',
    });

    loadVariations(data.id);
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order');
    setCategories(data || []);
  };

  const loadVariations = async (productId: string) => {
    const { data } = await supabase.from('product_variations').select('*')
      .eq('product_id', productId).order('created_at', { ascending: true });
    setVariations(data || []);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) { toast.error('Name & Category required'); return; }
    setSaving(true);
    const imageUrl = form.images.length > 1 ? JSON.stringify(form.images) : form.images[0] || '';
    const { error } = await supabase.from('products').update({
      name: form.name, description: form.description,
      price: form.price ? parseFloat(form.price) : 0,
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      reseller_price: form.reseller_price ? parseFloat(form.reseller_price) : null,
      category: form.category, image_url: imageUrl,
      access_link: form.access_link || null,
      stock: form.stock ? parseInt(form.stock) : null,
      seo_tags: form.seo_tags || '', is_active: form.is_active,
      delivery_mode: form.delivery_mode,
    }).eq('id', product.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Product saved!');
  };

  const addVariation = async () => {
    if (!newVar.name || !newVar.price) { toast.error('Name & price required'); return; }
    await supabase.from('product_variations').insert({
      product_id: product.id, name: newVar.name, price: parseFloat(newVar.price),
      original_price: newVar.original_price ? parseFloat(newVar.original_price) : null,
      reseller_price: newVar.reseller_price ? parseFloat(newVar.reseller_price) : null,
    });
    toast.success('Variation added!');
    setNewVar({ name: '', price: '', original_price: '', reseller_price: '' });
    loadVariations(product.id);
  };

  const updateVariation = async () => {
    if (!editingVarId || !editVarForm.name || !editVarForm.price) return;
    await supabase.from('product_variations').update({
      name: editVarForm.name, price: parseFloat(editVarForm.price),
      original_price: editVarForm.original_price ? parseFloat(editVarForm.original_price) : null,
      reseller_price: editVarForm.reseller_price ? parseFloat(editVarForm.reseller_price) : null,
    }).eq('id', editingVarId);
    toast.success('Updated!');
    setEditingVarId(null);
    loadVariations(product.id);
  };

  const deleteVariation = async (id: string) => {
    await supabase.from('price_history').delete().eq('variation_id', id);
    await supabase.from('cart_items').delete().eq('variation_id', id);
    await supabase.from('product_variations').delete().eq('id', id);
    toast.success('Deleted!');
    loadVariations(product.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Edit Product</h1>
              <p className="text-xs text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Basic Info */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" /> Basic Info
          </h2>
          <Input placeholder="Product Name *" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
          <Textarea placeholder="Description" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-xl" />
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Active</span>
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> Pricing
            <span className="text-[10px] text-muted-foreground ml-auto">1 USD = ₹{usdRate}</span>
          </h2>
          {/* INR Row */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">🇮🇳 INR (₹)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Price *</label>
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="rounded-xl" placeholder="₹" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Original</label>
                <Input type="number" value={form.original_price} onChange={e => setForm({ ...form, original_price: e.target.value })} className="rounded-xl" placeholder="₹" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reseller</label>
                <Input type="number" value={form.reseller_price} onChange={e => setForm({ ...form, reseller_price: e.target.value })} className="rounded-xl" placeholder="₹" />
              </div>
            </div>
          </div>
          {/* USD Row */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">🇺🇸 USD ($)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Price</label>
                <Input type="number" step="0.01"
                  value={form.price ? (parseFloat(form.price) / usdRate).toFixed(2) : ''}
                  onChange={e => setForm({ ...form, price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
                  className="rounded-xl" placeholder="$" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Original</label>
                <Input type="number" step="0.01"
                  value={form.original_price ? (parseFloat(form.original_price) / usdRate).toFixed(2) : ''}
                  onChange={e => setForm({ ...form, original_price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
                  className="rounded-xl" placeholder="$" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reseller</label>
                <Input type="number" step="0.01"
                  value={form.reseller_price ? (parseFloat(form.reseller_price) / usdRate).toFixed(2) : ''}
                  onChange={e => setForm({ ...form, reseller_price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
                  className="rounded-xl" placeholder="$" />
              </div>
            </div>
          </div>
        </section>

        {/* Images */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Images
            <span className="text-xs text-muted-foreground ml-auto">{form.images.length}/5</span>
          </h2>
          <MultiImageUpload values={form.images} onChange={urls => setForm({ ...form, images: urls })}
            maxImages={5} bucket="product-images" folder="products" />
        </section>

        {/* Stock */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary" /> Stock
          </h2>
          <Input type="number" placeholder="Stock (empty = unlimited)" value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })} className="rounded-xl" />
          <p className="text-xs text-muted-foreground">Delivery links & auto-delivery settings are managed per variation below.</p>
        </section>

        {/* SEO */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> SEO Tags
          </h2>
          <Textarea placeholder="Comma-separated keywords" value={form.seo_tags}
            onChange={e => setForm({ ...form, seo_tags: e.target.value })} rows={2} className="rounded-xl text-sm" />
        </section>

        {/* Variations */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Variations
            <Badge variant="secondary" className="ml-auto">{variations.length}</Badge>
          </h2>

          {/* Existing variations */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {variations.map(v => (
                <motion.div key={v.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-border bg-background">
                  {editingVarId === v.id ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-primary">Editing</span>
                      </div>
                      <Input placeholder="Name" value={editVarForm.name}
                        onChange={e => setEditVarForm({ ...editVarForm, name: e.target.value })} className="rounded-xl" />
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="number" placeholder="Price" value={editVarForm.price}
                          onChange={e => setEditVarForm({ ...editVarForm, price: e.target.value })} className="rounded-xl" />
                        <Input type="number" placeholder="Original" value={editVarForm.original_price}
                          onChange={e => setEditVarForm({ ...editVarForm, original_price: e.target.value })} className="rounded-xl" />
                        <Input type="number" placeholder="Reseller" value={editVarForm.reseller_price}
                          onChange={e => setEditVarForm({ ...editVarForm, reseller_price: e.target.value })} className="rounded-xl" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingVarId(null)} className="rounded-xl">
                          <X className="w-3.5 h-3.5 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={updateVariation} className="rounded-xl">
                          <Check className="w-3.5 h-3.5 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{v.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-bold text-primary">₹{v.price}</span>
                            {v.original_price && <span className="text-xs text-muted-foreground line-through">₹{v.original_price}</span>}
                            {v.reseller_price && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">R: ₹{v.reseller_price}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => {
                            setEditingVarId(v.id);
                            setEditVarForm({
                              name: v.name, price: String(v.price),
                              original_price: v.original_price ? String(v.original_price) : '',
                              reseller_price: v.reseller_price ? String(v.reseller_price) : '',
                            });
                          }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                            onClick={() => deleteVariation(v.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Per-variation auto delivery (show for all variations) */}
                      <VariationDelivery variation={v} productId={product.id} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add variation form */}
          <div className="rounded-xl border border-dashed border-primary/25 bg-primary/[0.02] p-4 space-y-3">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Variation
            </h4>
            <Input placeholder="Variation Name" value={newVar.name}
              onChange={e => setNewVar({ ...newVar, name: e.target.value })} className="rounded-xl" />
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Price" value={newVar.price}
                onChange={e => setNewVar({ ...newVar, price: e.target.value })} className="rounded-xl" />
              <Input type="number" placeholder="Original" value={newVar.original_price}
                onChange={e => setNewVar({ ...newVar, original_price: e.target.value })} className="rounded-xl" />
              <Input type="number" placeholder="Reseller" value={newVar.reseller_price}
                onChange={e => setNewVar({ ...newVar, reseller_price: e.target.value })} className="rounded-xl" />
            </div>
            <Button onClick={addVariation} disabled={!newVar.name || !newVar.price} className="w-full rounded-xl gap-1.5">
              <Plus className="w-4 h-4" /> Add Variation
            </Button>
          </div>
        </section>

        {/* View product link */}
        <div className="text-center pb-8">
          <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate(`/products/${product.slug}`)}>
            <Eye className="w-4 h-4" /> View Product Page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductEditPage;
