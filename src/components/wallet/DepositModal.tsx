import React, { useState, useMemo } from 'react';
import {
  CreditCard, QrCode, Smartphone, AlertCircle,
  Copy, ExternalLink, Loader2, Globe, MessageCircle, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';

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

const COUNTRIES: { name: string; flag: string }[] = [
  { name: 'Afghanistan', flag: '🇦🇫' }, { name: 'Albania', flag: '🇦🇱' }, { name: 'Algeria', flag: '🇩🇿' },
  { name: 'Andorra', flag: '🇦🇩' }, { name: 'Angola', flag: '🇦🇴' }, { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Armenia', flag: '🇦🇲' }, { name: 'Australia', flag: '🇦🇺' }, { name: 'Austria', flag: '🇦🇹' },
  { name: 'Azerbaijan', flag: '🇦🇿' }, { name: 'Bahrain', flag: '🇧🇭' }, { name: 'Bangladesh', flag: '🇧🇩' },
  { name: 'Belarus', flag: '🇧🇾' }, { name: 'Belgium', flag: '🇧🇪' }, { name: 'Benin', flag: '🇧🇯' },
  { name: 'Bhutan', flag: '🇧🇹' }, { name: 'Bolivia', flag: '🇧🇴' }, { name: 'Bosnia', flag: '🇧🇦' },
  { name: 'Botswana', flag: '🇧🇼' }, { name: 'Brazil', flag: '🇧🇷' }, { name: 'Brunei', flag: '🇧🇳' },
  { name: 'Bulgaria', flag: '🇧🇬' }, { name: 'Burkina Faso', flag: '🇧🇫' }, { name: 'Cambodia', flag: '🇰🇭' },
  { name: 'Cameroon', flag: '🇨🇲' }, { name: 'Canada', flag: '🇨🇦' }, { name: 'Chad', flag: '🇹🇩' },
  { name: 'Chile', flag: '🇨🇱' }, { name: 'China', flag: '🇨🇳' }, { name: 'Colombia', flag: '🇨🇴' },
  { name: 'Congo', flag: '🇨🇬' }, { name: 'Costa Rica', flag: '🇨🇷' }, { name: 'Croatia', flag: '🇭🇷' },
  { name: 'Cuba', flag: '🇨🇺' }, { name: 'Cyprus', flag: '🇨🇾' }, { name: 'Czech Republic', flag: '🇨🇿' },
  { name: 'Denmark', flag: '🇩🇰' }, { name: 'Dominican Republic', flag: '🇩🇴' }, { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Egypt', flag: '🇪🇬' }, { name: 'El Salvador', flag: '🇸🇻' }, { name: 'Estonia', flag: '🇪🇪' },
  { name: 'Ethiopia', flag: '🇪🇹' }, { name: 'Fiji', flag: '🇫🇯' }, { name: 'Finland', flag: '🇫🇮' },
  { name: 'France', flag: '🇫🇷' }, { name: 'Gabon', flag: '🇬🇦' }, { name: 'Georgia', flag: '🇬🇪' },
  { name: 'Germany', flag: '🇩🇪' }, { name: 'Ghana', flag: '🇬🇭' }, { name: 'Greece', flag: '🇬🇷' },
  { name: 'Guatemala', flag: '🇬🇹' }, { name: 'Guinea', flag: '🇬🇳' }, { name: 'Haiti', flag: '🇭🇹' },
  { name: 'Honduras', flag: '🇭🇳' }, { name: 'Hong Kong', flag: '🇭🇰' }, { name: 'Hungary', flag: '🇭🇺' },
  { name: 'Iceland', flag: '🇮🇸' }, { name: 'Indonesia', flag: '🇮🇩' }, { name: 'Iran', flag: '🇮🇷' },
  { name: 'Iraq', flag: '🇮🇶' }, { name: 'Ireland', flag: '🇮🇪' }, { name: 'Israel', flag: '🇮🇱' },
  { name: 'Italy', flag: '🇮🇹' }, { name: 'Jamaica', flag: '🇯🇲' }, { name: 'Japan', flag: '🇯🇵' },
  { name: 'Jordan', flag: '🇯🇴' }, { name: 'Kazakhstan', flag: '🇰🇿' }, { name: 'Kenya', flag: '🇰🇪' },
  { name: 'Kuwait', flag: '🇰🇼' }, { name: 'Kyrgyzstan', flag: '🇰🇬' }, { name: 'Laos', flag: '🇱🇦' },
  { name: 'Latvia', flag: '🇱🇻' }, { name: 'Lebanon', flag: '🇱🇧' }, { name: 'Libya', flag: '🇱🇾' },
  { name: 'Lithuania', flag: '🇱🇹' }, { name: 'Luxembourg', flag: '🇱🇺' }, { name: 'Macau', flag: '🇲🇴' },
  { name: 'Madagascar', flag: '🇲🇬' }, { name: 'Malawi', flag: '🇲🇼' }, { name: 'Malaysia', flag: '🇲🇾' },
  { name: 'Maldives', flag: '🇲🇻' }, { name: 'Mali', flag: '🇲🇱' }, { name: 'Malta', flag: '🇲🇹' },
  { name: 'Mauritius', flag: '🇲🇺' }, { name: 'Mexico', flag: '🇲🇽' }, { name: 'Moldova', flag: '🇲🇩' },
  { name: 'Mongolia', flag: '🇲🇳' }, { name: 'Montenegro', flag: '🇲🇪' }, { name: 'Morocco', flag: '🇲🇦' },
  { name: 'Mozambique', flag: '🇲🇿' }, { name: 'Myanmar', flag: '🇲🇲' }, { name: 'Namibia', flag: '🇳🇦' },
  { name: 'Nepal', flag: '🇳🇵' }, { name: 'Netherlands', flag: '🇳🇱' }, { name: 'New Zealand', flag: '🇳🇿' },
  { name: 'Nicaragua', flag: '🇳🇮' }, { name: 'Niger', flag: '🇳🇪' }, { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'North Korea', flag: '🇰🇵' }, { name: 'North Macedonia', flag: '🇲🇰' }, { name: 'Norway', flag: '🇳🇴' },
  { name: 'Oman', flag: '🇴🇲' }, { name: 'Pakistan', flag: '🇵🇰' }, { name: 'Palestine', flag: '🇵🇸' },
  { name: 'Panama', flag: '🇵🇦' }, { name: 'Papua New Guinea', flag: '🇵🇬' }, { name: 'Paraguay', flag: '🇵🇾' },
  { name: 'Peru', flag: '🇵🇪' }, { name: 'Philippines', flag: '🇵🇭' }, { name: 'Poland', flag: '🇵🇱' },
  { name: 'Portugal', flag: '🇵🇹' }, { name: 'Qatar', flag: '🇶🇦' }, { name: 'Romania', flag: '🇷🇴' },
  { name: 'Russia', flag: '🇷🇺' }, { name: 'Rwanda', flag: '🇷🇼' }, { name: 'Saudi Arabia', flag: '🇸🇦' },
  { name: 'Senegal', flag: '🇸🇳' }, { name: 'Serbia', flag: '🇷🇸' }, { name: 'Sierra Leone', flag: '🇸🇱' },
  { name: 'Singapore', flag: '🇸🇬' }, { name: 'Slovakia', flag: '🇸🇰' }, { name: 'Slovenia', flag: '🇸🇮' },
  { name: 'Somalia', flag: '🇸🇴' }, { name: 'South Africa', flag: '🇿🇦' }, { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Spain', flag: '🇪🇸' }, { name: 'Sri Lanka', flag: '🇱🇰' }, { name: 'Sudan', flag: '🇸🇩' },
  { name: 'Sweden', flag: '🇸🇪' }, { name: 'Switzerland', flag: '🇨🇭' }, { name: 'Syria', flag: '🇸🇾' },
  { name: 'Taiwan', flag: '🇹🇼' }, { name: 'Tajikistan', flag: '🇹🇯' }, { name: 'Tanzania', flag: '🇹🇿' },
  { name: 'Thailand', flag: '🇹🇭' }, { name: 'Togo', flag: '🇹🇬' }, { name: 'Trinidad and Tobago', flag: '🇹🇹' },
  { name: 'Tunisia', flag: '🇹🇳' }, { name: 'Turkey', flag: '🇹🇷' }, { name: 'Turkmenistan', flag: '🇹🇲' },
  { name: 'UAE', flag: '🇦🇪' }, { name: 'Uganda', flag: '🇺🇬' }, { name: 'UK', flag: '🇬🇧' },
  { name: 'Ukraine', flag: '🇺🇦' }, { name: 'Uruguay', flag: '🇺🇾' }, { name: 'USA', flag: '🇺🇸' },
  { name: 'Uzbekistan', flag: '🇺🇿' }, { name: 'Venezuela', flag: '🇻🇪' }, { name: 'Vietnam', flag: '🇻🇳' },
  { name: 'Yemen', flag: '🇾🇪' }, { name: 'Zambia', flag: '🇿🇲' }, { name: 'Zimbabwe', flag: '🇿🇼' },
];

const DepositModal: React.FC<DepositModalProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange,
  paymentSettings, loading, onAutoDeposit, onManualDeposit,
  submittingManual, transactionId, onTransactionIdChange,
  senderName, onSenderNameChange
}) => {
  const { settings } = useAppSettingsContext();
  const { profile } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<'india' | 'foreign' | null>(null);
  const [foreignCountry, setForeignCountry] = useState('');
  const [foreignFlag, setForeignFlag] = useState('');
  const [hasBinance, setHasBinance] = useState<boolean | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>(
    paymentSettings?.automatic_payment?.is_enabled ? 'auto' : 'manual'
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));
  }, [countrySearch]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleBack = () => {
    if (hasBinance !== null) {
      setHasBinance(null);
    } else if (selectedCountry === 'foreign' && foreignCountry) {
      setForeignCountry('');
      setForeignFlag('');
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
        <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Select Your Country
            </DialogTitle>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search country..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-muted border-0"
            />
          </div>
          <div className="space-y-1 mt-2 overflow-y-auto max-h-[50vh] pr-1">
            {filteredCountries.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">No country found</p>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.name}
                  onClick={() => { setForeignCountry(country.name); setForeignFlag(country.flag); setCountrySearch(''); }}
                  className="w-full p-3 bg-muted rounded-xl text-left text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
                >
                  {country.flag} {country.name}
                </button>
              ))
            )}
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
            <DialogDescription>Select your payment method for {foreignFlag} {foreignCountry}</DialogDescription>
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

            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-center">
              <p className="font-bold text-destructive">⚠️ {settings.foreign_deposit_fee_percent || 10}% Extra Fee</p>
              <p className="text-xs text-muted-foreground mt-1">
                An additional {settings.foreign_deposit_fee_percent || 10}% processing fee applies for foreign deposits
              </p>
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
                onClick={() => {
                  const msg = [
                    `🔹 *Deposit Request - No Binance*`,
                    ``,
                    `👤 *Name:* ${profile?.name || 'N/A'}`,
                    `📧 *Email:* ${profile?.email || 'N/A'}`,
                    `📱 *Phone:* ${profile?.phone || 'N/A'}`,
                    `🌍 *Country:* ${foreignFlag} ${foreignCountry}`,
                    `💰 *Purpose:* I want to deposit money but I don't have Binance.`,
                    ``,
                    `Please help me with an alternative payment method.`
                  ].join('%0A');
                  window.open(`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
                }}
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
                <Button
                  onClick={() => {
                    const link = settings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam';
                    window.open(link, '_blank');
                  }}
                  className="w-full h-12 btn-gradient rounded-xl"
                  disabled={!depositAmount}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pay ₹{depositAmount || '0'} via Card
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  After payment, submit a manual deposit request with your transaction details
                </p>
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

        <Button variant="ghost" onClick={() => { setSelectedCountry(null); setForeignCountry(''); setForeignFlag(''); setHasBinance(null); }} className="w-full mt-2 rounded-xl">
          ← Change Country
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;