import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ImageUpload from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bannersCount: number;
  onRefresh: () => void;
}

interface BannerForm {
  title: string;
  image_url: string;
  link: string;
  is_active: boolean;
}

const BannerModal: React.FC<BannerModalProps> = ({
  open,
  onOpenChange,
  bannersCount,
  onRefresh,
}) => {
  const [bannerForm, setBannerForm] = React.useState<BannerForm>({
    title: '',
    image_url: '',
    link: '',
    is_active: true
  });

  const resetForm = () => {
    setBannerForm({
      title: '',
      image_url: '',
      link: '',
      is_active: true
    });
  };

  const handleAddBanner = async () => {
    if (!bannerForm.title || !bannerForm.image_url) {
      toast.error('Please fill required fields');
      return;
    }
    
    await supabase.from('banners').insert({
      title: bannerForm.title,
      image_url: bannerForm.image_url,
      link: bannerForm.link || null,
      is_active: bannerForm.is_active,
      sort_order: bannersCount
    });
    
    toast.success('Banner added!');
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
          <DialogTitle>Add Banner</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input 
            placeholder="Banner Title *" 
            value={bannerForm.title} 
            onChange={(e) => setBannerForm({...bannerForm, title: e.target.value})} 
          />
          
          {/* Image Upload with Preview */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Banner Image *</label>
            <ImageUpload
              value={bannerForm.image_url}
              onChange={(url) => setBannerForm({...bannerForm, image_url: url})}
              placeholder="Enter image URL or drag & drop"
              previewHeight="h-28"
            />
          </div>
          
          <Input 
            placeholder="Link (Optional)" 
            value={bannerForm.link} 
            onChange={(e) => setBannerForm({...bannerForm, link: e.target.value})} 
          />
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={bannerForm.is_active} onCheckedChange={(v) => setBannerForm({...bannerForm, is_active: v})} />
          </div>
          <Button className="w-full btn-gradient" onClick={handleAddBanner}>Add Banner</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BannerModal;
