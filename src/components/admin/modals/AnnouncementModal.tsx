import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  open,
  onOpenChange,
  onRefresh,
}) => {
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');

  const resetForm = () => {
    setTitle('');
    setMessage('');
  };

  const handleCreateAnnouncement = async () => {
    if (!title || !message) return;
    
    await supabase.from('announcements').insert({
      title,
      message,
      type: 'info',
      is_active: true
    });

    toast.success('Announcement created!');
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
          <DialogTitle>Create Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          <Button className="w-full btn-gradient" onClick={handleCreateAnnouncement}>
            <Bell className="w-4 h-4 mr-2" />
            Send Announcement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementModal;
