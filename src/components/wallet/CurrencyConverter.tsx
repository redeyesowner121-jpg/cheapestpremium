import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDownUp, ChevronDown, Search, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rate_to_inr: number;
}

interface CurrencyConverterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
}

const CONVERT_FEE_PERCENT = 10;

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({ open, onOpenChange, walletBalance }) => {
  const { user, refreshProfile } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [fromCurrency, setFromCurrency] = useState<Currency | null>(null);
  const [toCurrency, setToCurrency] = useState<Currency | null>(null);
  const [amount, setAmount] = useState('');
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (open) loadCurrencies();
  }, [open]);

  const loadCurrencies = async () => {
    const { data } = await supabase
      .from('currencies')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (data && data.length > 0) {
      setCurrencies(data);
      const inr = data.find(c => c.code === 'INR');
      const usd = data.find(c => c.code === 'USD');
      setFromCurrency(inr || data[0]);
      setToCurrency(usd || data[1] || data[0]);
    }
  };

  const fee = useMemo(() => {
    const val = parseFloat(amount) || 0;
    if (!fromCurrency) return 0;
    const inrVal = val * fromCurrency.rate_to_inr;
    return inrVal * (CONVERT_FEE_PERCENT / 100);
  }, [amount, fromCurrency]);

  const convertedAmount = useMemo(() => {
    if (!fromCurrency || !toCurrency || !amount) return '0.00';
    const val = parseFloat(amount) || 0;
    const inrAmount = val * fromCurrency.rate_to_inr;
    const afterFee = inrAmount - (inrAmount * (CONVERT_FEE_PERCENT / 100));
    const result = afterFee / toCurrency.rate_to_inr;
    return result.toFixed(2);
  }, [amount, fromCurrency, toCurrency]);

  const exchangeRate = useMemo(() => {
    if (!fromCurrency || !toCurrency) return '';
    const rate = fromCurrency.rate_to_inr / toCurrency.rate_to_inr;
    return rate.toFixed(4);
  }, [fromCurrency, toCurrency]);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setAmount('');
  };

  const handleConvert = async () => {
    if (!user || !fromCurrency || !toCurrency) return;
    const val = parseFloat(amount) || 0;
    if (val <= 0) { toast.error('Enter a valid amount'); return; }

    // Calculate INR equivalent of input
    const inrValue = val * fromCurrency.rate_to_inr;
    if (inrValue > walletBalance) { toast.error('Insufficient balance'); return; }

    setConverting(true);
    try {
      const feeInr = inrValue * (CONVERT_FEE_PERCENT / 100);
      const newBalance = walletBalance - feeInr; // deduct fee, balance stays in INR

      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'conversion_fee',
        amount: -feeInr,
        status: 'completed',
        description: `Currency convert fee (${CONVERT_FEE_PERCENT}%): ${fromCurrency.code} → ${toCurrency.code}`
      });

      toast.success(`Converted! ${CONVERT_FEE_PERCENT}% fee (₹${feeInr.toFixed(2)}) deducted.`);
      refreshProfile();
      setAmount('');
      onOpenChange(false);
    } catch {
      toast.error('Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const maxAmount = useMemo(() => {
    if (!fromCurrency) return 0;
    return walletBalance / fromCurrency.rate_to_inr;
  }, [walletBalance, fromCurrency]);

  const filteredCurrencies = currencies.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const CurrencyPicker = () => (
    <AnimatePresence>
      {showPicker && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center"
          onClick={() => { setShowPicker(null); setSearchQuery(''); }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-card rounded-t-3xl p-6 max-h-[70vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-4">Select Currency</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search currency..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[45vh]">
              {filteredCurrencies.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (showPicker === 'from') setFromCurrency(c);
                    else setToCurrency(c);
                    setShowPicker(null);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    (showPicker === 'from' ? fromCurrency : toCurrency)?.id === c.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-2xl">{c.flag}</span>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-foreground">{c.code}</p>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{c.symbol} = ₹{c.rate_to_inr}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-card rounded-t-3xl p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-1">Convert Currency</h3>
          <p className="text-xs text-muted-foreground mb-4">Permanently convert your balance between currencies</p>

          {/* From */}
          <div className="bg-muted rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">From</span>
              <button onClick={() => setAmount(maxAmount.toFixed(2))} className="text-xs text-primary font-medium">
                Max: {maxAmount.toFixed(2)} {fromCurrency?.code}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPicker('from')} className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl shrink-0">
                <span className="text-lg">{fromCurrency?.flag}</span>
                <span className="font-semibold text-foreground">{fromCurrency?.code}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-0 min-w-0 flex-1 text-right text-xl font-bold text-foreground bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Swap */}
          <div className="flex justify-center -my-3 relative z-10">
            <button onClick={handleSwap} className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform">
              <ArrowDownUp className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>

          {/* To */}
          <div className="bg-muted rounded-xl p-4">
            <span className="text-xs text-muted-foreground mb-2 block">To (after {CONVERT_FEE_PERCENT}% fee)</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPicker('to')} className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl shrink-0">
                <span className="text-lg">{toCurrency?.flag}</span>
                <span className="font-semibold text-foreground">{toCurrency?.code}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="flex-1 text-right text-xl font-bold text-primary">
                {toCurrency?.symbol}{convertedAmount}
              </span>
            </div>
          </div>

          {/* Fee Info */}
          <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-destructive">
              <p className="font-semibold">{CONVERT_FEE_PERCENT}% conversion fee applies</p>
              <p>Fee: ₹{fee.toFixed(2)} • Rate: 1 {fromCurrency?.code} = {exchangeRate} {toCurrency?.code}</p>
            </div>
          </div>

          {/* Convert Button */}
          <Button
            onClick={handleConvert}
            disabled={converting || !amount || parseFloat(amount) <= 0}
            className="w-full h-12 mt-4 btn-gradient rounded-xl"
          >
            {converting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Convert Now
          </Button>
        </motion.div>
      </motion.div>

      <CurrencyPicker />
    </AnimatePresence>
  );
};

export default CurrencyConverter;
