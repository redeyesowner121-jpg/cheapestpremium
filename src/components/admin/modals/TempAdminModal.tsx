import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TempAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const TempAdminModal: React.FC<TempAdminModalProps> = ({
  open,
  onOpenChange,
  onRefresh,
}) => {
  const [email, setEmail] = React.useState('');
  const [hours, setHours] = React.useState('24');

  const resetForm = () => {
    setEmail('');
    setHours('24');
  };

  const handleAddTempAdmin = async () => {
    if (!email || !hours) return;
    
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      toast.error('User not found');
      return;
    }

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(hours));

    const { error } = await supabase.from('user_roles').upsert({
      user_id: user.id,
      role: 'temp_admin',
      temp_admin_expiry: expiryDate.toISOString()
    });

    if (error) {
      toast.error('Failed to add temp admin');
      return;
    }

    toast.success('Temporary admin added!');
    resetForm();
    onOpenChange(false);
    onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add Temporary Admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input 
            type="email" 
            placeholder="User email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <Input 
            type="number" 
            placeholder="Duration (hours)" 
            value={hours} 
            onChange={(e) => setHours(e.target.value)} 
          />
          <Button className="w-full btn-gradient" onClick={handleAddTempAdmin}>
            Add Temporary Admin
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TempAdminModal;
