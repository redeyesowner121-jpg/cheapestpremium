import React, { useState } from 'react';
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

interface EditReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onSuccess: () => void;
}

const EditReferralModal: React.FC<EditReferralModalProps> = ({
  open,
  onOpenChange,
  profileId,
  onSuccess,
}) => {
  const [newReferralCode, setNewReferralCode] = useState('');

  const handleUpdateReferralCode = async () => {
    if (newReferralCode.length < 4) {
      toast.error('Referral code must be at least 4 characters');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: newReferralCode.toUpperCase() })
        .eq('id', profileId);
      
      if (error) {
        if (error.code === '23505') {
          toast.error('This referral code is already taken');
        } else {
          toast.error('Failed to update referral code');
        }
        return;
      }
      
      onSuccess();
      onOpenChange(false);
      setNewReferralCode('');
      toast.success('Referral code updated!');
    } catch (error) {
      toast.error('Failed to update referral code');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Customize Referral Code</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <Input
            placeholder="Enter new referral code"
            value={newReferralCode}
            onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
            className="h-12 rounded-xl uppercase"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">
            Choose a unique code (4-10 characters, letters and numbers only)
          </p>
          <Button
            className="w-full btn-gradient rounded-xl"
            onClick={handleUpdateReferralCode}
            disabled={newReferralCode.length < 4}
          >
            Update Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditReferralModal;
