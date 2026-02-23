import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, MessageCircle, Gift, Shield, Trash2, KeyRound,
  Edit2, Save, X, Wallet, CreditCard, ShoppingBag, Phone, Mail,
  Calendar, Hash, UserCheck, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BlueTick from '@/components/BlueTick';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  open, onOpenChange, user, isAdmin, onGiftBlueTick, onGiftMoney, onRefresh
}) => {
  const navigate = useNavigate();
  const [giftAmount, setGiftAmount] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '',
    wallet_balance: '', total_deposit: '', total_orders: '',
    rank_balance: '', pending_balance: '',
  });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

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
      setNewPassword('');
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

      // Track balance change for transaction log
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
          description: `Admin adjustment: ₹${oldBalance} → ₹${newBalance}`
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

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: user.id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Password reset successfully');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const InfoRow = ({ icon, label, value, editable, field, type = 'text' }: {
    icon: React.ReactNode; label: string; value: string | number; editable?: boolean; field?: string; type?: string;
  }) => (
    <div className="flex items-center gap-3 py-2">
      <div className="text-muted-foreground w-5 flex-shrink-0">{icon}</div>
      <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{label}</span>
      {editMode && editable && field ? (
        <Input
          type={type}
          value={(editForm as any)[field]}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className="h-8 text-sm flex-1"
        />
      ) : (
        <span className="text-sm font-medium text-foreground flex-1 truncate">{value}</span>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="gradient-primary p-6 rounded-t-3xl text-center relative">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-primary-foreground">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h3 className="font-bold text-lg text-primary-foreground mt-3 flex items-center justify-center gap-1">
            {user.name}
            {user.has_blue_check && <BlueTick />}
          </h3>
          <p className="text-sm text-primary-foreground/70">{user.email}</p>
          
          {/* Edit toggle */}
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
          {/* Stats Grid */}
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

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-1 mt-3">
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Name" value={user.name} editable field="name" />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone || 'Not set'} editable field="phone" />
              <Separator />
              <InfoRow icon={<Wallet className="w-4 h-4" />} label="Balance" value={`₹${user.wallet_balance || 0}`} editable field="wallet_balance" type="number" />
              <InfoRow icon={<Wallet className="w-4 h-4" />} label="Pending" value={`₹${user.pending_balance || 0}`} editable field="pending_balance" type="number" />
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Total Deposit" value={`₹${user.total_deposit || 0}`} editable field="total_deposit" type="number" />
              <InfoRow icon={<ShoppingBag className="w-4 h-4" />} label="Total Orders" value={user.total_orders || 0} editable field="total_orders" type="number" />
              <InfoRow icon={<Star className="w-4 h-4" />} label="Rank Balance" value={`₹${user.rank_balance || 0}`} editable field="rank_balance" type="number" />
              <Separator />
              <InfoRow icon={<Hash className="w-4 h-4" />} label="Referral Code" value={user.referral_code || 'None'} />
              <InfoRow icon={<UserCheck className="w-4 h-4" />} label="Referred By" value={user.referred_by || 'None'} />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Joined" value={new Date(user.created_at).toLocaleDateString('en-IN')} />
              <InfoRow icon={<Award className="w-4 h-4" />} label="Blue Tick" value={user.has_blue_check ? '✅ Yes' : '❌ No'} />
              <InfoRow icon={<Shield className="w-4 h-4" />} label="Reseller" value={user.is_reseller ? '✅ Yes' : '❌ No'} />

              {editMode && (
                <Button onClick={handleSave} disabled={saving} className="w-full btn-gradient rounded-xl mt-3">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="space-y-3 mt-3">
              {/* Blue Tick */}
              {!user.has_blue_check && (
                <Button onClick={() => onGiftBlueTick(user.id)} className="w-full btn-gradient rounded-xl">
                  <Award className="w-4 h-4 mr-2" />
                  Gift Blue Tick
                </Button>
              )}

              {/* Reseller Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm font-medium">💼 Reseller Status</span>
                <Switch
                  checked={user.is_reseller || false}
                  onCheckedChange={async (checked) => {
                    await supabase.from('profiles').update({ is_reseller: checked }).eq('id', user.id);
                    toast.success(checked ? 'Reseller activated!' : 'Reseller removed');
                    onRefresh();
                  }}
                />
              </div>

              {/* Gift Money */}
              <div className="flex gap-2">
                <Input type="number" placeholder="Amount (₹)" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className="flex-1 rounded-xl" />
                <Button onClick={() => { onGiftMoney(giftAmount); setGiftAmount(''); }} className="rounded-xl">
                  <Gift className="w-4 h-4 mr-2" />
                  Gift
                </Button>
              </div>

              {/* Message */}
              <Button variant="outline" className="w-full rounded-xl" onClick={() => { onOpenChange(false); navigate('/chat'); }}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Message
              </Button>

              {/* Toggle Seller Role */}
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={async () => {
                  const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'seller').maybeSingle();
                  if (existingRole) {
                    await supabase.from('user_roles').delete().eq('id', existingRole.id);
                    toast.success('Seller role removed');
                  } else {
                    await supabase.from('user_roles').insert({ user_id: user.id, role: 'seller' });
                    toast.success('Seller role added!');
                  }
                  onOpenChange(false);
                  onRefresh();
                }}
              >
                <Shield className="w-4 h-4 mr-2" />
                Toggle Seller Role
              </Button>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-3 mt-3">
              {/* Password Reset */}
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Reset Password</span>
                </div>
                <Input
                  type="text"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl"
                />
                <Button
                  onClick={handleResetPassword}
                  disabled={resettingPassword || newPassword.length < 6}
                  className="w-full btn-gradient rounded-xl"
                >
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>

              {/* Delete User */}
              {isAdmin && (
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={async () => {
                    if (!confirm(`Are you sure you want to delete ${user.name}? This cannot be undone.`)) return;
                    await supabase.from('user_roles').delete().eq('user_id', user.id);
                    await supabase.from('notifications').delete().eq('user_id', user.id);
                    await supabase.from('transactions').delete().eq('user_id', user.id);
                    await supabase.from('orders').delete().eq('user_id', user.id);
                    await supabase.from('profiles').delete().eq('id', user.id);
                    toast.success('User deleted');
                    onOpenChange(false);
                    onRefresh();
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User Permanently
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUserModal;
