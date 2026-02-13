import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AdminTempAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  hours: string;
  onEmailChange: (email: string) => void;
  onHoursChange: (hours: string) => void;
  onSave: () => void;
}

const AdminTempAdminModal: React.FC<AdminTempAdminModalProps> = ({
  open, onOpenChange, email, hours, onEmailChange, onHoursChange, onSave
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add Temporary Admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input type="email" placeholder="User email" value={email} onChange={(e) => onEmailChange(e.target.value)} />
          <Input type="number" placeholder="Duration (hours)" value={hours} onChange={(e) => onHoursChange(e.target.value)} />
          <Button className="w-full btn-gradient" onClick={onSave}>Add Temporary Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminTempAdminModal;
