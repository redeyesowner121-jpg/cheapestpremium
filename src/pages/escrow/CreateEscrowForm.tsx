import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shield, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  userId: string;
  walletBalance: number;
  onBack: () => void;
  onCreated: () => void;
}

const CreateEscrowForm: React.FC<Props> = ({ userId, walletBalance, onBack, onCreated }) => {
  const navigate = useNavigate();
  const [sellerEmail, setSellerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fee = parseFloat(amount) * 0.02 || 0;
  const sellerGets = (parseFloat(amount) || 0) - fee;

  const handleCreate = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) {
      const need = (amt - walletBalance).toFixed(2);
      toast.error('Insufficient balance — redirecting to top-up.');
      navigate(`/wallet?deposit=1&reason=insufficient&amount=${need}`);
      return;
    }
    if (!sellerEmail.includes('@')) { toast.error('Valid seller email required'); return; }
    if (description.trim().length < 5) { toast.error('Describe the deal (min 5 chars)'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_escrow_deal', {
        _buyer_id: userId, _seller_email: sellerEmail.trim(),
        _amount: amt, _description: description.trim(),
      });
      if (error) throw error;
      toast.success('Escrow request sent! Auto-cancels in 30 min if seller doesn\'t accept.');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create escrow');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3 flex gap-2">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-0.5">Safe Deal — Admin Mediated</p>
          Auto-cancels in <b>30 minutes</b> if seller doesn't accept. Buyer can cancel before delivery.
          <span className="text-primary font-medium"> 2% platform fee</span>.
          <p className="mt-1 text-amber-600 dark:text-amber-400">⚠️ Sharing emails, phones, usernames or links inside escrow chat is blocked.</p>
        </div>
      </div>
      <Input type="email" placeholder="Seller's email" value={sellerEmail}
        onChange={(e) => setSellerEmail(e.target.value)} className="rounded-xl h-12" />
      <Input type="number" placeholder="Amount (₹)" value={amount}
        onChange={(e) => setAmount(e.target.value)} className="rounded-xl h-12" />
      <Textarea placeholder="What is this deal for? (e.g. Netflix Premium 1 month)"
        value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl min-h-20" />
      {amount && parseFloat(amount) > 0 && (
        <div className="text-xs bg-muted rounded-xl p-3 space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Amount held</span><span>₹{parseFloat(amount).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (2%)</span><span>−₹{fee.toFixed(2)}</span></div>
          <div className="flex justify-between font-medium border-t border-border pt-1"><span>Seller receives</span><span>₹{sellerGets.toFixed(2)}</span></div>
        </div>
      )}
      <Button onClick={handleCreate} disabled={submitting} className="w-full h-12 btn-gradient rounded-xl">
        {submitting ? 'Sending Request…' : 'Send Escrow Request'}
      </Button>
    </div>
  );
};

export default CreateEscrowForm;
