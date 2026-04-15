import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DisplayCurrency {
  code: string;
  symbol: string;
  rate_to_inr: number;
}

const INR_DEFAULT: DisplayCurrency = { code: 'INR', symbol: '₹', rate_to_inr: 1 };

export const useCurrencyFormat = () => {
  const { profile } = useAuth();
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(INR_DEFAULT);

  useEffect(() => {
    const code = profile?.display_currency || 'INR';
    if (code === 'INR') {
      setDisplayCurrency(INR_DEFAULT);
      return;
    }
    supabase
      .from('currencies')
      .select('code, symbol, rate_to_inr')
      .eq('code', code)
      .single()
      .then(({ data }) => {
        if (data) setDisplayCurrency(data);
        else setDisplayCurrency(INR_DEFAULT);
      });
  }, [profile?.display_currency]);

  const formatPrice = useCallback(
    (inrAmount: number, decimals: number = 2) => {
      const converted = inrAmount / displayCurrency.rate_to_inr;
      return `${displayCurrency.symbol}${(Math.round(converted * 100) / 100).toFixed(decimals)}`;
    },
    [displayCurrency]
  );

  const currencySymbol = displayCurrency.symbol;
  const isForeignCurrency = displayCurrency.code !== 'INR';

  return { formatPrice, currencySymbol, displayCurrency, isForeignCurrency };
};
