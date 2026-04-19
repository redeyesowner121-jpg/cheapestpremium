import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Mail, UserPlus, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface NetflixAccount {
  id: string;
  email: string;
  password: string;
  label: string | null;
  status: string;
  max_users: number;
  created_at: string;
}

interface Assignment {
  id: string;
  netflix_account_id: string;
  buyer_telegram_id: number;
  product_name: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  netflix_accounts?: { email: string };
}

const NetflixBotManager: React.FC = () => {
  const [accounts, setAccounts] = useState<NetflixAccount[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recentOtps, setRecentOtps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [newAccount, setNewAccount] = useState({ email: '', password: '', label: '', max_users: 5 });
  const [newAssign, setNewAssign] = useState({ netflix_account_id: '', buyer_telegram_id: '', product_name: '', expires_at: '' });

  const load = async () => {
    setLoading(true);
    const [acc, asn, otps] = await Promise.all([
      supabase.from('netflix_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('netflix_assignments').select('*, netflix_accounts(email)').order('created_at', { ascending: false }).limit(50),
      supabase.from('netflix_otp_logs').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setAccounts((acc.data as any) || []);
    setAssignments((asn.data as any) || []);
    setRecentOtps(otps.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addAccount = async () => {
    if (!newAccount.email || !newAccount.password) {
      toast({ title: 'Email and password required', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('netflix_accounts').insert(newAccount);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: '✅ Account added' });
      setNewAccount({ email: '', password: '', label: '', max_users: 5 });
      setShowAddAccount(false);
      load();
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this Netflix account?')) return;
    await supabase.from('netflix_accounts').delete().eq('id', id);
    toast({ title: 'Deleted' });
    load();
  };

  const assignBuyer = async () => {
    if (!newAssign.netflix_account_id || !newAssign.buyer_telegram_id) {
      toast({ title: 'Account and Telegram ID required', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('netflix_assignments').insert({
      netflix_account_id: newAssign.netflix_account_id,
      buyer_telegram_id: parseInt(newAssign.buyer_telegram_id),
      product_name: newAssign.product_name || null,
      expires_at: newAssign.expires_at || null,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: '✅ Buyer assigned' });
      setNewAssign({ netflix_account_id: '', buyer_telegram_id: '', product_name: '', expires_at: '' });
      setShowAssign(false);
      load();
    }
  };

  const revokeAssignment = async (id: string) => {
    await supabase.from('netflix_assignments').update({ is_active: false }).eq('id', id);
    toast({ title: 'Revoked' });
    load();
  };

  const triggerPoll = async () => {
    setPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke('netflix-otp-poller');
      if (error) throw error;
      toast({ title: '✅ Poll complete', description: `Checked: ${data.checked}, Forwarded: ${data.forwarded}` });
      load();
    } catch (e: any) {
      toast({ title: '❌ Poll failed', description: e.message, variant: 'destructive' });
    }
    setPolling(false);
  };

  const setupWebhook = async () => {
    const { data, error } = await supabase.functions.invoke('netflix-set-webhook');
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: '✅ Webhook set', description: JSON.stringify(data.telegram) });
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowAddAccount(true)} className="gap-2"><Plus className="w-4 h-4" />Add Netflix Account</Button>
        <Button onClick={() => setShowAssign(true)} variant="outline" className="gap-2"><UserPlus className="w-4 h-4" />Assign Buyer</Button>
        <Button onClick={triggerPoll} variant="outline" disabled={polling} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} />Poll Now
        </Button>
        <Button onClick={setupWebhook} variant="ghost" size="sm">Setup Bot Webhook</Button>
      </div>

      {/* Accounts */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Mail className="w-4 h-4" />Netflix Accounts ({accounts.length})</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet. Add one to get started.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="text-sm">
                  <div className="font-mono">{a.email}</div>
                  {a.label && <div className="text-xs text-muted-foreground">{a.label}</div>}
                </div>
                <Button onClick={() => deleteAccount(a.id)} variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Assignments */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Active Assignments ({assignments.filter(a => a.is_active).length})</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id} className={`flex items-center justify-between p-2 rounded-lg ${a.is_active ? 'bg-muted/50' : 'bg-muted/20 opacity-60'}`}>
                <div className="text-sm">
                  <div className="font-mono">{a.netflix_accounts?.email}</div>
                  <div className="text-xs text-muted-foreground">TG: {a.buyer_telegram_id} {a.product_name && `· ${a.product_name}`}</div>
                </div>
                {a.is_active && (
                  <Button onClick={() => revokeAssignment(a.id)} variant="ghost" size="sm">Revoke</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent OTPs */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Recent OTP Activity</h3>
        {recentOtps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No OTPs yet.</p>
        ) : (
          <div className="space-y-2">
            {recentOtps.map(o => (
              <div key={o.id} className="p-2 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  {o.forward_status === 'sent' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-yellow-600" />}
                  <span className="font-mono">{o.otp_code || '—'}</span>
                  <span className="text-xs text-muted-foreground">→ {o.netflix_email}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{o.email_subject} · {new Date(o.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Account Modal */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Netflix Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Netflix Email</Label><Input value={newAccount.email} onChange={e => setNewAccount({ ...newAccount, email: e.target.value })} placeholder="user@netflix.com" /></div>
            <div><Label>Password</Label><Input type="password" value={newAccount.password} onChange={e => setNewAccount({ ...newAccount, password: e.target.value })} /></div>
            <div><Label>Label (optional)</Label><Input value={newAccount.label} onChange={e => setNewAccount({ ...newAccount, label: e.target.value })} placeholder="Premium 4K - Profile A" /></div>
            <div><Label>Max Users</Label><Input type="number" value={newAccount.max_users} onChange={e => setNewAccount({ ...newAccount, max_users: parseInt(e.target.value) || 5 })} /></div>
            <Button onClick={addAccount} className="w-full">Add Account</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Buyer to Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Netflix Account</Label>
              <select className="w-full p-2 border rounded-md bg-background" value={newAssign.netflix_account_id} onChange={e => setNewAssign({ ...newAssign, netflix_account_id: e.target.value })}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
              </select>
            </div>
            <div><Label>Buyer Telegram ID</Label><Input value={newAssign.buyer_telegram_id} onChange={e => setNewAssign({ ...newAssign, buyer_telegram_id: e.target.value })} placeholder="123456789" /></div>
            <div><Label>Product Name (optional)</Label><Input value={newAssign.product_name} onChange={e => setNewAssign({ ...newAssign, product_name: e.target.value })} placeholder="Netflix Premium 1 Month" /></div>
            <div><Label>Expires At (optional)</Label><Input type="datetime-local" value={newAssign.expires_at} onChange={e => setNewAssign({ ...newAssign, expires_at: e.target.value })} /></div>
            <Button onClick={assignBuyer} className="w-full">Assign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NetflixBotManager;
