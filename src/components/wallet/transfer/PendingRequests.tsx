import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';

interface PendingRequestsProps { userId: string; }

type Req = {
  id: string;
  requester_id: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
  requester?: { name: string; email: string } | null;
};

const PendingRequests: React.FC<PendingRequestsProps> = ({ userId }) => {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payment_requests')
      .select('id, requester_id, amount, note, status, created_at')
      .eq('payer_id', userId).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(10);
    const list = (data as any[]) || [];
    if (list.length) {
      const ids = [...new Set(list.map(r => r.requester_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, email').in('id', ids);
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      list.forEach((r: any) => { r.requester = map.get(r.requester_id); });
    }
    setReqs(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('respond_payment_request', {
        _payer_id: userId, _request_id: id, _accept: accept,
      });
      if (error) throw error;
      toast.success(accept ? 'Payment sent' : 'Request declined');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally { setBusyId(null); }
  };

  if (loading) return null;
  if (reqs.length === 0) return null;

  return (
    <div className="rounded-xl bg-muted p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Inbox className="w-4 h-4" /> Money Requests ({reqs.length})
      </div>
      {reqs.map((r) => (
        <div key={r.id} className="bg-background rounded-lg p-2 space-y-2">
          <div className="text-xs">
            <p className="font-medium text-foreground truncate">{r.requester?.name || 'Someone'}</p>
            <p className="text-muted-foreground truncate">requests ₹{Number(r.amount).toFixed(2)}{r.note ? ` — ${r.note}` : ''}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" className="rounded-lg btn-gradient" disabled={busyId === r.id}
              onClick={() => respond(r.id, true)}>Pay</Button>
            <Button size="sm" variant="outline" className="rounded-lg" disabled={busyId === r.id}
              onClick={() => respond(r.id, false)}>Decline</Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingRequests;
