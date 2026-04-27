import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateRedeemCode } from './redeem-actions';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isEditing: boolean;
  code: string; setCode: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  usageLimit: string; setUsageLimit: (v: string) => void;
  isActive: boolean; setIsActive: (v: boolean) => void;
  expiresAt: string; setExpiresAt: (v: string) => void;
  onSave: () => void;
}

const RedeemCodeFormModal: React.FC<Props> = ({
  open, onOpenChange, isEditing,
  code, setCode, amount, setAmount, description, setDescription,
  usageLimit, setUsageLimit, isActive, setIsActive, expiresAt, setExpiresAt,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Redeem Code' : 'Create Redeem Code'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Code *</label>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. GIFT100" className="flex-1 font-mono" />
              <Button type="button" variant="outline" onClick={() => setCode(generateRedeemCode())}>
                Generate
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Amount (₹) *</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. New Year Gift" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Usage Limit</label>
            <Input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="1" />
            <p className="text-xs text-muted-foreground mt-1">
              How many users can redeem this code (each user can only redeem once)
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Expires At</label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Active</label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 btn-gradient" onClick={onSave}>
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RedeemCodeFormModal;
