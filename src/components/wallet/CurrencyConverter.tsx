import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDownUp, ChevronDown, Search, Loader2 } from 'lucide-react';
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
  onConverted?: () => void;
}

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({ open, onOpenChange, walletBalance, onConverted }) => {
  const { user, refreshProfile } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
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
    }
  };

  const handleConvert = async () => {
    if (!user || !selectedCurrency) return;

    setConverting(true);
    try {
      await supabase.from('profiles').update({ 
        display_currency: selectedCurrency.code 
      }).eq('id', user.id);

      toast.success(`Display currency changed to ${selectedCurrency.code}!`);
      await refreshProfile();
      onConverted?.();
      onOpenChange(false);
    } catch {
      toast.error('Failed to change currency');
    } finally {
      setConverting(false);
    }
  };

  const displayBalance = useMemo(() => {
    if (!selectedCurrency) return '0.00';
    return (walletBalance / selectedCurrency.rate_to_inr).toFixed(2);
  }, [walletBalance, selectedCurrency]);

  const filteredCurrencies = currencies.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          className="w-full max-w-lg bg-card rounded-t-3xl p-6 max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4 flex-shrink-0" />
          <h3 className="text-lg font-bold text-foreground mb-1 flex-shrink-0">Change Display Currency</h3>
          <p className="text-xs text-muted-foreground mb-4 flex-shrink-0">
            Your balance stays the same (₹{walletBalance.toFixed(2)} INR). Only the display format changes.
          </p>

          {/* Search */}
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search currency..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Currency List - scrollable */}
          <div className="space-y-1 overflow-y-auto flex-1 min-h-0 mb-3">
            {filteredCurrencies.map(c => {
              const converted = (walletBalance / c.rate_to_inr).toFixed(2);
              const isAAX = c.code === 'AAX';
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCurrency(c)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                    selectedCurrency?.id === c.id
                      ? 'bg-primary/10 border border-primary/30'
                      : isAAX
                        ? 'bg-success/5 border border-success/20 hover:bg-success/10'
                        : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-xl">{c.flag}</span>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm text-foreground">{c.code}</p>
                      {isAAX && (
                        <span className="text-[10px] font-bold bg-success/20 text-success px-1.5 py-0.5 rounded-full">
                          UP TO 5% OFF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground">{c.symbol}{converted}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Preview + Convert Button - always visible */}
          <div className="flex-shrink-0">
            {selectedCurrency && (
              <div className="bg-muted rounded-xl p-3 mb-3 text-center">
                <p className="text-xs text-muted-foreground">Your balance will display as</p>
                <p className="text-xl font-bold text-primary mt-1">
                  {selectedCurrency.symbol}{displayBalance} {selectedCurrency.code}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Actual balance: ₹{walletBalance.toFixed(2)} INR (unchanged)
                </p>
              </div>
            )}

            <Button
              onClick={handleConvert}
              disabled={converting || !selectedCurrency}
              className="w-full h-12 btn-gradient rounded-xl"
            >
              {converting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {selectedCurrency ? `Switch to ${selectedCurrency.code}` : 'Select a currency'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CurrencyConverter;
