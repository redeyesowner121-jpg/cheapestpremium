import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, RefreshCw, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface LogRow {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string;
  subject: string | null;
  provider: string;
  status: string;
  error_message: string | null;
  order_id: string | null;
  announcement_id: string | null;
  metadata: any;
  created_at: string;
}

const RANGES = [
  { key: '24h', label: 'Last 24h', hours: 24 },
  { key: '7d', label: '7 days', hours: 24 * 7 },
  { key: '30d', label: '30 days', hours: 24 * 30 },
  { key: 'all', label: 'All', hours: 0 },
];

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    sent: { cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { cls: 'bg-red-500/10 text-red-600 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
    pending: { cls: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: <Clock className="w-3 h-3" /> },
  };
  const m = map[status] || { cls: 'bg-muted text-muted-foreground border-border', icon: null };
  return (
    <Badge variant="outline" className={`gap-1 ${m.cls}`}>
      {m.icon}
      {status}
    </Badge>
  );
};

const AdminEmailLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LogRow | null>(null);

  useEffect(() => {
    if (!isAdmin && !isTempAdmin) navigate('/');
  }, [isAdmin, isTempAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const r = RANGES.find((x) => x.key === range) || RANGES[1];
    let q = supabase.from('email_send_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (r.hours > 0) {
      const since = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
      q = q.gte('created_at', since);
    }
    const { data, error } = await q;
    if (error) console.error(error);
    setLogs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const templates = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.template_name && set.add(l.template_name));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (templateFilter !== 'all' && l.template_name !== templateFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const blob = `${l.recipient_email} ${l.subject || ''} ${l.error_message || ''} ${l.order_id || ''}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [logs, statusFilter, templateFilter, search]);

  const stats = useMemo(() => {
    const out = { total: filtered.length, sent: 0, failed: 0, pending: 0 };
    filtered.forEach((l) => {
      if (l.status === 'sent') out.sent++;
      else if (l.status === 'failed') out.failed++;
      else if (l.status === 'pending') out.pending++;
    });
    return out;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/control')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Mail className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">Email Delivery Logs</h1>
            <p className="text-xs text-muted-foreground">Every send attempt with status & errors</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Sent', value: stats.sent, color: 'text-emerald-600' },
            { label: 'Failed', value: stats.failed, color: 'text-red-600' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email, subject, order…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Loading logs…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No email logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Recipient</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Template</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Subject</th>
                    <th className="text-left px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelected(l)}
                    >
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                      <td className="px-4 py-3 font-medium">{l.recipient_email}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{l.template_name || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground truncate max-w-xs">{l.subject || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Email Details</h3>
              <StatusBadge status={selected.status} />
            </div>
            <div className="p-5 space-y-3 text-sm">
              <Row label="Recipient" value={selected.recipient_email} />
              <Row label="Subject" value={selected.subject || '—'} />
              <Row label="Template" value={selected.template_name || '—'} />
              <Row label="Provider" value={selected.provider} />
              <Row label="Message ID" value={selected.message_id || '—'} mono />
              <Row label="Order ID" value={selected.order_id || '—'} mono />
              <Row label="Announcement ID" value={selected.announcement_id || '—'} mono />
              <Row label="Sent at" value={new Date(selected.created_at).toLocaleString()} />
              {selected.error_message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Error</p>
                  <pre className="bg-red-500/10 border border-red-500/30 text-red-600 p-3 rounded-lg text-xs whitespace-pre-wrap break-all">
                    {selected.error_message}
                  </pre>
                </div>
              )}
              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <Button className="w-full" variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className={`text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

export default AdminEmailLogsPage;
