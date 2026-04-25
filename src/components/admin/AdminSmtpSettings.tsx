import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Save, Send, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SmtpForm {
  id?: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  is_active: boolean;
}

const DEFAULTS: SmtpForm = {
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  username: 'support@cheapest-premiums.in',
  password: '',
  from_email: 'support@cheapest-premiums.in',
  from_name: 'Cheapest Premiums',
  is_active: true,
};

export default function AdminSmtpSettings() {
  const [form, setForm] = useState<SmtpForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [testTo, setTestTo] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('smtp_settings' as any)
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setForm({ ...DEFAULTS, ...(data as any), password: '' });
    setLoading(false);
  }

  async function save() {
    if (!form.host || !form.username || !form.from_email) {
      toast.error('Host, username, from email required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        host: form.host, port: form.port, secure: form.secure,
        username: form.username, from_email: form.from_email,
        from_name: form.from_name, is_active: form.is_active,
      };
      if (form.password) payload.password = form.password;

      if (form.id) {
        const { error } = await supabase.from('smtp_settings' as any).update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        if (!form.password) { toast.error('Password is required for first save'); setSaving(false); return; }
        const { error } = await supabase.from('smtp_settings' as any).insert(payload);
        if (error) throw error;
      }
      toast.success('SMTP settings saved');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  }

  async function sendTest() {
    if (!testTo) { toast.error('Enter a test email'); return; }
    setTesting(true);
    try {
      const body: any = { to: testTo };
      // If password is typed, test live before saving
      if (form.password) {
        body.host = form.host; body.port = form.port; body.secure = form.secure;
        body.username = form.username; body.password = form.password;
        body.from_email = form.from_email; body.from_name = form.from_name;
      }
      const { data, error } = await supabase.functions.invoke('test-smtp', { body });
      if (error) throw error;
      if (data?.success) toast.success(data.message || 'Test email sent');
      else toast.error(data?.error || 'Test failed');
    } catch (e: any) {
      toast.error(e.message || 'Test failed');
    } finally { setTesting(false); }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-border rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Direct SMTP Email Setup</p>
            <p className="text-muted-foreground">Use your own email server (Hostinger, Gmail, Zoho ইত্যাদি)। সব order/notification/broadcast এই server দিয়ে যাবে — Resend লাগবে না।</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>SMTP Host</Label>
            <Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="smtp.hostinger.com" />
          </div>
          <div>
            <Label>Port</Label>
            <Input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
          <div>
            <Label className="cursor-pointer">SSL/TLS (Secure)</Label>
            <p className="text-xs text-muted-foreground">Port 465 = ON, Port 587 = OFF</p>
          </div>
          <Switch checked={form.secure} onCheckedChange={v => setForm({ ...form, secure: v })} />
        </div>

        <div>
          <Label>Username (Email)</Label>
          <Input type="email" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="support@cheapest-premiums.in" />
        </div>

        <div>
          <Label>Password {form.id && <span className="text-xs text-muted-foreground">(blank = keep current)</span>}</Label>
          <div className="relative">
            <Input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.id ? '••••••••' : 'Email account password'} className="pr-10" />
            <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>From Email</Label>
            <Input type="email" value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })} />
          </div>
          <div>
            <Label>From Name</Label>
            <Input value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
          <div>
            <Label className="cursor-pointer flex items-center gap-2">
              {form.is_active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
              Active
            </Label>
            <p className="text-xs text-muted-foreground">Disabled হলে Resend fallback ব্যবহার হবে</p>
          </div>
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
        </div>

        <Button onClick={save} disabled={saving} className="w-full rounded-xl h-11">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Send Test Email</h3>
        </div>
        <p className="text-xs text-muted-foreground">Test the connection — saved config বা উপরের typed password দিয়ে</p>
        <div className="flex gap-2">
          <Input type="email" placeholder="your-email@example.com" value={testTo} onChange={e => setTestTo(e.target.value)} />
          <Button onClick={sendTest} disabled={testing} className="rounded-xl">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 space-y-1">
        <p className="font-semibold text-foreground">📌 Hostinger Setup:</p>
        <p>• Host: <code>smtp.hostinger.com</code></p>
        <p>• Port: <code>465</code> (SSL on) বা <code>587</code> (SSL off)</p>
        <p>• Username: আপনার পুরো email address</p>
        <p>• Password: <a href="https://mail.hostinger.com" target="_blank" rel="noopener" className="text-primary underline">Hostinger webmail</a> এর login password</p>
      </div>
    </motion.div>
  );
}
