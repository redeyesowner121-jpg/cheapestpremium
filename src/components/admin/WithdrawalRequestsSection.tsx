import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, User, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  telegram_id: number | null;
  amount: number;
  method: string;
  account_details: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  profiles?: { name: string; email: string; wallet_balance: number };
}

interface WithdrawalRequestsSectionProps {
  onDataChange: () => void;
}

const WithdrawalRequestsSection: React.FC<WithdrawalRequestsSectionProps> = ({ onDataChange }) => {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<WithdrawalRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadRequests = async () => {
    const { data } = await supabase
      .from('withdrawal_requests')
      .select('*, profiles:user_id(name, email, wallet_balance)')
      .order('created_at', { ascending: false })
      .limit(100);
    setRequests((data as any) || []);
  };

  useEffect(() => { loadRequests(); }, []);

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);

  const handleSelect = (r: WithdrawalRequest) => {
    setSelected(r);
    setAdminNote(r.admin_note || '');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', selected.user_id)
        .single();

      if (!profile || (profile.wallet_balance || 0) < selected.amount) {
        toast.error('User has insufficient balance for this withdrawal');
        setProcessing(false);
        return;
      }

      // Deduct balance
      await supabase.from('profiles').update({
        wallet_balance: (profile.wallet_balance || 0) - selected.amount,
      }).eq('id', selected.user_id);

      // Update status
      await supabase.from('withdrawal_requests').update({
        status: 'approved',
        admin_note: adminNote || null,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);

      // Create transaction record
      await supabase.from('transactions').insert({
        user_id: selected.user_id,
        type: 'withdrawal',
        amount: -selected.amount,
        status: 'completed',
        description: `Withdrawal via ${selected.method.toUpperCase()} to ${selected.account_details}`,
      });

      // Notify user
      await supabase.from('notifications').insert({
        user_id: selected.user_id,
        title: 'Withdrawal Approved! ✅',
        message: `Your withdrawal of ₹${selected.amount} via ${selected.method.toUpperCase()} has been approved and will be sent to ${selected.account_details}.`,
        type: 'wallet',
      });

      toast.success('Withdrawal approved & balance deducted');
      setShowModal(false);
      loadRequests();
      onDataChange();
    } catch {
      toast.error('Failed to approve withdrawal');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await supabase.from('withdrawal_requests').update({
        status: 'rejected',
        admin_note: adminNote || 'Rejected by admin',
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);

      await supabase.from('notifications').insert({
        user_id: selected.user_id,
        title: 'Withdrawal Rejected ❌',
        message: `Your withdrawal of ₹${selected.amount} was rejected.${adminNote ? ` Reason: ${adminNote}` : ''}`,
        type: 'wallet',
      });

      toast.success('Withdrawal rejected');
      setShowModal(false);
      loadRequests();
      onDataChange();
    } catch {
      toast.error('Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (s: string) => {
    if (s === 'approved') return 'bg-success/10 text-success';
    if (s === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-warning/10 text-warning';
  };

  const getStatusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle className="w-4 h-4" />;
    if (s === 'rejected') return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && requests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowDownToLine className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No {filter === 'all' ? '' : filter} withdrawal requests</p>
          </div>
        ) : filtered.map(r => (
          <div key={r.id} onClick={() => handleSelect(r)}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{(r as any).profiles?.name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{r.method.toUpperCase()} • {r.account_details}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">₹{r.amount}</p>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getStatusColor(r.status)}`}>
                {getStatusIcon(r.status)}{r.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Withdrawal Request Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{(selected as any).profiles?.name}</p>
                    <p className="text-sm text-muted-foreground">{(selected as any).profiles?.email}</p>
                    <p className="text-xs text-muted-foreground">Balance: ₹{(selected as any).profiles?.wallet_balance || 0}</p>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Withdrawal Amount</p>
                <p className="text-3xl font-bold text-red-600">₹{selected.amount}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium uppercase">{selected.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{selected.method === 'upi' ? 'UPI ID' : 'Binance Pay ID'}</span>
                  <span className="font-medium font-mono">{selected.account_details}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(selected.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${getStatusColor(selected.status)}`}>
                    {getStatusIcon(selected.status)}{selected.status}
                  </span>
                </div>
              </div>

              {selected.status === 'pending' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Admin Note (Optional)</label>
                    <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Add a note..." className="rounded-xl" rows={2} />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} disabled={processing} className="flex-1 bg-success hover:bg-success/90">
                      <CheckCircle className="w-4 h-4 mr-2" />Approve
                    </Button>
                    <Button onClick={handleReject} disabled={processing} variant="destructive" className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" />Reject
                    </Button>
                  </div>
                </>
              )}
              {selected.status !== 'pending' && (
                <div className="text-center text-muted-foreground text-sm py-2">
                  This request has been {selected.status}
                  {selected.admin_note && <p className="mt-2 p-2 bg-muted rounded-lg"><strong>Note:</strong> {selected.admin_note}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WithdrawalRequestsSection;
