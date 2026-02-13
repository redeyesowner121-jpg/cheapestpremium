import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, MessageCircle, Gift, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              {user.name?.charAt(0) || 'U'}
            </div>
            <h3 className="font-bold text-foreground mt-2 flex items-center justify-center gap-1">
              {user.name}
              {user.has_blue_check && <BlueTick />}
            </h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded-xl p-2">
              <p className="font-bold">₹{user.wallet_balance || 0}</p>
              <p className="text-xs text-muted-foreground">Balance</p>
            </div>
            <div className="bg-muted rounded-xl p-2">
              <p className="font-bold">₹{user.total_deposit || 0}</p>
              <p className="text-xs text-muted-foreground">Deposited</p>
            </div>
            <div className="bg-muted rounded-xl p-2">
              <p className="font-bold">{user.total_orders || 0}</p>
              <p className="text-xs text-muted-foreground">Orders</p>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-sm">
            <p><strong>Referral Code:</strong> {user.referral_code}</p>
            <p><strong>Referred By:</strong> {user.referred_by || 'None'}</p>
            <p><strong>Joined:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
            <p><strong>Rank Balance:</strong> ₹{user.rank_balance || 0}</p>
          </div>

          <div className="flex gap-2">
            {!user.has_blue_check && (
              <Button onClick={() => onGiftBlueTick(user.id)} className="flex-1 btn-gradient">
                <Award className="w-4 h-4 mr-2" />
                Gift Blue Tick
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => navigate('/chat')}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">💼 Reseller Status</span>
              {user.is_reseller && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>
              )}
            </div>
            <Switch
              checked={user.is_reseller || false}
              onCheckedChange={async (checked) => {
                await supabase.from('profiles').update({ is_reseller: checked }).eq('id', user.id);
                toast.success(checked ? 'User is now a Reseller!' : 'Reseller status removed');
                onRefresh();
              }}
            />
          </div>

          <div className="flex gap-2">
            <Input type="number" placeholder="Amount" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className="flex-1" />
            <Button onClick={() => { onGiftMoney(giftAmount); setGiftAmount(''); }}>
              <Gift className="w-4 h-4 mr-2" />
              Gift Money
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'seller').maybeSingle();
              if (existingRole) {
                await supabase.from('user_roles').delete().eq('id', existingRole.id);
                toast.success('Seller role removed');
              } else {
                await supabase.from('user_roles').insert({ user_id: user.id, role: 'seller' });
                toast.success('User is now a seller!');
              }
              onOpenChange(false);
              onRefresh();
            }}
          >
            <Shield className="w-4 h-4 mr-2" />
            Toggle Seller Role
          </Button>

          {isAdmin && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={async () => {
                if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;
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
              Delete User
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUserModal;
