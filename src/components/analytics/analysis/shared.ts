// ===== Analytics shared constants & hooks =====

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--destructive))', '#f59e0b', '#8b5cf6', '#ec4899'];

export const USER_VALUE = 10;
export const DEPOSIT_VALUE = 1;
export const ORDER_VALUE = 5;
export const PROFIT_VALUE = 2;
export const VISIT_VALUE = 1;

export function useAnalyticsExtras() {
  const [searchLogs, setSearchLogs] = useState<{ created_at: string }[]>([]);
  const [siteVisits, setSiteVisits] = useState<{ created_at: string; subdomain: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('search_logs').select('created_at').order('created_at', { ascending: true });
      if (s) setSearchLogs(s);
      const { data: v } = await supabase.from('site_visits').select('created_at, subdomain').order('created_at', { ascending: true });
      if (v) setSiteVisits(v as any);
    })();
  }, []);

  return { searchLogs, siteVisits };
}
