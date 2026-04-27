import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Check, X, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  user: any;
  onSelect: (u: any) => void;
  onResetPassword: (u: any) => void;
  onRefresh?: () => void;
}

const UserCard: React.FC<Props> = ({ user, onSelect, onResetPassword, onRefresh }) => {
  const [editing, setEditing] = useState(false);
  const [editBalance, setEditBalance] = useState('');

  const saveBalance = async () => {
    const newBalance = parseFloat(editBalance);
    if (isNaN(newBalance) || newBalance < 0) { toast.error('Invalid balance'); return; }
    const oldBalance = user.wallet_balance || 0;
    const diff = newBalance - oldBalance;
    const { error } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', user.id);
    if (error) { toast.error('Failed to update balance'); return; }
    if (diff !== 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: diff > 0 ? 'admin_credit' : 'admin_debit',
        amount: Math.abs(diff),
        status: 'completed',
        description: `Admin balance adjustment: ₹${oldBalance} → ₹${newBalance}`,
      });
    }
    toast.success(`Balance updated to ₹${newBalance}`);
    setEditing(false); setEditBalance('');
    onRefresh?.();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
          {user.name?.charAt(0) || 'U'}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground flex items-center gap-1">
            {user.name}
            {user.has_blue_check && <BlueTick size="sm" />}
            {user.is_reseller && (
              <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full ml-1">Reseller</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            {editing ? (
              <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)}
                  className="h-5 w-20 text-xs px-1" autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveBalance();
                    if (e.key === 'Escape') setEditing(false);
                  }} />
                <button onClick={saveBalance} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
              </span>
            ) : (
              <span className="cursor-pointer hover:text-primary hover:underline transition-colors"
                onClick={(e) => { e.stopPropagation(); setEditing(true); setEditBalance(String(user.wallet_balance || 0)); }}
                title="Click to edit balance">
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
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" onClick={() => onSelect(user)}><Eye className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onResetPassword(user); }} title="Reset Password">
            <KeyRound className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default UserCard;
