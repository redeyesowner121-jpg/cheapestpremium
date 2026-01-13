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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FlashSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  onRefresh: () => void;
}

interface FlashSaleForm {
  product_id: string;
  sale_price: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const FlashSaleModal: React.FC<FlashSaleModalProps> = ({
  open,
  onOpenChange,
  products,
  onRefresh,
}) => {
  const [flashSaleForm, setFlashSaleForm] = React.useState<FlashSaleForm>({
    product_id: '',
    sale_price: '',
    start_time: '',
    end_time: '',
    is_active: true
  });

  const resetForm = () => {
    setFlashSaleForm({
      product_id: '',
      sale_price: '',
      start_time: '',
      end_time: '',
      is_active: true
    });
  };

  const handleAddFlashSale = async () => {
    if (!flashSaleForm.product_id || !flashSaleForm.sale_price || !flashSaleForm.end_time) {
      toast.error('Please fill required fields');
      return;
    }
    
    await supabase.from('flash_sales').insert({
      product_id: flashSaleForm.product_id,
      sale_price: parseFloat(flashSaleForm.sale_price),
      start_time: flashSaleForm.start_time || new Date().toISOString(),
      end_time: flashSaleForm.end_time,
      is_active: flashSaleForm.is_active
    });
    
    toast.success('Flash sale added!');
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
          <DialogTitle>Add Flash Sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <select
            className="w-full h-10 px-3 rounded-xl border border-input bg-background"
            value={flashSaleForm.product_id}
            onChange={(e) => setFlashSaleForm({...flashSaleForm, product_id: e.target.value})}
          >
            <option value="">Select Product *</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
            ))}
          </select>
          <Input 
            type="number" 
            placeholder="Sale Price *" 
            value={flashSaleForm.sale_price} 
            onChange={(e) => setFlashSaleForm({...flashSaleForm, sale_price: e.target.value})} 
          />
          <div>
            <label className="text-xs text-muted-foreground">End Time *</label>
            <Input 
              type="datetime-local" 
              value={flashSaleForm.end_time} 
              onChange={(e) => setFlashSaleForm({...flashSaleForm, end_time: e.target.value})} 
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={flashSaleForm.is_active} onCheckedChange={(v) => setFlashSaleForm({...flashSaleForm, is_active: v})} />
          </div>
          <Button className="w-full btn-gradient" onClick={handleAddFlashSale}>Add Flash Sale</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlashSaleModal;
