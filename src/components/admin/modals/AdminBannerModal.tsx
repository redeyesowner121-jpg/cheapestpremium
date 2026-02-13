import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AdminBannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bannerForm: { title: string; image_url: string; link: string; is_active: boolean };
  setBannerForm: (form: any) => void;
  onSave: () => void;
}

const AdminBannerModal: React.FC<AdminBannerModalProps> = ({
  open, onOpenChange, bannerForm, setBannerForm, onSave
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add Banner</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Banner Title *" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} />
          <Input placeholder="Image URL *" value={bannerForm.image_url} onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })} />
          <Input placeholder="Link (Optional)" value={bannerForm.link} onChange={(e) => setBannerForm({ ...bannerForm, link: e.target.value })} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={bannerForm.is_active} onCheckedChange={(v) => setBannerForm({ ...bannerForm, is_active: v })} />
          </div>
          <Button className="w-full btn-gradient" onClick={onSave}>Add Banner</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBannerModal;
