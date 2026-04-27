import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  user: any | null;
  onClose: () => void;
}

const ResetPasswordModal: React.FC<Props> = ({ user, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!user || !newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: user.id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Password reset for ${user.name}`);
      setNewPassword('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) { setNewPassword(''); onClose(); } }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user?.name}</strong> ({user?.email})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Input type="text" placeholder="Enter new password (min 6 chars)" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" minLength={6} />
          <Button onClick={handleReset} className="w-full btn-gradient rounded-xl"
            disabled={resetting || newPassword.length < 6}>
            {resetting ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordModal;
