import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDownUp, ChevronDown, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rate_to_inr: number;
}

interface CurrencyConverterProps {
  walletBalance: number;
}

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({ walletBalance }) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [fromCurrency, setFromCurrency] = useState<Currency | null>(null);
  const [toCurrency, setToCurrency] = useState<Currency | null>(null);
  const [amount, setAmount] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCurrencies();
  }, []);

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
      setAmount(walletBalance.toFixed(2));
    }
  };

  const convertedAmount = useMemo(() => {
    if (!fromCurrency || !toCurrency || !amount) return '0.00';
    const val = parseFloat(amount) || 0;
    // Convert from source to INR, then from INR to target
    const inrAmount = val * fromCurrency.rate_to_inr;
    const result = inrAmount / toCurrency.rate_to_inr;
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
    setAmount(convertedAmount);
  };

  const filteredCurrencies = currencies.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const useBalance = () => {
    if (fromCurrency?.code === 'INR') {
      setAmount(walletBalance.toFixed(2));
    } else if (fromCurrency) {
      setAmount((walletBalance / fromCurrency.rate_to_inr).toFixed(2));
    }
  };

  const CurrencyPicker = ({ 
    show, onClose, onSelect, selected 
  }: { 
    show: boolean; onClose: () => void; onSelect: (c: Currency) => void; selected: Currency | null 
  }) => (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={onClose}
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
                  onClick={() => { onSelect(c); onClose(); setSearchQuery(''); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    selected?.id === c.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-2xl">{c.flag}</span>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-foreground">{c.code}</p>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {c.symbol}{c.code === 'INR' ? '1' : (1).toFixed(2)} = ₹{c.rate_to_inr}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (currencies.length < 2) return null;

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Currency Converter</h3>
        {fromCurrency && toCurrency && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">
            1 {fromCurrency.code} = {exchangeRate} {toCurrency.code}
          </span>
        )}
      </div>

      {/* From */}
      <div className="bg-muted rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">From</span>
          <button onClick={useBalance} className="text-xs text-primary font-medium">
            Use Balance
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFromPicker(true)}
            className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl shrink-0"
          >
            <span className="text-lg">{fromCurrency?.flag}</span>
            <span className="font-semibold text-foreground">{fromCurrency?.code}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 text-right text-xl font-bold text-foreground bg-transparent outline-none"
          />
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center -my-3 relative z-10">
        <button
          onClick={handleSwap}
          className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        >
          <ArrowDownUp className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* To */}
      <div className="bg-muted rounded-xl p-4">
        <span className="text-xs text-muted-foreground mb-2 block">To</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowToPicker(true)}
            className="flex items-center gap-2 bg-card px-3 py-2 rounded-xl shrink-0"
          >
            <span className="text-lg">{toCurrency?.flag}</span>
            <span className="font-semibold text-foreground">{toCurrency?.code}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="flex-1 text-right text-xl font-bold text-primary">
            {toCurrency?.symbol}{convertedAmount}
          </span>
        </div>
      </div>

      {/* Pickers */}
      <CurrencyPicker
        show={showFromPicker}
        onClose={() => setShowFromPicker(false)}
        onSelect={setFromCurrency}
        selected={fromCurrency}
      />
      <CurrencyPicker
        show={showToPicker}
        onClose={() => setShowToPicker(false)}
        onSelect={setToCurrency}
        selected={toCurrency}
      />
    </div>
  );
};

export default CurrencyConverter;
