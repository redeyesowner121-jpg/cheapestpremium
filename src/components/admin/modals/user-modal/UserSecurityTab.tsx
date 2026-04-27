import React, { useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  user: any;
  isAdmin: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const UserSecurityTab: React.FC<Props> = ({ user, isAdmin, onClose, onRefresh }) => {
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${user.name}? This cannot be undone.`)) return;
    await supabase.from('user_roles').delete().eq('user_id', user.id);
    await supabase.from('notifications').delete().eq('user_id', user.id);
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('orders').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    toast.success('User deleted');
    onClose();
    onRefresh();
  };

  return (
    <div className="space-y-3 mt-3">
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

      {isAdmin && (
        <Button variant="destructive" className="w-full rounded-xl" onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete User Permanently
        </Button>
      )}
    </div>
  );
};
