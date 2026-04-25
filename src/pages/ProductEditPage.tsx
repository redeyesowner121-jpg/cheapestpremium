import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Search, Image as ImageIcon,
  Loader2, Eye, Hash, Settings2, IndianRupee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import MultiImageUpload from '@/components/ui/multi-image-upload';
import VariationsSection from './product-edit/VariationsSection';

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
    if (data && data.length > 0) {
      const lowestPrice = Math.min(...data.map((v: any) => v.price));
      const lowestOriginal = data.some((v: any) => v.original_price) ? Math.min(...data.filter((v: any) => v.original_price).map((v: any) => v.original_price)) : null;
      const lowestReseller = data.some((v: any) => v.reseller_price) ? Math.min(...data.filter((v: any) => v.reseller_price).map((v: any) => v.reseller_price)) : null;
      setForm(prev => ({
        ...prev,
        price: String(lowestPrice),
        original_price: lowestOriginal ? String(lowestOriginal) : '',
        reseller_price: lowestReseller ? String(lowestReseller) : '',
      }));
      await supabase.from('products').update({
        price: lowestPrice,
        original_price: lowestOriginal,
        reseller_price: lowestReseller,
      }).eq('id', productId);
    }
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

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> Pricing
            <span className="text-[10px] text-muted-foreground ml-auto">Auto-synced from lowest variation</span>
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Price</p>
              <p className="text-lg font-bold text-primary">₹{form.price || '0'}</p>
              <p className="text-xs text-muted-foreground">${form.price ? (parseFloat(form.price) / usdRate).toFixed(2) : '0'}</p>
            </div>
            {form.original_price && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Original</p>
                <p className="text-lg font-bold text-muted-foreground line-through">₹{form.original_price}</p>
                <p className="text-xs text-muted-foreground">${(parseFloat(form.original_price) / usdRate).toFixed(2)}</p>
              </div>
            )}
            {form.reseller_price && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Reseller</p>
                <p className="text-lg font-bold text-foreground">₹{form.reseller_price}</p>
                <p className="text-xs text-muted-foreground">${(parseFloat(form.reseller_price) / usdRate).toFixed(2)}</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">1 USD = ₹{usdRate} • Edit prices in Variations below</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Images
            <span className="text-xs text-muted-foreground ml-auto">{form.images.length}/5</span>
          </h2>
          <MultiImageUpload values={form.images} onChange={urls => setForm({ ...form, images: urls })}
            maxImages={5} bucket="product-images" folder="products" />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary" /> Stock
          </h2>
          <Input type="number" placeholder="Stock (empty = unlimited)" value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })} className="rounded-xl" />
          <p className="text-xs text-muted-foreground">Delivery links & auto-delivery settings are managed per variation below.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> SEO Tags
          </h2>
          <Textarea placeholder="Comma-separated keywords" value={form.seo_tags}
            onChange={e => setForm({ ...form, seo_tags: e.target.value })} rows={2} className="rounded-xl text-sm" />
        </section>

        <VariationsSection
          productId={product.id}
          variations={variations}
          usdRate={usdRate}
          editingVarId={editingVarId}
          setEditingVarId={setEditingVarId}
          editVarForm={editVarForm}
          setEditVarForm={setEditVarForm}
          newVar={newVar}
          setNewVar={setNewVar}
          onUpdateVariation={updateVariation}
          onDeleteVariation={deleteVariation}
          onAddVariation={addVariation}
        />

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
