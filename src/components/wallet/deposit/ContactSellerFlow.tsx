import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Search, Globe, MessageCircle, Send, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { COUNTRIES } from './constants';

interface ContactSellerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
}

type Step = 'country' | 'product' | 'amount' | 'confirm';

export const ContactSellerFlow: React.FC<ContactSellerFlowProps> = ({ open, onOpenChange, onBack }) => {
  const { profile } = useAuth();
  const { settings } = useAppSettingsContext();

  const [step, setStep] = useState<Step>('country');
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState('');

  const [depositAmount, setDepositAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [extraNote, setExtraNote] = useState('');

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('country');
      setCountrySearch('');
      setSelectedCountry('');
      setSelectedFlag('');
      setProductSearch('');
      setSelectedProduct(null);
      setSelectedProductName('');
      setDepositAmount('');
      setExtraNote('');
    }
  }, [open]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('id, name, price, image_url, category').eq('is_active', true).order('name');
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));
  }, [countrySearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.category?.toLowerCase().includes(productSearch.toLowerCase()));
  }, [productSearch, products]);

  const handleBack = () => {
    if (step === 'country') onBack();
    else if (step === 'product') setStep('country');
    else if (step === 'amount') setStep('product');
    else if (step === 'confirm') setStep('amount');
  };

  const buildMessage = () => {
    const lines = [
      `🔹 *Deposit Request - No Binance*`,
      ``,
      `👤 *Name:* ${profile?.name || 'N/A'}`,
      `📧 *Email:* ${profile?.email || 'N/A'}`,
      `📱 *Phone:* ${profile?.phone || 'N/A'}`,
      `🌍 *Country:* ${selectedFlag} ${selectedCountry}`,
      ``,
      `🛒 *Want to buy:* ${selectedProductName || 'General Deposit'}`,
      `💰 *Deposit Amount:* ${depositAmount} ${currency}`,
    ];
    if (extraNote.trim()) {
      lines.push(`📝 *Note:* ${extraNote}`);
    }
    lines.push(``, `Please help me with an alternative payment method.`);
    return lines.join('%0A');
  };

  const whatsappNumber = settings.contact_whatsapp?.replace(/[^0-9]/g, '') || '';
  const telegramUsername = settings.support_telegram || 'Air1_Premium_bot';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button onClick={handleBack} className="p-1 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </button>
            {step === 'country' && 'Select Your Country'}
            {step === 'product' && 'What do you want to buy?'}
            {step === 'amount' && 'Deposit Amount'}
            {step === 'confirm' && 'Confirm & Contact'}
          </DialogTitle>
          <DialogDescription>
            {step === 'country' && 'Choose your country'}
            {step === 'product' && 'Search and select a product (optional)'}
            {step === 'amount' && 'Enter how much you want to deposit'}
            {step === 'confirm' && 'Review your details and contact seller'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Country Selection */}
        {step === 'country' && (
          <div className="flex flex-col flex-1 min-h-0 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search country..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-muted border-0"
              />
            </div>
            <div className="space-y-1 mt-2 overflow-y-auto max-h-[45vh] pr-1">
              {filteredCountries.map((country) => (
                <button
                  key={country.name}
                  onClick={() => {
                    setSelectedCountry(country.name);
                    setSelectedFlag(country.flag);
                    setCountrySearch('');
                    setStep('product');
                  }}
                  className="w-full p-3 bg-muted rounded-xl text-left text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
                >
                  {country.flag} {country.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Product Selection */}
        {step === 'product' && (
          <div className="flex flex-col flex-1 min-h-0 mt-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search product..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-muted border-0"
              />
            </div>

            <button
              onClick={() => {
                setSelectedProduct(null);
                setSelectedProductName('General Deposit (No specific product)');
                setStep('amount');
              }}
              className="w-full p-3 bg-primary/10 border border-primary/30 rounded-xl text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              💰 Just Deposit Money (No specific product)
            </button>

            <div className="space-y-1 overflow-y-auto max-h-[40vh] pr-1">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product.id);
                    setSelectedProductName(product.name);
                    setStep('amount');
                  }}
                  className={`w-full p-3 rounded-xl text-left text-sm font-medium transition-colors flex items-center gap-3 ${
                    selectedProduct === product.id ? 'bg-primary/20 border border-primary/30' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {product.image_url && (
                    <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">₹{product.price} • {product.category}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Amount */}
        {step === 'amount' && (
          <div className="mt-2 space-y-4">
            <div className="p-3 bg-muted rounded-xl text-sm">
              <p className="text-muted-foreground">Country: <span className="text-foreground font-medium">{selectedFlag} {selectedCountry}</span></p>
              <p className="text-muted-foreground">Product: <span className="text-foreground font-medium">{selectedProductName}</span></p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Deposit Amount (in your currency)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="h-14 text-2xl text-center font-bold rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Currency</label>
              <Input
                type="text"
                placeholder="USD, BDT, PKR, etc."
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="h-10 rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Extra Note (optional)</label>
              <Input
                type="text"
                placeholder="Any additional info..."
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>

            <Button
              onClick={() => setStep('confirm')}
              className="w-full h-12 btn-gradient rounded-xl"
              disabled={!depositAmount || parseFloat(depositAmount) <= 0}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Confirm & Contact */}
        {step === 'confirm' && (
          <div className="mt-2 space-y-4">
            <div className="p-4 bg-muted rounded-2xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{profile?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{profile?.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium text-foreground">{profile?.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium text-foreground">{selectedFlag} {selectedCountry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium text-foreground truncate max-w-[180px]">{selectedProductName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-primary text-lg">{depositAmount} {currency}</span>
              </div>
              {extraNote && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Note</span>
                  <span className="font-medium text-foreground truncate max-w-[180px]">{extraNote}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {whatsappNumber && (
                <Button
                  onClick={() => {
                    const msg = buildMessage();
                    window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, '_blank');
                  }}
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contact on WhatsApp
                </Button>
              )}

              <Button
                onClick={() => {
                  const msg = buildMessage().replace(/%0A/g, '\n').replace(/\*/g, '');
                  window.open(`https://t.me/${telegramUsername}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                variant="outline"
                className="w-full h-12 rounded-xl"
              >
                <Send className="w-5 h-5 mr-2" />
                Contact on Telegram
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
