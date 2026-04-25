import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, CheckCircle2, ArrowLeft, RefreshCw, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import AdminEscrowChatPanel from './admin-escrow/AdminEscrowChatPanel';

type Deal = {
  id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  fee_amount: number;
  seller_amount: number;
  description: string;
  status: string;
  delivered_note: string | null;
  dispute_reason: string | null;
  admin_resolution: string | null;
  created_at: string;
};

type ProfileLite = { id: string; name: string; email: string };

const STATUS_FILTERS = ['all', 'disputed', 'funded', 'delivered', 'completed', 'refunded'] as const;

const AdminEscrowPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isTempAdmin } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('disputed');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && !isTempAdmin) navigate('/');
  }, [isAdmin, isTempAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('escrow_deals').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    const list = (data as Deal[]) || [];
    setDeals(list);
    if (list.length) {
      const ids = [...new Set(list.flatMap(d => [d.buyer_id, d.seller_id]))];
      const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', ids);
      setProfiles(new Map((profs || []).map((p: any) => [p.id, p])));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, filter]);

  const resolve = async (dealId: string, action: 'release' | 'refund') => {
    const note = window.prompt(`Note for ${action} (optional):`) || '';
    if (!confirm(`Are you sure you want to ${action.toUpperCase()} this escrow?`)) return;
    setBusyId(dealId);
    try {
      const { error } = await supabase.rpc('admin_resolve_escrow', {
        _admin_id: user!.id, _deal_id: dealId, _action: action, _note: note || null,
      });
      if (error) throw error;
      toast.success(`Escrow ${action}d`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally { setBusyId(null); }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Button size="icon" variant="ghost" onClick={() => navigate('/admin/control')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground flex-1">Escrow Management</h1>
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap capitalize ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : deals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No deals in this category.</div>
        ) : (
          <div className="space-y-3">
            {deals.map((d) => {
              const buyer = profiles.get(d.buyer_id);
              const seller = profiles.get(d.seller_id);
              const isDispute = d.status === 'disputed';
              return (
                <div key={d.id} className={`rounded-xl border p-4 space-y-3 ${isDispute ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Deal #{d.id.slice(0, 8)}</p>
                      <p className="font-semibold text-foreground">{d.description}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${isDispute ? 'bg-red-500/15 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                      {isDispute && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-muted-foreground">Buyer</p>
                      <p className="font-medium text-foreground truncate">{buyer?.name || '—'}</p>
                      <p className="text-muted-foreground truncate">{buyer?.email || ''}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-muted-foreground">Seller</p>
                      <p className="font-medium text-foreground truncate">{seller?.name || '—'}</p>
                      <p className="text-muted-foreground truncate">{seller?.email || ''}</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Held</span><span>₹{Number(d.amount).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Fee (2%)</span><span>₹{Number(d.fee_amount).toFixed(2)}</span></div>
                    <div className="flex justify-between font-medium text-foreground"><span>Seller gets</span><span>₹{Number(d.seller_amount).toFixed(2)}</span></div>
                  </div>

                  {d.delivered_note && (
                    <div className="text-xs bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
                      <p className="font-medium text-blue-700">Delivery note</p>
                      <p className="text-muted-foreground">{d.delivered_note}</p>
                    </div>
                  )}
                  {d.dispute_reason && (
                    <div className="text-xs bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                      <p className="font-medium text-red-700">Dispute reason</p>
                      <p className="text-muted-foreground">{d.dispute_reason}</p>
                    </div>
                  )}
                  {d.admin_resolution && (
                    <div className="text-xs bg-green-500/5 border border-green-500/20 rounded-lg p-2 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <div><p className="font-medium text-green-700">Admin resolution</p>
                      <p className="text-muted-foreground">{d.admin_resolution}</p></div>
                    </div>
                  )}

                  {['funded', 'delivered', 'disputed'].includes(d.status) && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" disabled={busyId === d.id}
                        className="rounded-lg bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => resolve(d.id, 'release')}>
                        Release to Seller
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === d.id}
                        className="rounded-lg border-red-500/40 text-red-600 hover:bg-red-500/10"
                        onClick={() => resolve(d.id, 'refund')}>
                        Refund Buyer
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default AdminEscrowPage;
