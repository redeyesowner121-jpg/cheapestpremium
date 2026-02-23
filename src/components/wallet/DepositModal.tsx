import React, { useState } from 'react';
import {
  CreditCard, QrCode, Smartphone, AlertCircle,
  Copy, ExternalLink, Loader2, Globe, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

interface PaymentSettings {
  automatic_payment: { is_enabled: boolean };
  manual_payment_qr: { setting_value: string | null; is_enabled: boolean };
  manual_payment_link: { setting_value: string | null; is_enabled: boolean };
  manual_payment_instructions: { setting_value: string | null };
  upi_id: { setting_value: string | null; is_enabled: boolean };
  upi_name: { setting_value: string | null; is_enabled: boolean };
}

interface DepositModalProps {
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
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'China', 'Colombia',
  'Denmark', 'Egypt', 'Ethiopia', 'Finland', 'France', 'Germany',
  'Ghana', 'Greece', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Italy',
  'Japan', 'Kenya', 'Malaysia', 'Mexico', 'Morocco', 'Myanmar',
  'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway',
  'Pakistan', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Russia', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea',
  'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Thailand', 'Turkey',
  'UAE', 'UK', 'USA', 'Ukraine', 'Vietnam'
];

const DepositModal: React.FC<DepositModalProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange,
  paymentSettings, loading, onAutoDeposit, onManualDeposit,
  submittingManual, transactionId, onTransactionIdChange,
  senderName, onSenderNameChange
}) => {
  const { settings } = useAppSettingsContext();
  const [selectedCountry, setSelectedCountry] = useState<'india' | 'foreign' | null>(null);
  const [foreignCountry, setForeignCountry] = useState('');
  const [hasBinance, setHasBinance] = useState<boolean | null>(null);
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>(
    paymentSettings?.automatic_payment?.is_enabled ? 'auto' : 'manual'
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleBack = () => {
    if (hasBinance !== null) {
      setHasBinance(null);
    } else if (selectedCountry === 'foreign' && foreignCountry) {
      setForeignCountry('');
    } else {
      setSelectedCountry(null);
      setForeignCountry('');
      setHasBinance(null);
    }
  };

  // Country Selection Screen
  if (!selectedCountry) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Select Your Country
            </DialogTitle>
            <DialogDescription>Choose your region for the right payment method</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <button
              onClick={() => setSelectedCountry('india')}
              className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]"
            >
              <span className="text-3xl">🇮🇳</span>
              <div className="text-left">
                <p className="font-semibold text-foreground">India</p>
                <p className="text-xs text-muted-foreground">UPI, QR Code, Card Payment</p>
              </div>
            </button>
            <button
              onClick={() => setSelectedCountry('foreign')}
              className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]"
            >
              <span className="text-3xl">🌍</span>
              <div className="text-left">
                <p className="font-semibold text-foreground">Other Country</p>
                <p className="text-xs text-muted-foreground">Binance Pay</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Foreign Country - Select specific country
  if (selectedCountry === 'foreign' && !foreignCountry) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Select Your Country
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {COUNTRIES.map((country) => (
              <button
                key={country}
                onClick={() => setForeignCountry(country)}
                className="w-full p-3 bg-muted rounded-xl text-left text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
              >
                {country}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={handleBack} className="w-full mt-2 rounded-xl">
            ← Back
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Foreign Country - Binance or No Binance
  if (selectedCountry === 'foreign' && foreignCountry && hasBinance === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Do you have Binance?</DialogTitle>
            <DialogDescription>Select your payment method for {foreignCountry}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <button
              onClick={() => setHasBinance(true)}
              className="w-full p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-4 hover:bg-amber-500/20 transition-colors active:scale-[0.98]"
            >
              <span className="text-3xl">💰</span>
              <div className="text-left">
                <p className="font-semibold text-foreground">Yes, I have Binance</p>
                <p className="text-xs text-muted-foreground">Pay via Binance Pay ID</p>
              </div>
            </button>
            <button
              onClick={() => setHasBinance(false)}
              className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]"
            >
              <span className="text-3xl">❌</span>
              <div className="text-left">
                <p className="font-semibold text-foreground">No, I don't have Binance</p>
                <p className="text-xs text-muted-foreground">Contact seller for alternatives</p>
              </div>
            </button>
          </div>
          <Button variant="ghost" onClick={handleBack} className="w-full mt-2 rounded-xl">
            ← Back
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Foreign - Has Binance - Show Binance ID
  if (selectedCountry === 'foreign' && hasBinance === true) {
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
              <Button
                onClick={() => copyToClipboard(settings.binance_id)}
                variant="outline"
                className="rounded-xl"
              >
                <Copy className="w-4 h-4 mr-2" />Copy ID
              </Button>
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
              <Input type="number" placeholder="Enter amount (USDT)" value={depositAmount}
                onChange={(e) => onDepositAmountChange(e.target.value)}
                className="h-14 text-2xl text-center font-bold rounded-xl" />
              <Input placeholder="Your Name" value={senderName}
                onChange={(e) => onSenderNameChange(e.target.value)} className="rounded-xl" />
              <Input placeholder="Binance Transaction ID" value={transactionId}
                onChange={(e) => onTransactionIdChange(e.target.value)} className="rounded-xl" />
              <Button onClick={onManualDeposit} className="w-full h-12 btn-gradient rounded-xl"
                disabled={submittingManual || !depositAmount || !transactionId || !senderName}>
                {submittingManual ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  'Submit Deposit Request'
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Your deposit will be credited after admin verification
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleBack} className="w-full mt-2 rounded-xl">
            ← Back
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Foreign - No Binance - Contact Seller
  if (selectedCountry === 'foreign' && hasBinance === false) {
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
                onClick={() => window.open(`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g, '')}?text=Hi, I want to deposit money but I don't have Binance. I'm from ${foreignCountry}. Please help me with alternative payment.`, '_blank')}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Contact on WhatsApp
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={handleBack} className="w-full mt-2 rounded-xl">
            ← Back
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // India - Original Payment Flow
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Deposit Rs1000+ at once to get Rs100 bonus + Blue Tick!</DialogDescription>
        </DialogHeader>

        <Tabs value={depositTab} onValueChange={(v) => setDepositTab(v as 'auto' | 'manual')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="auto" className="rounded-lg" disabled={!paymentSettings?.automatic_payment?.is_enabled}>
              <CreditCard className="w-4 h-4 mr-2" />Automatic
            </TabsTrigger>
            <TabsTrigger value="manual" className="rounded-lg">
              <QrCode className="w-4 h-4 mr-2" />Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="mt-4 space-y-4">
            {!paymentSettings?.automatic_payment?.is_enabled ? (
              <div className="p-4 bg-warning/10 rounded-xl flex items-center gap-3 text-warning">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Automatic payment is currently unavailable. Please use manual deposit.</p>
              </div>
            ) : (
              <>
                <Input type="number" placeholder="Enter amount" value={depositAmount}
                  onChange={(e) => onDepositAmountChange(e.target.value)}
                  className="h-14 text-2xl text-center font-bold rounded-xl" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} onClick={() => onDepositAmountChange(amount.toString())}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >₹{amount}</button>
                  ))}
                </div>
                <Button onClick={onAutoDeposit} className="w-full h-12 btn-gradient rounded-xl" disabled={loading || !depositAmount}>
                  {loading ? 'Processing...' : `Pay ₹${depositAmount || '0'}`}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-4">
            <div className="space-y-3">
              <Input type="number" placeholder="Enter amount" value={depositAmount}
                onChange={(e) => onDepositAmountChange(e.target.value)}
                className="h-14 text-2xl text-center font-bold rounded-xl" />
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button key={amount} onClick={() => onDepositAmountChange(amount.toString())}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      depositAmount === amount.toString() ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >₹{amount}</button>
                ))}
              </div>
            </div>

            {paymentSettings?.upi_id?.setting_value && depositAmount && parseFloat(depositAmount) >= 10 && (
              <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                <p className="text-sm font-medium text-foreground mb-1">Scan to Pay ₹{depositAmount}</p>
                <p className="text-xs text-primary font-medium mb-3">
                  Pay to: {paymentSettings?.upi_name?.setting_value || 'Merchant'}
                </p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `upi://pay?pa=${paymentSettings.upi_id.setting_value}&pn=${encodeURIComponent(paymentSettings?.upi_name?.setting_value || 'Merchant')}&am=${depositAmount}&cu=INR`
                  )}`}
                  alt="Payment QR"
                  className="w-48 h-48 object-contain rounded-xl border bg-white p-2"
                  loading="lazy"
                />
                <Button className="w-full mt-3 btn-gradient rounded-xl"
                  onClick={() => {
                    const upiUrl = `upi://pay?pa=${paymentSettings.upi_id.setting_value}&pn=${encodeURIComponent(paymentSettings?.upi_name?.setting_value || 'Merchant')}&am=${depositAmount}&cu=INR`;
                    window.location.href = upiUrl;
                  }}
                >
                  <Smartphone className="w-4 h-4 mr-2" />Pay Now ₹{depositAmount}
                </Button>
              </div>
            )}

            {!paymentSettings?.upi_id?.setting_value && paymentSettings?.manual_payment_qr?.setting_value && (
              <div className="flex flex-col items-center">
                <img src={paymentSettings.manual_payment_qr.setting_value} alt="Payment QR"
                  className="w-48 h-48 object-contain rounded-xl border" />
                <p className="text-sm text-muted-foreground mt-2">Scan QR to pay</p>
              </div>
            )}

            {paymentSettings?.manual_payment_link?.setting_value && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={paymentSettings.manual_payment_link.setting_value} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary truncate flex-1">
                  {paymentSettings.manual_payment_link.setting_value}
                </a>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentSettings.manual_payment_link.setting_value!)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}

            {paymentSettings?.manual_payment_instructions?.setting_value && (
              <div className="p-3 bg-primary/5 rounded-xl text-sm text-foreground">
                {paymentSettings.manual_payment_instructions.setting_value}
              </div>
            )}

            <div className="space-y-3">
              <Input placeholder="Your Name (Sender Name)" value={senderName}
                onChange={(e) => onSenderNameChange(e.target.value)} className="rounded-xl" />
              <Input placeholder="Enter Transaction ID / UTR Number" value={transactionId}
                onChange={(e) => onTransactionIdChange(e.target.value)} className="rounded-xl" />
              <Button onClick={onManualDeposit} className="w-full h-12 btn-gradient rounded-xl"
                disabled={submittingManual || !depositAmount || !transactionId || !senderName}>
                {submittingManual ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  `Submit Request ₹${depositAmount || '0'}`
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Your deposit will be credited after admin verification
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <Button variant="ghost" onClick={() => { setSelectedCountry(null); setForeignCountry(''); setHasBinance(null); }} className="w-full mt-2 rounded-xl">
          ← Change Country
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;