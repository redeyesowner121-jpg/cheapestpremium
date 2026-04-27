import React, { useState, useEffect } from 'react';
import { Edit2, X, Wallet, CreditCard, ShoppingBag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserDetailsTab, UserEditForm } from './user-modal/UserDetailsTab';
import { UserActionsTab } from './user-modal/UserActionsTab';
import { UserSecurityTab } from './user-modal/UserSecurityTab';

interface AdminUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  isAdmin: boolean;
  onGiftBlueTick: (userId: string) => void;
  onGiftMoney: (amount: string) => void;
  onRefresh: () => void;
}

const AdminUserModal: React.FC<AdminUserModalProps> = ({
  open, onOpenChange, user, isAdmin, onGiftBlueTick, onGiftMoney, onRefresh,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<UserEditForm>({
    name: '', email: '', phone: '',
    wallet_balance: '', total_deposit: '', total_orders: '',
    rank_balance: '', pending_balance: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        wallet_balance: String(user.wallet_balance || 0),
        total_deposit: String(user.total_deposit || 0),
        total_orders: String(user.total_orders || 0),
        rank_balance: String(user.rank_balance || 0),
        pending_balance: String(user.pending_balance || 0),
      });
      setEditMode(false);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        name: editForm.name,
        phone: editForm.phone || null,
        wallet_balance: parseFloat(editForm.wallet_balance) || 0,
        total_deposit: parseFloat(editForm.total_deposit) || 0,
        total_orders: parseInt(editForm.total_orders) || 0,
        rank_balance: parseFloat(editForm.rank_balance) || 0,
        pending_balance: parseFloat(editForm.pending_balance) || 0,
      };

      const oldBalance = user.wallet_balance || 0;
      const newBalance = updates.wallet_balance;
      const diff = newBalance - oldBalance;

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      if (diff !== 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: diff > 0 ? 'admin_credit' : 'admin_debit',
          amount: Math.abs(diff),
          status: 'completed',
          description: `Admin adjustment: ₹${oldBalance} → ₹${newBalance}`,
        });
      }

      toast.success('User updated successfully');
      setEditMode(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="gradient-primary p-6 rounded-t-3xl text-center relative">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-primary-foreground">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h3 className="font-bold text-lg text-primary-foreground mt-3 flex items-center justify-center gap-1">
            {user.name}
            {user.has_blue_check && <BlueTick />}
          </h3>
          <p className="text-sm text-primary-foreground/70">{user.email}</p>

          <Button
            size="sm"
            variant="ghost"
            className="absolute top-4 right-4 text-primary-foreground hover:bg-white/20"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Balance', value: `₹${user.wallet_balance || 0}`, icon: <Wallet className="w-3.5 h-3.5" /> },
              { label: 'Deposit', value: `₹${user.total_deposit || 0}`, icon: <CreditCard className="w-3.5 h-3.5" /> },
              { label: 'Orders', value: user.total_orders || 0, icon: <ShoppingBag className="w-3.5 h-3.5" /> },
              { label: 'Rank', value: `₹${user.rank_balance || 0}`, icon: <Star className="w-3.5 h-3.5" /> },
            ].map((stat) => (
              <div key={stat.label} className="bg-muted rounded-xl p-2 text-center">
                <div className="flex justify-center text-muted-foreground mb-1">{stat.icon}</div>
                <p className="font-bold text-sm">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
              <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <UserDetailsTab
                user={user}
                editMode={editMode}
                editForm={editForm}
                setEditForm={setEditForm}
                saving={saving}
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="actions">
              <UserActionsTab
                user={user}
                onGiftBlueTick={onGiftBlueTick}
                onGiftMoney={onGiftMoney}
                onClose={() => onOpenChange(false)}
                onRefresh={onRefresh}
              />
            </TabsContent>

            <TabsContent value="security">
              <UserSecurityTab
                user={user}
                isAdmin={isAdmin}
                onClose={() => onOpenChange(false)}
                onRefresh={onRefresh}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUserModal;
