import React, { useState, useEffect, useMemo } from 'react';
import { Gift, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Package, Users, Award, Settings, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface GiveawayProduct {
  id: string;
  product_id: string;
  variation_id: string | null;
  points_required: number;
  stock: number | null;
  is_active: boolean;
  product?: { name: string; image_url: string | null };
  variation?: { name: string } | null;
}

interface Redemption {
  id: string;
  telegram_id: number;
  points_spent: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  giveaway_product?: { product?: { name: string } };
}

const GiveawayBotManager: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [giveawayProducts, setGiveawayProducts] = useState<GiveawayProduct[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pointsPerReferral, setPointsPerReferral] = useState('2');
  const [tab, setTab] = useState<'products' | 'redemptions' | 'settings'>('products');

  // Add form
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariation, setSelectedVariation] = useState('');
  const [pointsRequired, setPointsRequired] = useState('10');
  const [stock, setStock] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, gpRes, redemRes, settingsRes] = await Promise.all([
        supabase.from('products').select('id, name, image_url').order('name'),
        supabase.from('giveaway_products' as any).select('*, product:products(name, image_url), variation:product_variations(name)').order('created_at', { ascending: false }),
        supabase.from('giveaway_redemptions' as any).select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('giveaway_settings' as any).select('*'),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (gpRes.data) setGiveawayProducts(gpRes.data as any);
      if (redemRes.data) setRedemptions(redemRes.data as any);
      if (settingsRes.data) {
        const ppr = (settingsRes.data as any[]).find((s: any) => s.key === 'points_per_referral');
        if (ppr) setPointsPerReferral(ppr.value || '2');
      }
    } catch {
      toast.error('Failed to fetch data');
    }
    setLoading(false);
  };

  const fetchVariations = async (productId: string) => {
    const { data } = await supabase.from('product_variations').select('id, name, price').eq('product_id', productId).eq('is_active', true);
    setVariations(data || []);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedProduct) fetchVariations(selectedProduct); else setVariations([]); }, [selectedProduct]);

  const addGiveawayProduct = async () => {
    if (!selectedProduct) { toast.error('প্রোডাক্ট সিলেক্ট করুন'); return; }
    const { error } = await supabase.from('giveaway_products' as any).insert({
      product_id: selectedProduct,
      variation_id: selectedVariation || null,
      points_required: parseInt(pointsRequired) || 10,
      stock: stock ? parseInt(stock) : null,
    } as any);
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success('Giveaway product added!');
    setSelectedProduct(''); setSelectedVariation(''); setPointsRequired('10'); setStock('');
    fetchData();
  };

  const removeGiveawayProduct = async (id: string) => {
    await supabase.from('giveaway_products' as any).delete().eq('id', id);
    toast.success('Removed!');
    fetchData();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('giveaway_products' as any).update({ is_active: !current } as any).eq('id', id);
    fetchData();
  };

  const updateRedemption = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('giveaway_redemptions' as any).update({ status, updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success(status === 'approved' ? '✅ Approved!' : '❌ Rejected!');
    fetchData();
  };

  const savePointsPerReferral = async () => {
    await supabase.from('giveaway_settings' as any).update({ value: pointsPerReferral, updated_at: new Date().toISOString() } as any).eq('key', 'points_per_referral');
    toast.success('Points per referral updated!');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-4 border border-purple-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Gift className="w-6 h-6 text-purple-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">Giveaway Bot</h3>
            <p className="text-sm text-muted-foreground">রেফারেল পয়েন্ট দিয়ে ফ্রি প্রোডাক্ট জেতার সিস্টেম</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'products' as const, label: 'Products', icon: Package },
          { key: 'redemptions' as const, label: 'Redemptions', icon: Award },
          { key: 'settings' as const, label: 'Settings', icon: Settings },
        ].map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} className="rounded-xl flex-1" onClick={() => setTab(t.key)}>
            <t.icon className="w-4 h-4 mr-1" /> {t.label}
          </Button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="space-y-3">
          {/* Add Product Form */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Add Giveaway Product
            </h4>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select Product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {variations.length > 0 && (
              <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select Variation (Optional)" /></SelectTrigger>
                <SelectContent>
                  {variations.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} - ₹{v.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Points Required" value={pointsRequired} onChange={e => setPointsRequired(e.target.value)} className="rounded-xl" />
              <Input type="number" placeholder="Stock (empty=unlimited)" value={stock} onChange={e => setStock(e.target.value)} className="rounded-xl" />
            </div>
            <Button className="w-full rounded-xl" onClick={addGiveawayProduct}>
              <Plus className="w-4 h-4 mr-2" /> Add to Giveaway
            </Button>
          </div>

          {/* Product List */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <h4 className="font-semibold text-foreground mb-2">Giveaway Products ({giveawayProducts.length})</h4>
            {giveawayProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No giveaway products yet</p>
            ) : giveawayProducts.map(gp => (
              <div key={gp.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {(gp as any).product?.name || 'Unknown'}
                    {(gp as any).variation?.name && <span className="text-muted-foreground"> • {(gp as any).variation.name}</span>}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">🎯 {gp.points_required} pts</Badge>
                    <Badge variant="outline" className="text-xs">📦 {gp.stock ?? '∞'}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(gp.id, gp.is_active)} className="rounded-lg">
                  {gp.is_active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeGiveawayProduct(gp.id)} className="rounded-lg text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redemptions Tab */}
      {tab === 'redemptions' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <h4 className="font-semibold text-foreground mb-2">Redemption Requests</h4>
          {redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No redemption requests yet</p>
          ) : redemptions.map(r => (
            <div key={r.id} className="p-3 bg-muted/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">TG: <code className="text-xs bg-primary/10 text-primary px-1 rounded">{r.telegram_id}</code></p>
                  <p className="text-xs text-muted-foreground">{r.points_spent} points • {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {r.status === 'pending' ? '⏳' : r.status === 'approved' ? '✅' : '❌'} {r.status}
                </Badge>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 rounded-xl bg-green-600 hover:bg-green-700" onClick={() => updateRedemption(r.id, 'approved')}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 rounded-xl" onClick={() => updateRedemption(r.id, 'rejected')}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Giveaway Settings
          </h4>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Points Per Referral</label>
            <div className="flex gap-2">
              <Input type="number" value={pointsPerReferral} onChange={e => setPointsPerReferral(e.target.value)} className="rounded-xl" />
              <Button onClick={savePointsPerReferral} className="rounded-xl">Save</Button>
            </div>
            <p className="text-xs text-muted-foreground">প্রতিটি সফল রেফারের জন্য কত পয়েন্ট দেওয়া হবে</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiveawayBotManager;
