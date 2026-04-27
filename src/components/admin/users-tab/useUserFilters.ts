import { useMemo } from 'react';

interface Filters {
  searchQuery: string;
  userFilter: string;
  sortBy: string;
  depositRange: { min: string; max: string };
}

export function useUserFilters(users: any[], f: Filters) {
  return useMemo(() => {
    let result = users;

    if (f.searchQuery.trim()) {
      const q = f.searchQuery.toLowerCase();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    }

    if (f.userFilter !== 'all') {
      result = result.filter(u => {
        switch (f.userFilter) {
          case 'high_value': return (u.total_deposit || 0) >= 1000;
          case 'active': return (u.total_orders || 0) >= 5;
          case 'new': return (u.total_orders || 0) === 0;
          case 'reseller': return u.is_reseller === true;
          case 'verified': return u.has_blue_check === true;
          default: return true;
        }
      });
    }

    if (f.depositRange.min) result = result.filter(u => (u.total_deposit || 0) >= parseFloat(f.depositRange.min));
    if (f.depositRange.max) result = result.filter(u => (u.total_deposit || 0) <= parseFloat(f.depositRange.max));

    return [...result].sort((a, b) => {
      switch (f.sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'deposit_high': return (b.total_deposit || 0) - (a.total_deposit || 0);
        case 'deposit_low': return (a.total_deposit || 0) - (b.total_deposit || 0);
        case 'orders_high': return (b.total_orders || 0) - (a.total_orders || 0);
        case 'balance_high': return (b.wallet_balance || 0) - (a.wallet_balance || 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [users, f.searchQuery, f.userFilter, f.sortBy, f.depositRange]);
}
