import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Flag, ChevronDown, ChevronUp, Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrderReport {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  details: string | null;
  status: string;
  admin_response: string | null;
  created_at: string;
  email_status?: string | null;
  email_error?: string | null;
  email_sent_at?: string | null;
  orders?: { product_name: string; total_price: number; status: string } | null;
  profiles?: { name: string | null; email: string } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-primary/10 text-primary',
  resolved: 'bg-success/10 text-success',
  dismissed: 'bg-muted text-muted-foreground',
};

const AdminOrderReports: React.FC = () => {
  const [reports, setReports] = useState<OrderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('pending');
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const reportsData = (data || []) as OrderReport[];
    // Enrich with order + profile info
    const orderIds = [...new Set(reportsData.map((r) => r.order_id))];
    const userIds = [...new Set(reportsData.map((r) => r.user_id))];
    const [{ data: ordersData }, { data: profilesData }] = await Promise.all([
      supabase.from('orders').select('id, product_name, total_price, status').in('id', orderIds),
      supabase.from('profiles').select('id, name, email').in('id', userIds),
    ]);
    const oMap = new Map((ordersData || []).map((o: any) => [o.id, o]));
    const pMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
    setReports(
      reportsData.map((r) => ({
        ...r,
        orders: oMap.get(r.order_id) || null,
        profiles: pMap.get(r.user_id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const admin_response = responseDraft[id]?.trim() || null;
    const { error } = await supabase
      .from('order_reports')
      .update({ status, admin_response })
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`Report ${status}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    const { error } = await supabase.from('order_reports').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Report deleted');
    load();
  };

  const filtered = reports.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-destructive" />
          <h3 className="font-semibold text-foreground">Order Reports</h3>
          {pendingCount > 0 && (
            <span className="text-xs bg-destructive text-white px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {(['pending', 'resolved', 'dismissed', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-xl font-medium whitespace-nowrap ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span className="ml-1">({reports.filter((r) => s === 'all' || r.status === s).length})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading reports...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No reports</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const isOpen = openId === r.id;
                return (
                  <div key={r.id} className="bg-muted/40 rounded-xl p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {r.orders?.product_name || 'Unknown product'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.profiles?.name || r.profiles?.email || 'User'} •{' '}
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs mt-1">
                          <span className="font-medium text-destructive">{r.reason}</span>
                          {r.orders && (
                            <span className="text-muted-foreground"> • Order ₹{r.orders.total_price}</span>
                          )}
                        </p>
                    </div>

                    {/* Email delivery status */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Admin email:</span>
                      {r.email_status === 'sent' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                          ✅ Sent {r.email_sent_at ? `· ${new Date(r.email_sent_at).toLocaleTimeString()}` : ''}
                        </span>
                      ) : r.email_status === 'failed' ? (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium"
                          title={r.email_error || ''}
                        >
                          ❌ Failed
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          ⏳ Pending
                        </span>
                      )}
                      {(r.email_status === 'failed' || r.email_status === 'pending' || !r.email_status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2"
                          onClick={async () => {
                            const { error } = await supabase.functions.invoke('notify-admin-report', {
                              body: {
                                report_id: r.id,
                                order_id: r.order_id,
                                reason: r.reason,
                                details: r.details,
                              },
                            });
                            if (error) toast.error('Resend failed');
                            else {
                              toast.success('Email resent');
                              load();
                            }
                          }}
                        >
                          Retry
                        </Button>
                      )}
                      {r.email_error && r.email_status === 'failed' && (
                        <p className="text-[10px] text-destructive w-full break-all">
                          {r.email_error}
                        </p>
                      )}
                    </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </div>

                    {r.details && (
                      <p className="text-xs text-foreground bg-background/60 rounded p-2 mt-2 whitespace-pre-wrap">
                        {r.details}
                      </p>
                    )}

                    {r.admin_response && (
                      <p className="text-xs text-success bg-success/10 rounded p-2 mt-2">
                        ↳ {r.admin_response}
                      </p>
                    )}

                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setOpenId(isOpen ? null : r.id)}
                      >
                        {isOpen ? 'Close' : 'Respond'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          rows={2}
                          placeholder="Optional response (saved with status)"
                          value={responseDraft[r.id] ?? r.admin_response ?? ''}
                          onChange={(e) =>
                            setResponseDraft((d) => ({ ...d, [r.id]: e.target.value }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 bg-success hover:bg-success/90 text-white"
                            onClick={() => updateStatus(r.id, 'resolved')}
                          >
                            <Check className="w-3 h-3 mr-1" /> Mark Resolved
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => updateStatus(r.id, 'dismissed')}
                          >
                            <X className="w-3 h-3 mr-1" /> Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminOrderReports;
