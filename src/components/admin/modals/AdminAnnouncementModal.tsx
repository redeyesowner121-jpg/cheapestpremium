import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AdminAnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onTitleChange: (title: string) => void;
  onMessageChange: (message: string) => void;
  onSave: () => void;
}

const AdminAnnouncementModal: React.FC<AdminAnnouncementModalProps> = ({
  open, onOpenChange, title, message, onTitleChange, onMessageChange, onSave
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Create Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Title" value={title} onChange={(e) => onTitleChange(e.target.value)} />
          <Textarea placeholder="Message" value={message} onChange={(e) => onMessageChange(e.target.value)} rows={4} />
          <Button className="w-full btn-gradient" onClick={onSave}>
            <Bell className="w-4 h-4 mr-2" />
            Send Announcement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAnnouncementModal;
