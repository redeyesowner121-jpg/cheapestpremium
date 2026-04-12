import React, { useState, useEffect, useMemo } from 'react';
import { Gift, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Package, Users, Award, Settings, Search, Radio, Crown, Eye, UserMinus, UserPlus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Tab = 'overview' | 'products' | 'users' | 'redemptions' | 'channels' | 'settings';

const GiveawayBotManager: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [giveawayProducts, setGiveawayProducts] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Top users
  const [topUsers, setTopUsers] = useState<any[]>([]);

  // Add form
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariation, setSelectedVariation] = useState('');
  const [pointsRequired, setPointsRequired] = useState('10');
  const [stock, setStock] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Settings
  const [pointsPerReferral, setPointsPerReferral] = useState('2');

  // Channels (giveaway uses hardcoded channels in code, but we show them)
  const GIVEAWAY_CHANNELS = ['@rkrxott', '@rkrxmethods'];

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, gpRes, redemRes, settingsRes, pointsRes, referralsRes] = await Promise.all([
        supabase.from('products').select('id, name, image_url').order('name'),
        supabase.from('giveaway_products' as any).select('*, product:products(name, image_url), variation:product_variations(name)').order('created_at', { ascending: false }),
        supabase.from('giveaway_redemptions' as any).select('*, giveaway_product:giveaway_products(product:products(name))').order('created_at', { ascending: false }).limit(50),
        supabase.from('giveaway_settings' as any).select('*'),
        supabase.from('giveaway_points' as any).select('telegram_id, points, total_referrals').order('points', { ascending: false }),
        supabase.from('giveaway_referrals' as any).select('id', { count: 'exact', head: true }),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (gpRes.data) setGiveawayProducts(gpRes.data as any);
      if (redemRes.data) setRedemptions(redemRes.data as any);

      const allPoints = (pointsRes.data as any[]) || [];
      const totalPoints = allPoints.reduce((s: number, p: any) => s + (p.points || 0), 0);
      const totalReferrals = (referralsRes as any).count || 0;
      const activeProducts = (gpRes.data as any[])?.filter((g: any) => g.is_active).length || 0;

      setStats({
        totalUsers: allPoints.length,
        totalPoints,
        totalReferrals,
        totalRedemptions: (redemRes.data as any[])?.length || 0,
        activeProducts,
      });

      // Top users with names
      const top15 = allPoints.slice(0, 15);
      const enriched = [];
      for (const u of top15) {
        const { data: userInfo } = await supabase.from('telegram_bot_users' as any)
          .select('username, first_name').eq('telegram_id', u.telegram_id).maybeSingle();
        enriched.push({
          ...u,
          name: (userInfo as any)?.username ? `@${(userInfo as any).username}` : (userInfo as any)?.first_name || String(u.telegram_id),
        });
      }
      setTopUsers(enriched);

      if (settingsRes.data) {
        const ppr = (settingsRes.data as any[]).find((s: any) => s.key === 'points_per_referral');
        if (ppr) setPointsPerReferral(ppr.value || '2');
      }
    } catch { toast.error('Failed to fetch data'); }
    setLoading(false);
  };

  const fetchVariations = async (productId: string) => {
    const { data } = await supabase.from('product_variations').select('id, name, price').eq('product_id', productId).eq('is_active', true);
    setVariations(data || []);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedProduct) fetchVariations(selectedProduct); else setVariations([]); }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  const selectedProductName = useMemo(() => products.find(p => p.id === selectedProduct)?.name || '', [products, selectedProduct]);

  const addGiveawayProduct = async () => {
    if (!selectedProduct) { toast.error('Select a product'); return; }
    await supabase.from('giveaway_products' as any).insert({
      product_id: selectedProduct,
      variation_id: selectedVariation || null,
      points_required: parseInt(pointsRequired) || 10,
      stock: stock ? parseInt(stock) : null,
    } as any);
    toast.success('✅ Giveaway product added!');
    setSelectedProduct(''); setSelectedVariation(''); setPointsRequired('10'); setStock('');
    fetchData();
  };

  const removeGiveawayProduct = async (id: string) => {
    await supabase.from('giveaway_products' as any).delete().eq('id', id);
    toast.success('Removed!'); fetchData();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('giveaway_products' as any).update({ is_active: !current } as any).eq('id', id);
    fetchData();
  };

  const savePointsPerReferral = async () => {
    await supabase.from('giveaway_settings' as any).upsert(
      { key: 'points_per_referral', value: pointsPerReferral, updated_at: new Date().toISOString() } as any,
      { onConflict: 'key' }
    );
    toast.success('Points per referral updated!');
  };

  const viewUserDetail = async (tgId: number) => {
    const [pointsRes, referralsRes, redemptionsRes, userRes] = await Promise.all([
      supabase.from('giveaway_points' as any).select('*').eq('telegram_id', tgId).maybeSingle(),
      supabase.from('giveaway_referrals' as any).select('referred_telegram_id, points_awarded, created_at')
        .eq('referrer_telegram_id', tgId).order('created_at', { ascending: false }).limit(10),
      supabase.from('giveaway_redemptions' as any).select('*, giveaway_product:giveaway_products(product:products(name))')
        .eq('telegram_id', tgId).order('created_at', { ascending: false }).limit(10),
      supabase.from('telegram_bot_users' as any).select('username, first_name, telegram_id').eq('telegram_id', tgId).maybeSingle(),
    ]);
    setSelectedUser({
      ...((userRes.data as any) || {}),
      points: (pointsRes.data as any),
      referrals: (referralsRes.data as any[]) || [],
      redemptions: (redemptionsRes.data as any[]) || [],
    });
    setShowUserModal(true);
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: Gift },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'redemptions', label: 'Redemptions', icon: Award },
    { key: 'channels', label: 'Channels', icon: Radio },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'ghost'}
            className="rounded-xl gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setTab(t.key)}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {/* === OVERVIEW === */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-4 border border-purple-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 rounded-xl"><Gift className="w-6 h-6 text-purple-500" /></div>
                <div>
                  <h3 className="font-bold text-foreground">Giveaway Bot</h3>
                  <p className="text-xs text-muted-foreground">@RKRxGiveaway_bot</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Users', value: stats?.totalUsers || 0, color: 'text-purple-500' },
                { label: 'Total Pts', value: stats?.totalPoints || 0, color: 'text-yellow-500' },
                { label: 'Referrals', value: stats?.totalReferrals || 0, color: 'text-blue-500' },
                { label: 'Products', value: stats?.activeProducts || 0, color: 'text-green-500' },
                { label: 'Redeemed', value: stats?.totalRedemptions || 0, color: 'text-orange-500' },
                { label: 'Channels', value: GIVEAWAY_CHANNELS.length, color: 'text-cyan-500' },
              ].map((s, i) => (
                <div key={i} className="bg-background/50 rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Top Users
            </h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {topUsers.map((u, i) => (
                <div key={u.telegram_id}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50"
                  onClick={() => viewUserDetail(u.telegram_id)}>
                  <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">🎯 {u.points}</Badge>
                  <Badge variant="outline" className="text-xs">👥 {u.total_referrals}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === PRODUCTS === */}
      {tab === 'products' && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Add Giveaway Product</h4>
            <Popover open={productDropdownOpen} onOpenChange={setProductDropdownOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full rounded-xl justify-between font-normal">
                  {selectedProductName || 'Select Product'}<Search className="w-4 h-4 ml-2 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2 max-h-72" align="start">
                <Input placeholder="Search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="rounded-lg mb-2" autoFocus />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredProducts.map(p => (
                    <button key={p.id} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent flex items-center gap-2 ${selectedProduct === p.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                      onClick={() => { setSelectedProduct(p.id); setProductDropdownOpen(false); setProductSearch(''); }}>
                      {p.image_url && <img src={p.image_url} className="w-6 h-6 rounded object-cover" alt="" />}
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {variations.length > 0 && (
              <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Variation (Optional)" /></SelectTrigger>
                <SelectContent>{variations.map(v => <SelectItem key={v.id} value={v.id}>{v.name} - ₹{v.price}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Points" value={pointsRequired} onChange={e => setPointsRequired(e.target.value)} className="rounded-xl" />
              <Input type="number" placeholder="Stock (∞)" value={stock} onChange={e => setStock(e.target.value)} className="rounded-xl" />
            </div>
            <Button className="w-full rounded-xl" onClick={addGiveawayProduct}><Plus className="w-4 h-4 mr-2" /> Add</Button>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <h4 className="font-semibold mb-2">Products ({giveawayProducts.length})</h4>
            {giveawayProducts.map(gp => (
              <div key={gp.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium">{gp.product?.name || '?'}{gp.variation?.name && ` • ${gp.variation.name}`}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">🎯 {gp.points_required} pts</Badge>
                    <Badge variant="outline" className="text-xs">📦 {gp.stock ?? '∞'}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(gp.id, gp.is_active)} className="rounded-lg">
                  {gp.is_active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive rounded-lg" onClick={() => removeGiveawayProduct(gp.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === USERS === */}
      {tab === 'users' && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <h4 className="font-semibold mb-3">👥 All Giveaway Users ({topUsers.length})</h4>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {topUsers.map((u, i) => (
              <div key={u.telegram_id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50"
                onClick={() => viewUserDetail(u.telegram_id)}>
                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground"><code>{u.telegram_id}</code></p>
                </div>
                <Badge variant="secondary" className="text-xs">🎯{u.points}</Badge>
                <Badge variant="outline" className="text-xs">👥{u.total_referrals}</Badge>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === REDEMPTIONS === */}
      {tab === 'redemptions' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <h4 className="font-semibold mb-2">🎁 Redemptions</h4>
          {redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No redemptions yet</p>
          ) : redemptions.map(r => (
            <div key={r.id} className="p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.giveaway_product?.product?.name || '?'}</p>
                  <p className="text-xs text-muted-foreground">
                    TG: <code>{r.telegram_id}</code> • {r.points_spent} pts • {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={r.status === 'completed' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {r.status === 'completed' ? '✅' : r.status === 'approved' ? '✅' : r.status === 'rejected' ? '❌' : '⏳'} {r.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === CHANNELS === */}
      {tab === 'channels' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> Required Channels</h4>
          <p className="text-xs text-muted-foreground">গিভওয়ে বটের চ্যানেলগুলো কোডে হার্ডকোড করা আছে। পরিবর্তন করতে ডেভেলপারকে জানান।</p>
          {GIVEAWAY_CHANNELS.map((ch, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-xl">
              <Radio className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium flex-1">{ch}</span>
              <Button size="sm" variant="outline" className="rounded-lg text-xs"
                onClick={() => window.open(`https://t.me/${ch.replace('@', '')}`, '_blank')}>
                Open
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* === SETTINGS === */}
      {tab === 'settings' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <h4 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Giveaway Settings</h4>
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

      {/* User Detail Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>👤 Giveaway User</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.first_name || '?'}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono text-xs">{selectedUser.telegram_id}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Points</p>
                  <p className="font-bold text-yellow-600">🎯 {selectedUser.points?.points || 0}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Referrals</p>
                  <p className="font-bold">👥 {selectedUser.points?.total_referrals || 0}</p>
                </div>
              </div>

              {selectedUser.referrals?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-1">📎 Referrals ({selectedUser.referrals.length})</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedUser.referrals.map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-lg text-xs">
                        <span>👤 <code>{r.referred_telegram_id}</code></span>
                        <span className="ml-auto">+{r.points_awarded} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUser.redemptions?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-1">🎁 Redemptions ({selectedUser.redemptions.length})</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedUser.redemptions.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-lg text-xs">
                        <span>{r.status === 'completed' ? '✅' : '⏳'}</span>
                        <span className="flex-1 truncate">{r.giveaway_product?.product?.name || '?'}</span>
                        <span>{r.points_spent} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiveawayBotManager;
