import React, { useState } from 'react';
import { Search, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BlueTick from '@/components/BlueTick';

interface AdminUsersSectionProps {
  users: any[];
  onSelectUser: (user: any) => void;
  onDataChange: () => void;
}

const AdminUsersSection: React.FC<AdminUsersSectionProps> = ({
  users,
  onSelectUser,
  onDataChange,
}) => {
  const [userSearch, setUserSearch] = useState('');
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState('');

  const filteredUsers = users.filter(u =>
    userSearch === '' ||
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleInlineBalanceSave = async (user: any) => {
    const newBalance = parseFloat(editBalanceValue);
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
    setEditingBalanceId(null);
    setEditBalanceValue('');
    onDataChange();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredUsers.slice(0, 15).map((user: any) => (
          <div
            key={user.id}
            onClick={() => onSelectUser(user)}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-bold">
              {(user.name || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="font-medium text-foreground text-sm truncate">{user.name}</p>
                {user.has_blue_check && <BlueTick />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="text-right" onClick={(e) => e.stopPropagation()}>
              {editingBalanceId === user.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={editBalanceValue}
                    onChange={(e) => setEditBalanceValue(e.target.value)}
                    className="h-6 w-16 text-xs px-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInlineBalanceSave(user);
                      if (e.key === 'Escape') setEditingBalanceId(null);
                    }}
                  />
                  <button onClick={() => handleInlineBalanceSave(user)} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingBalanceId(null)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <p
                  className="font-bold text-foreground text-sm cursor-pointer hover:text-primary hover:underline transition-colors"
                  onClick={() => { setEditingBalanceId(user.id); setEditBalanceValue(String(user.wallet_balance || 0)); }}
                  title="Click to edit balance"
                >
                  ₹{user.wallet_balance || 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{user.total_orders || 0} orders</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminUsersSection;
