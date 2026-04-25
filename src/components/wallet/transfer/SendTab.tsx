import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Mail, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QrScanner from './QrScanner';
import { decodeQr } from './qrPayload';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  referral_code: string;
}

interface SendTabProps {
  userId: string;
  walletBalance: number;
  loading: boolean;
  onTransfer: (recipient: UserProfile, amount: string, note: string) => void;
}

type Mode = 'choose' | 'scanner' | 'email';

const SendTab: React.FC<SendTabProps> = ({ userId, walletBalance, loading, onTransfer }) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const lookupByEmail = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email'); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, referral_code')
      .ilike('email', email.trim())
      .neq('id', userId)
      .limit(1)
      .maybeSingle();
    setSearching(false);
    if (!data) { toast.error('No user found with this email'); return; }
    setRecipient(data as UserProfile);
  };

  const handleScan = async (decoded: string) => {
    const payload = decodeQr(decoded);
    if (!payload) { toast.error('Invalid QR code'); return; }
    if (payload.uid === userId) { toast.error('Cannot send to yourself'); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, referral_code')
      .eq('id', payload.uid)
      .maybeSingle();
    if (!data) { toast.error('User not found'); return; }
    setRecipient(data as UserProfile);
    if (payload.amount) setAmount(String(payload.amount));
    if (payload.note) setNote(payload.note);
  };

  const reset = () => {
    setRecipient(null); setAmount(''); setNote(''); setEmail('');
  };

  // Confirm screen (after recipient resolved)
  if (recipient) {
    return (
      <div className="space-y-4">
        <button onClick={reset} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
          <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            {recipient.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{recipient.name}</p>
            <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
          </div>
        </div>
        <Input
          type="number" inputMode="decimal" placeholder="Enter amount" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-2xl text-center font-bold rounded-xl"
        />
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" />
        <div className="text-center text-sm text-muted-foreground">
          Your balance: ₹{walletBalance.toFixed(2)}
        </div>
        <Button
          onClick={() => onTransfer(recipient, amount, note)}
          className="w-full h-12 btn-gradient rounded-xl"
          disabled={loading || !amount || parseFloat(amount) <= 0}
        >
          {loading ? 'Sending...' : `Send ₹${amount || '0'}`}
        </Button>
      </div>
    );
  }

  if (mode === 'scanner') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <QrScanner onScan={handleScan} />
      </div>
    );
  }

  if (mode === 'email') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode('choose')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="email" placeholder="Recipient email" value={email}
            onChange={(e) => setEmail(e.target.value)} className="pl-10 rounded-xl h-12"
            onKeyDown={(e) => e.key === 'Enter' && lookupByEmail()}
          />
        </div>
        <Button onClick={lookupByEmail} disabled={searching} className="w-full h-12 rounded-xl">
          <Search className="w-4 h-4 mr-2" /> {searching ? 'Searching…' : 'Find user'}
        </Button>
      </div>
    );
  }

  // choose
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => setMode('scanner')}
        className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center gap-2 active:scale-95 transition"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Camera className="w-6 h-6 text-primary" />
        </div>
        <span className="font-medium text-foreground">Scanner</span>
        <span className="text-[11px] text-muted-foreground text-center">Scan a QR code</span>
      </button>
      <button
        onClick={() => setMode('email')}
        className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center gap-2 active:scale-95 transition"
      >
        <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
          <Mail className="w-6 h-6 text-secondary" />
        </div>
        <span className="font-medium text-foreground">Email</span>
        <span className="text-[11px] text-muted-foreground text-center">Search by email</span>
      </button>
    </div>
  );
};

export default SendTab;
