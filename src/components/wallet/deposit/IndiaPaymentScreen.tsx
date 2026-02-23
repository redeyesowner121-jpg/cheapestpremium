import React, { useState } from 'react';
import {
  CreditCard, QrCode, Smartphone, AlertCircle,
  Copy, ExternalLink, Loader2, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { QUICK_AMOUNTS, type PaymentSettings } from './constants';

interface IndiaPaymentScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: string;
  onDepositAmountChange: (amount: string) => void;
  paymentSettings: PaymentSettings | null;
  loading: boolean;
  onAutoDeposit: () => void;
  onManualDeposit: () => void;
  submittingManual: boolean;
  transactionId: string;
  onTransactionIdChange: (id: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  depositTab: 'auto' | 'manual' | 'card';
  onTabChange: (tab: 'auto' | 'manual' | 'card') => void;
  onChangeCountry: () => void;
}

const IndiaPaymentScreen: React.FC<IndiaPaymentScreenProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange,
  paymentSettings, loading, onAutoDeposit, onManualDeposit,
  submittingManual, transactionId, onTransactionIdChange,
  senderName, onSenderNameChange, depositTab, onTabChange, onChangeCountry
}) => {
  const { settings } = useAppSettingsContext();
  const { profile, user } = useAuth();
  const [showCardConfirm, setShowCardConfirm] = useState(false);
  const [submittingCard, setSubmittingCard] = useState(false);
  const [manualAttempted, setManualAttempted] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Deposit Rs1000+ at once to get Rs100 bonus + Blue Tick!</DialogDescription>
        </DialogHeader>

        <Tabs value={depositTab} onValueChange={(v) => { onTabChange(v as any); setShowCardConfirm(false); }} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="auto" className="rounded-lg text-xs" disabled={!paymentSettings?.automatic_payment?.is_enabled}>
              <Smartphone className="w-3.5 h-3.5 mr-1" />Auto
            </TabsTrigger>
            <TabsTrigger value="manual" className="rounded-lg text-xs">
              <QrCode className="w-3.5 h-3.5 mr-1" />Manual
            </TabsTrigger>
            <TabsTrigger value="card" className="rounded-lg text-xs">
              <CreditCard className="w-3.5 h-3.5 mr-1" />Card
            </TabsTrigger>
          </TabsList>

          {/* Auto Tab */}
          <TabsContent value="auto" className="mt-4 space-y-4">
            {!paymentSettings?.automatic_payment?.is_enabled ? (
              <div className="p-4 bg-destructive/10 rounded-xl flex items-center gap-3 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Automatic payment is currently unavailable.</p>
              </div>
            ) : (
              <>
                <Input type="number" placeholder="Enter amount" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className="h-14 text-2xl text-center font-bold rounded-xl" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
                  ))}
                </div>
                <Button onClick={onAutoDeposit} className="w-full h-12 btn-gradient rounded-xl" disabled={loading || !depositAmount}>
                  {loading ? 'Processing...' : `Pay ₹${depositAmount || '0'}`}
                </Button>
              </>
            )}
          </TabsContent>

          {/* Manual Tab */}
          <TabsContent value="manual" className="mt-4 space-y-4">
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
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentSettings.manual_payment_link.setting_value!)}><Copy className="w-4 h-4" /></Button>
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
          </TabsContent>

          {/* Card Tab */}
          <TabsContent value="card" className="mt-4 space-y-4">
            {!showCardConfirm ? (
              <>
                <Input type="number" placeholder="Enter amount" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className="h-14 text-2xl text-center font-bold rounded-xl" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} onClick={() => onDepositAmountChange(amount.toString())} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}>₹{amount}</button>
                  ))}
                </div>
                <Button onClick={() => { const amount = parseFloat(depositAmount); if (isNaN(amount) || amount < (settings.min_deposit || 10)) { toast.error(`Minimum deposit is ₹${settings.min_deposit || 10}`); return; } setShowCardConfirm(true); }} className="w-full h-12 btn-gradient rounded-xl" disabled={!depositAmount}>
                  <CreditCard className="w-5 h-5 mr-2" />Pay ₹{depositAmount || '0'} via Card
                </Button>
                <p className="text-xs text-muted-foreground text-center">You'll be redirected to the payment page</p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                  <h3 className="text-lg font-bold text-foreground">Confirm Payment</h3>
                  <p className="text-2xl font-bold text-primary">₹{depositAmount}</p>
                  <p className="text-sm text-muted-foreground">You will be redirected to the payment page. After payment, your deposit request will be automatically submitted for admin approval.</p>
                </div>
                <Button onClick={async () => {
                  if (!user || !profile) return;
                  setSubmittingCard(true);
                  try {
                    const amount = parseFloat(depositAmount);
                    const { error } = await supabase.from('manual_deposit_requests').insert({ user_id: user.id, amount, transaction_id: `CARD-${Date.now()}`, sender_name: profile.name || 'Card Payment', payment_method: 'card', status: 'pending' });
                    if (error) throw error;
                    const link = settings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam';
                    window.open(link, '_blank');
                    toast.success('Deposit request submitted! Complete payment on the redirected page.');
                    setShowCardConfirm(false);
                    onOpenChange(false);
                    onDepositAmountChange('');
                  } catch { toast.error('Failed to submit deposit request'); } finally { setSubmittingCard(false); }
                }} className="w-full h-12 btn-gradient rounded-xl" disabled={submittingCard}>
                  {submittingCard ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><CreditCard className="w-5 h-5 mr-2" />Confirm & Pay ₹{depositAmount}</>}
                </Button>
                <Button variant="ghost" onClick={() => setShowCardConfirm(false)} className="w-full rounded-xl">← Go Back</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button variant="ghost" onClick={onChangeCountry} className="w-full mt-2 rounded-xl">← Change Country</Button>
      </DialogContent>
    </Dialog>
  );
};

export default IndiaPaymentScreen;
