import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useReferralCount(referralCode: string | undefined) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!referralCode) return;
    let cancelled = false;
    (async () => {
      const { count: c } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', referralCode);
      if (!cancelled) setCount(c || 0);
    })();
    return () => { cancelled = true; };
  }, [referralCode]);
  return count;
}
