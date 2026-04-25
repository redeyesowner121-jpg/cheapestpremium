import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, QrCode, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { encodeQr } from './qrPayload';

interface ReceiveTabProps {
  userId: string;
  email?: string;
  name?: string;
}

type Mode = 'choose' | 'qr' | 'request';

const ReceiveTab: React.FC<ReceiveTabProps> = ({ userId, email, name }) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [requestAmount, setRequestAmount] = useState('');
  const [includeAmount, setIncludeAmount] = useState(false);

  // Request flow
  const [payerEmail, setPayerEmail] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitRequest = async () => {
    const amt = parseFloat(reqAmount);
    if (!payerEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('request_money_from_email', {
        _requester_id: userId,
        _payer_email: payerEmail.trim(),
        _amount: amt,
        _note: reqNote || null,
      });
      if (error) throw error;
      toast.success(`Request sent to ${payerEmail.trim()}`);
      setPayerEmail(''); setReqAmount(''); setReqNote('');
      setMode('choose');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'qr') {
    const qrAmount = includeAmount ? parseFloat(requestAmount) : undefined;
    const payload = encodeQr({
      v: 1, type: 'pay', uid: userId, email, name,
      amount: qrAmount && !isNaN(qrAmount) ? qrAmount : undefined,
    });
    return (
      <div className="space-y-3">
        <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-white rounded-2xl p-6 mx-auto flex items-center justify-center w-fit">
          <QRCodeSVG value={payload} size={220} level="M" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">{name}</p>
          {email && <p className="text-xs text-muted-foreground">{email}</p>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input id="incAmt" type="checkbox" checked={includeAmount} onChange={(e) => setIncludeAmount(e.target.checked)} />
          <label htmlFor="incAmt" className="text-muted-foreground">Include amount in QR</label>
        </div>
        {includeAmount && (
          <Input type="number" placeholder="Amount" value={requestAmount}
            onChange={(e) => setRequestAmount(e.target.value)} className="rounded-xl" />
        )}
      </div>
    );
  }

  if (mode === 'request') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Input type="email" placeholder="Person's email" value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)} className="rounded-xl h-12" />
        <Input type="number" placeholder="Amount (₹)" value={reqAmount}
          onChange={(e) => setReqAmount(e.target.value)} className="rounded-xl h-12" />
        <Input placeholder="Reason / note (optional)" value={reqNote}
          onChange={(e) => setReqNote(e.target.value)} className="rounded-xl" />
        <Button onClick={submitRequest} disabled={submitting} className="w-full h-12 btn-gradient rounded-xl">
          <Send className="w-4 h-4 mr-2" /> {submitting ? 'Sending…' : 'Send Request'}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => setMode('qr')}
        className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center gap-2 active:scale-95 transition"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <QrCode className="w-6 h-6 text-primary" />
        </div>
        <span className="font-medium text-foreground">QR Code</span>
        <span className="text-[11px] text-muted-foreground text-center">Show your code</span>
      </button>
      <button
        onClick={() => setMode('request')}
        className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center gap-2 active:scale-95 transition"
      >
        <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
          <Mail className="w-6 h-6 text-secondary" />
        </div>
        <span className="font-medium text-foreground">Request</span>
        <span className="text-[11px] text-muted-foreground text-center">Ask by email</span>
      </button>
    </div>
  );
};

export default ReceiveTab;
