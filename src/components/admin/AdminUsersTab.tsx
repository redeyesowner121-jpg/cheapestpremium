import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Eye, Users, TrendingUp, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BlueTick from '@/components/BlueTick';
import AdminAdvancedFilters from './AdminAdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminUsersTabProps {
  users: any[];
  onSelectUser: (user: any) => void;
  onRefresh?: () => void;
}

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'deposit_high', label: 'Deposit ↓' },
  { value: 'deposit_low', label: 'Deposit ↑' },
  { value: 'orders_high', label: 'Orders ↓' },
  { value: 'balance_high', label: 'Balance ↓' },
];

const userFilters = [
  { value: 'all', label: 'All Users' },
  { value: 'high_value', label: 'High Value (₹1000+)' },
  { value: 'active', label: 'Active (5+ orders)' },
  { value: 'new', label: 'New (no orders)' },
  { value: 'reseller', label: 'Resellers' },
  { value: 'verified', label: 'Verified ✓' },
];

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ users, onSelectUser, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [userFilter, setUserFilter] = useState('all');
  const [depositRange, setDepositRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');

  const handleSaveBalance = async (user: any) => {
    const newBalance = parseFloat(editBalance);
    if (isNaN(newBalance) || newBalance < 0) {
      toast.error('Invalid balance');
      return;
    }
    const oldBalance = user.wallet_balance || 0;
    const diff = newBalance - oldBalance;

    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update balance');
      return;
    }

    if (diff !== 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: diff > 0 ? 'admin_credit' : 'admin_debit',
        amount: Math.abs(diff),
        status: 'completed',
        description: `Admin balance adjustment: ₹${oldBalance} → ₹${newBalance}`
      });
    }

    toast.success(`Balance updated to ₹${newBalance}`);
    setEditingUserId(null);
    setEditBalance('');
    onRefresh?.();
  };

  const filteredUsers = useMemo(() => {
    let result = users;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.phone?.includes(query)
      );
    }

    // User type filter
    if (userFilter !== 'all') {
      result = result.filter(u => {
        switch (userFilter) {
          case 'high_value':
            return (u.total_deposit || 0) >= 1000;
          case 'active':
            return (u.total_orders || 0) >= 5;
          case 'new':
            return (u.total_orders || 0) === 0;
          case 'reseller':
            return u.is_reseller === true;
          case 'verified':
            return u.has_blue_check === true;
          default:
            return true;
        }
      });
    }

    // Deposit range filter
    if (depositRange.min) {
      result = result.filter(u => (u.total_deposit || 0) >= parseFloat(depositRange.min));
    }
    if (depositRange.max) {
      result = result.filter(u => (u.total_deposit || 0) <= parseFloat(depositRange.max));
    }

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'deposit_high':
          return (b.total_deposit || 0) - (a.total_deposit || 0);
        case 'deposit_low':
          return (a.total_deposit || 0) - (b.total_deposit || 0);
        case 'orders_high':
          return (b.total_orders || 0) - (a.total_orders || 0);
        case 'balance_high':
          return (b.wallet_balance || 0) - (a.wallet_balance || 0);
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [users, searchQuery, sortBy, userFilter, depositRange]);

  // Stats
  const totalDeposit = users.reduce((sum, u) => sum + (u.total_deposit || 0), 0);
  const activeUsers = users.filter(u => (u.total_orders || 0) > 0).length;
  const resellersCount = users.filter(u => u.is_reseller).length;

  const userFilterButtons = (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="w-3 h-3" />
        User Type
      </label>
      <div className="flex gap-2 flex-wrap">
        {userFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setUserFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              userFilter === filter.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground hover:bg-muted'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );

  const depositRangeFilter = (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        Total Deposit Range (₹)
      </label>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={depositRange.min}
          onChange={(e) => setDepositRange({ ...depositRange, min: e.target.value })}
          className="h-8 text-xs"
        />
        <Input
          type="number"
          placeholder="Max"
          value={depositRange.max}
          onChange={(e) => setDepositRange({ ...depositRange, max: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl p-3 text-center shadow-card">
          <p className="text-lg font-bold text-foreground">{users.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Users</p>
        </div>
        <div className="bg-card rounded-xl p-3 text-center shadow-card">
          <p className="text-lg font-bold text-primary">₹{totalDeposit.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Total Deposits</p>
        </div>
        <div className="bg-card rounded-xl p-3 text-center shadow-card">
          <p className="text-lg font-bold text-success">{activeUsers}</p>
          <p className="text-[10px] text-muted-foreground">Active Buyers</p>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdminAdvancedFilters
        config={{
          searchPlaceholder: 'Search by name, email, phone...',
          showSortOptions: true,
          sortOptions,
          customFilters: (
            <div className="space-y-4">
              {userFilterButtons}
              {depositRangeFilter}
            </div>
          )
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Results Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filteredUsers.length} of {users.length} users
        {resellersCount > 0 && <span className="ml-2">• {resellersCount} resellers</span>}
      </p>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No users found matching your filters</p>
          </div>
        ) : (
          filteredUsers.map((user: any) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-2xl p-4 shadow-card"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    {user.name}
                    {user.has_blue_check && <BlueTick size="sm" />}
                    {user.is_reseller && (
                      <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full ml-1">
                        Reseller
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {editingUserId === user.id ? (
                      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          className="h-5 w-20 text-xs px-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveBalance(user);
                            if (e.key === 'Escape') setEditingUserId(null);
                          }}
                        />
                        <button onClick={() => handleSaveBalance(user)} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingUserId(null)} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary hover:underline transition-colors"
                        onClick={(e) => { e.stopPropagation(); setEditingUserId(user.id); setEditBalance(String(user.wallet_balance || 0)); }}
                        title="Click to edit balance"
                      >
                        Balance: ₹{user.wallet_balance || 0}
                      </span>
                    )}
                    <span className={`${(user.total_deposit || 0) >= 1000 ? 'text-primary font-medium' : ''}`}>
                      Deposit: ₹{user.total_deposit || 0}
                    </span>
                    <span className={`${(user.total_orders || 0) >= 5 ? 'text-success font-medium' : ''}`}>
                      Orders: {user.total_orders || 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectUser(user)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminUsersTab;
