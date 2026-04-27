import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  product: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export const SeoTagsModal: React.FC<Props> = ({ product, onClose, onSaved }) => {
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTags(product?.seo_tags || ''); }, [product]);

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    const { error } = await supabase.from('products').update({ seo_tags: tags.trim() || null }).eq('id', product.id);
    setSaving(false);
    if (error) { toast.error('Failed to save SEO tags'); return; }
    toast.success('SEO tags updated!');
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SEO Tags - {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Enter tags separated by commas (e.g. netflix, premium, ott)</p>
          <Textarea value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2, tag3..." rows={3} />
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save SEO Tags'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
