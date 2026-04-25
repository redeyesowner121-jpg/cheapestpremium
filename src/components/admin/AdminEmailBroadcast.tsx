import React, { useState } from 'react';
import { Mail, Send, Loader2, Users, ShieldCheck, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Recipients = 'all' | 'verified' | 'custom';

const AdminEmailBroadcast: React.FC = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<Recipients>('verified');
  const [customEmails, setCustomEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject এবং message দুটোই দিন');
      return;
    }
    let customList: string[] = [];
    if (recipients === 'custom') {
      customList = customEmails.split(/[\s,;\n]+/).map(e => e.trim()).filter(Boolean);
      if (customList.length === 0) {
        toast.error('অন্তত একটা email address দিন');
        return;
      }
    }

    const confirmMsg = recipients === 'custom'
      ? `${customList.length} জনকে email পাঠানো হবে।`
      : recipients === 'verified'
        ? 'সব verified (Blue Tick) ইউজারকে email পাঠানো হবে।'
        : 'সব রেজিস্টার্ড ইউজারকে email পাঠানো হবে।';
    if (!confirm(`${confirmMsg}\n\nনিশ্চিত?`)) return;

    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-broadcast-email', {
        body: { subject, message, recipients, customEmails: customList },
      });
      if (error) throw error;
      setLastResult(data);
      if (data?.failed > 0) {
        toast.warning(`${data.sent} sent, ${data.failed} failed`);
      } else {
        toast.success(`✅ ${data.sent} email পাঠানো হয়েছে (from: ${data.from})`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const recipientOptions: { id: Recipients; label: string; icon: any; desc: string }[] = [
    { id: 'verified', label: 'Verified Users', icon: ShieldCheck, desc: 'Blue Tick শুধু' },
    { id: 'all', label: 'All Users', icon: Users, desc: 'সব রেজিস্টার্ড ইউজার' },
    { id: 'custom', label: 'Specific Emails', icon: AtSign, desc: 'নির্দিষ্ট address' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Email Broadcast</h2>
          <p className="text-sm text-muted-foreground">আপনার domain থেকে ইউজারদের email পাঠান</p>
        </div>
      </div>

      <Card className="p-5 space-y-5">
        {/* Recipient picker */}
        <div className="space-y-2">
          <Label>প্রাপক (Recipients)</Label>
          <div className="grid grid-cols-3 gap-3">
            {recipientOptions.map(opt => {
              const Icon = opt.icon;
              const active = recipients === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRecipients(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {recipients === 'custom' && (
          <div className="space-y-2">
            <Label>Email addresses (comma/newline separated)</Label>
            <Textarea
              rows={3}
              placeholder="user1@example.com, user2@example.com"
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            placeholder="🎁 Big sale on Netflix premium!"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
          />
        </div>

        <div className="space-y-2">
          <Label>Message (plain text বা HTML)</Label>
          <Textarea
            rows={10}
            placeholder={"Hi,\n\nWe just dropped a special offer for you...\n\n— Cheapest Premiums Team"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Plain text লিখলে newlines automatically &lt;br&gt; হবে। HTML tag দিলে সরাসরি render হবে।
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            From: <span className="font-mono">support@cheapest-premiums.in</span>
            <br />
            <span className="text-[10px]">Domain Resend এ verify না থাকলে fallback sender ব্যবহার হবে</span>
          </div>
          <Button onClick={handleSend} disabled={sending} size="lg">
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send Broadcast</>
            )}
          </Button>
        </div>

        {lastResult && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
            <div>📊 Total: <strong>{lastResult.total}</strong></div>
            <div className="text-emerald-600">✅ Sent: <strong>{lastResult.sent}</strong></div>
            {lastResult.failed > 0 && (
              <div className="text-rose-600">❌ Failed: <strong>{lastResult.failed}</strong></div>
            )}
            <div className="text-xs text-muted-foreground">From: {lastResult.from}</div>
            {lastResult.firstError && (
              <div className="text-xs text-rose-600 mt-1">First error: {lastResult.firstError}</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminEmailBroadcast;
