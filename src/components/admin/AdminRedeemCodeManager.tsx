import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gift, Plus, Edit, Trash2, Copy, Calendar, Users
} from 'lucide-react';
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

interface RedeemCode {
  id: string;
  code: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  usage_limit: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

const AdminRedeemCodeManager: React.FC = () => {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCode | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [usageLimit, setUsageLimit] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('redeem_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setCodes(data);
    setLoading(false);
  };

  const resetForm = useCallback(() => {
    setCode('');
    setAmount('');
    setDescription('');
    setUsageLimit('1');
    setIsActive(true);
    setExpiresAt('');
    setEditingCode(null);
  }, []);

  const openEditModal = (redeemCode: RedeemCode) => {
    setEditingCode(redeemCode);
    setCode(redeemCode.code);
    setAmount(redeemCode.amount.toString());
    setDescription(redeemCode.description || '');
    setUsageLimit(redeemCode.usage_limit.toString());
    setIsActive(redeemCode.is_active);
    setExpiresAt(redeemCode.expires_at ? redeemCode.expires_at.split('T')[0] : '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !amount) {
      toast.error('Code and amount are required');
      return;
    }

    const codeData = {
      code: code.trim().toUpperCase(),
      amount: parseFloat(amount),
      description: description.trim() || null,
      usage_limit: parseInt(usageLimit) || 1,
      is_active: isActive,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
    };

    if (editingCode) {
      const { error } = await supabase
        .from('redeem_codes')
        .update(codeData)
        .eq('id', editingCode.id);
      
      if (error) {
        toast.error('Failed to update code');
        return;
      }
      toast.success('Redeem code updated');
    } else {
      const { error } = await supabase
        .from('redeem_codes')
        .insert(codeData);
      
      if (error) {
        if (error.code === '23505') {
          toast.error('Code already exists');
        } else {
          toast.error('Failed to create code');
        }
        return;
      }
      toast.success('Redeem code created');
    }

    setShowModal(false);
    resetForm();
    loadCodes();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('redeem_codes')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete code');
      return;
    }
    
    toast.success('Code deleted');
    loadCodes();
  };

  const toggleActive = async (redeemCode: RedeemCode) => {
    const { error } = await supabase
      .from('redeem_codes')
      .update({ is_active: !redeemCode.is_active })
      .eq('id', redeemCode.id);
    
    if (!error) loadCodes();
  };

  const copyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    toast.success('Copied to clipboard');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'GIFT';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Gift className="w-5 h-5 text-success" />
          Redeem Codes
        </h3>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-gradient rounded-xl"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Code
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Users can redeem these codes to add money directly to their wallet.
      </p>

      {/* Codes List */}
      <div className="space-y-3">
        {codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No redeem codes yet. Create one to get started.
          </div>
        ) : (
          codes.map((redeemCode) => (
            <div
              key={redeemCode.id}
              className={`bg-card rounded-xl p-4 border ${
                redeemCode.is_active ? 'border-success/30' : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => copyCode(redeemCode.code)}
                      className="flex items-center gap-1 font-mono font-bold text-lg text-success bg-success/10 px-2 py-1 rounded-lg hover:bg-success/20 transition-colors"
                    >
                      {redeemCode.code}
                      <Copy className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-primary">
                      ₹{redeemCode.amount}
                    </span>
                  </div>
                  
                  {redeemCode.description && (
                    <p className="text-sm text-muted-foreground mt-1">{redeemCode.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {redeemCode.used_count}/{redeemCode.usage_limit} used
                    </span>
                    {redeemCode.expires_at && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires {new Date(redeemCode.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={redeemCode.is_active}
                    onCheckedChange={() => toggleActive(redeemCode)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(redeemCode)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(redeemCode.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? 'Edit Redeem Code' : 'Create Redeem Code'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Code *</label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GIFT100"
                  className="flex-1 font-mono"
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Amount (₹) *</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. New Year Gift"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Usage Limit</label>
              <Input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How many users can redeem this code (each user can only redeem once)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Expires At</label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Active</label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1 btn-gradient" onClick={handleSave}>
                {editingCode ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRedeemCodeManager;
