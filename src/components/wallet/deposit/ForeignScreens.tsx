import React, { useState } from 'react';
import { Copy, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';

interface BinanceScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: string;
  onDepositAmountChange: (amount: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  transactionId: string;
  onTransactionIdChange: (id: string) => void;
  onManualDeposit: () => void;
  submittingManual: boolean;
  onBack: () => void;
}

export const BinancePayScreen: React.FC<BinanceScreenProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange,
  senderName, onSenderNameChange, transactionId, onTransactionIdChange,
  onManualDeposit, submittingManual, onBack
}) => {
  const { settings } = useAppSettingsContext();
  const [manualAttempted, setManualAttempted] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Pay via Binance</DialogTitle>
          <DialogDescription>Send payment to the Binance Pay ID below</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Binance Pay ID</p>
            <p className="text-2xl font-bold text-foreground tracking-wider">{settings.binance_id}</p>
            <Button onClick={() => copyToClipboard(settings.binance_id)} variant="outline" className="rounded-xl">
              <Copy className="w-4 h-4 mr-2" />Copy ID
            </Button>
          </div>

          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-center">
            <p className="font-bold text-destructive">⚠️ {settings.foreign_deposit_fee_percent || 10}% Extra Fee</p>
            <p className="text-xs text-muted-foreground mt-1">An additional {settings.foreign_deposit_fee_percent || 10}% processing fee applies for foreign deposits</p>
          </div>

          <div className="p-3 bg-primary/5 rounded-xl text-sm text-foreground space-y-2">
            <p className="font-medium">Steps:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open Binance App</li>
              <li>Go to Pay → Send</li>
              <li>Enter the Pay ID above</li>
              <li>Send your desired amount</li>
              <li>Submit the transaction details below</li>
            </ol>
          </div>

          <div className="space-y-3">
            <Input type="number" placeholder="Enter amount (USDT)" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} className="h-14 text-2xl text-center font-bold rounded-xl" />
            <Input placeholder="Your Name *" value={senderName} onChange={(e) => onSenderNameChange(e.target.value)} className={`rounded-xl ${manualAttempted && !senderName.trim() ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
            <Input placeholder="Binance Transaction ID *" value={transactionId} onChange={(e) => onTransactionIdChange(e.target.value)} className={`rounded-xl ${manualAttempted && !transactionId.trim() ? 'border-destructive ring-destructive/30 ring-2' : ''}`} />
            <Button onClick={onManualDeposit} className="w-full h-12 btn-gradient rounded-xl" disabled={submittingManual || !depositAmount || !transactionId || !senderName}>
              {submittingManual ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Deposit Request'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Your deposit will be credited after admin verification</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
      </DialogContent>
    </Dialog>
  );
};

interface NoBinanceScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foreignCountry: string;
  foreignFlag: string;
  onBack: () => void;
}

export const NoBinanceScreen: React.FC<NoBinanceScreenProps> = ({ open, onOpenChange, foreignCountry, foreignFlag, onBack }) => {
  const { settings } = useAppSettingsContext();
  const { profile } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Contact Seller</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 text-center">
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">{settings.binance_contact_message}</p>
          {settings.contact_whatsapp && (
            <Button
              onClick={() => {
                const msg = [
                  `🔹 *Deposit Request - No Binance*`, ``,
                  `👤 *Name:* ${profile?.name || 'N/A'}`,
                  `📧 *Email:* ${profile?.email || 'N/A'}`,
                  `📱 *Phone:* ${profile?.phone || 'N/A'}`,
                  `🌍 *Country:* ${foreignFlag} ${foreignCountry}`,
                  `💰 *Purpose:* I want to deposit money but I don't have Binance.`, ``,
                  `Please help me with an alternative payment method.`
                ].join('%0A');
                window.open(`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
              }}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
            >
              <MessageCircle className="w-5 h-5 mr-2" />Contact on WhatsApp
            </Button>
          )}
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
      </DialogContent>
    </Dialog>
  );
};

interface BinanceQuestionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foreignCountry: string;
  foreignFlag: string;
  onHasBinance: () => void;
  onNoBinance: () => void;
  onBack: () => void;
}

export const BinanceQuestion: React.FC<BinanceQuestionProps> = ({ open, onOpenChange, foreignCountry, foreignFlag, onHasBinance, onNoBinance, onBack }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm mx-auto rounded-3xl">
      <DialogHeader>
        <DialogTitle>Do you have Binance?</DialogTitle>
        <DialogDescription>Select your payment method for {foreignFlag} {foreignCountry}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-4">
        <button onClick={onHasBinance} className="w-full p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-4 hover:bg-amber-500/20 transition-colors active:scale-[0.98]">
          <span className="text-3xl">💰</span>
          <div className="text-left">
            <p className="font-semibold text-foreground">Yes, I have Binance</p>
            <p className="text-xs text-muted-foreground">Pay via Binance Pay ID</p>
          </div>
        </button>
        <button onClick={onNoBinance} className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]">
          <span className="text-3xl">❌</span>
          <div className="text-left">
            <p className="font-semibold text-foreground">No, I don't have Binance</p>
            <p className="text-xs text-muted-foreground">Contact seller for alternatives</p>
          </div>
        </button>
      </div>
      <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
    </DialogContent>
  </Dialog>
);
