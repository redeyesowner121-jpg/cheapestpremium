import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rate_to_inr: number;
}

interface WalletBalanceCardProps {
  walletBalance: number;
  totalDeposit: number;
  onAddMoney: () => void;
  onWithdraw: () => void;
}

const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  walletBalance,
  totalDeposit,
  onAddMoney,
  onWithdraw
}) => {
  const { settings } = useAppSettingsContext();
  const { displayCurrency, formatPrice } = useCurrencyFormat();
  const { user, refreshProfile } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    const { data } = await supabase
      .from('currencies')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (data) setCurrencies(data);
  };

  const handleSelectCurrency = async (currency: Currency) => {
    if (!user) return;
    if (currency.code === displayCurrency.code) {
      setShowDropdown(false);
      return;
    }
    await supabase.from('profiles').update({ display_currency: currency.code }).eq('id', user.id);
    toast.success(`Currency changed to ${currency.code}`);
    await refreshProfile();
    setShowDropdown(false);
  };

  const displayBalance = (walletBalance / displayCurrency.rate_to_inr).toFixed(2);
  const displayDeposit = (totalDeposit / displayCurrency.rate_to_inr).toFixed(2);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-primary rounded-3xl p-6 text-center shadow-glow relative"
    >
      <p className="text-primary-foreground/80 text-sm">Available Balance</p>
      
      {/* Balance + Currency Selector */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <h1 className="text-4xl font-bold text-primary-foreground">
          {displayCurrency.symbol}{displayBalance}
        </h1>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-primary-foreground text-sm font-semibold"
        >
          {displayCurrency.code}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Currency Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto py-1">
                {currencies.map(c => {
                  const isSelected = c.code === displayCurrency.code;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCurrency(c)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="text-lg">{c.flag}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{c.code}</p>
                        <p className="text-xs text-muted-foreground">{c.name}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <p className="text-primary-foreground/60 text-sm mt-1">
        ≈ ${(walletBalance / (settings.usd_conversion_rate || 95)).toFixed(2)} USD
      </p>
      
      <div className="flex items-center justify-center gap-6 mt-6">
        <div className="text-center">
          <p className="text-primary-foreground/60 text-xs">Total Deposit</p>
          <p className="text-primary-foreground font-semibold">
            {displayCurrency.symbol}{displayDeposit}
          </p>
          <p className="text-primary-foreground/50 text-[10px]">
            ≈ ${(totalDeposit / (settings.usd_conversion_rate || 95)).toFixed(2)}
          </p>
        </div>
        <div className="w-px h-12 bg-primary-foreground/20" />
        <div className="text-center">
          <p className="text-primary-foreground/60 text-xs">Total Spent</p>
          <p className="text-primary-foreground font-semibold">{displayCurrency.symbol}0.00</p>
          <p className="text-primary-foreground/50 text-[10px]">≈ $0.00</p>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <Button
          onClick={onAddMoney}
          className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-primary-foreground rounded-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Money
        </Button>
        <Button
          onClick={onWithdraw}
          variant="outline"
          className="flex-1 h-12 border-white/30 text-primary-foreground hover:bg-white/10 rounded-xl"
        >
          <Minus className="w-5 h-5 mr-2" />
          Withdraw
        </Button>
      </div>
    </motion.div>
  );
};

export default WalletBalanceCard;
