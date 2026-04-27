import React, { useState } from 'react';
import { Smartphone, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { QUICK_AMOUNTS, type PaymentSettings } from '../constants';

interface ManualFlowProps {
  depositAmount: string;
  onDepositAmountChange: (v: string) => void;
  paymentSettings: PaymentSettings | null;
  submittingManual: boolean;
  transactionId: string;
  onTransactionIdChange: (v: string) => void;
  senderName: string;
  onSenderNameChange: (v: string) => void;
  onManualDeposit: () => void;
}

const ManualFlow: React.FC<ManualFlowProps> = ({
  depositAmount, onDepositAmountChange, paymentSettings,
  submittingManual, transactionId, onTransactionIdChange,
  senderName, onSenderNameChange, onManualDeposit,
}) => {
  const [manualAttempted, setManualAttempted] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Input type="number" placeholder="Enter amount *" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className={`h-14 text-2xl text-center font-bold rounded-xl ${manualAttempted && !depositAmount ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
          ))}
        </div>
      </div>

      {paymentSettings?.upi_id?.setting_value && depositAmount && parseFloat(depositAmount) >= 10 && (
        <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
          <p className="text-sm font-medium text-foreground mb-1">Scan to Pay ₹{depositAmount}</p>
          <p className="text-xs text-primary font-medium mb-3">Pay to: {paymentSettings?.upi_name?.setting_value || 'Merchant'}</p>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${paymentSettings.upi_id.setting_value}&pn=${encodeURIComponent(paymentSettings?.upi_name?.setting_value || 'Merchant')}&am=${depositAmount}&cu=INR`)}`} alt="Payment QR" className="w-48 h-48 object-contain rounded-xl border bg-white p-2" loading="lazy" />
          <Button className="w-full mt-3 btn-gradient rounded-xl" onClick={() => { window.location.href = `upi://pay?pa=${paymentSettings.upi_id.setting_value}&pn=${encodeURIComponent(paymentSettings?.upi_name?.setting_value || 'Merchant')}&am=${depositAmount}&cu=INR`; }}>
            <Smartphone className="w-4 h-4 mr-2" />Pay Now ₹{depositAmount}
          </Button>
        </div>
      )}

      {!paymentSettings?.upi_id?.setting_value && paymentSettings?.manual_payment_qr?.setting_value && (
        <div className="flex flex-col items-center">
          <img src={paymentSettings.manual_payment_qr.setting_value} alt="Payment QR" className="w-48 h-48 object-contain rounded-xl border" />
          <p className="text-sm text-muted-foreground mt-2">Scan QR to pay</p>
        </div>
      )}

      {paymentSettings?.manual_payment_link?.setting_value && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
          <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <a href={paymentSettings.manual_payment_link.setting_value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary truncate flex-1">{paymentSettings.manual_payment_link.setting_value}</a>
          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentSettings.manual_payment_link!.setting_value!)}><Copy className="w-4 h-4" /></Button>
        </div>
      )}

      {paymentSettings?.manual_payment_instructions?.setting_value && (
        <div className="p-3 bg-primary/5 rounded-xl text-sm text-foreground">{paymentSettings.manual_payment_instructions.setting_value}</div>
      )}

      <div className="space-y-3">
        <Input placeholder="Your Name (Sender Name) *" value={senderName} onChange={(e) => onSenderNameChange(e.target.value)} className={`rounded-xl ${manualAttempted && !senderName.trim() ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
        <Input placeholder="Enter Transaction ID / UTR Number *" value={transactionId} onChange={(e) => onTransactionIdChange(e.target.value)} className={`rounded-xl ${manualAttempted && !transactionId.trim() ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
        <Button onClick={() => { setManualAttempted(true); if (depositAmount && transactionId.trim() && senderName.trim()) onManualDeposit(); else toast.error('Please fill all required fields'); }} className="w-full h-12 btn-gradient rounded-xl" disabled={submittingManual}>
          {submittingManual ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : `Submit Request ₹${depositAmount || '0'}`}
        </Button>
        <p className="text-xs text-muted-foreground text-center">Your deposit will be credited after admin verification</p>
      </div>
    </div>
  );
};

export default ManualFlow;
