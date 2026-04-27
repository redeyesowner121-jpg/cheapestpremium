import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RedeemCode } from './redeem-codes/types';
import {
  fetchRedeemCodes, saveRedeemCode, deleteRedeemCode, toggleRedeemActive
} from './redeem-codes/redeem-actions';
import RedeemCodeRow from './redeem-codes/RedeemCodeRow';
import RedeemCodeFormModal from './redeem-codes/RedeemCodeFormModal';

const AdminRedeemCodeManager: React.FC = () => {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCode | null>(null);

  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [usageLimit, setUsageLimit] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setCodes(await fetchRedeemCodes());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const resetForm = useCallback(() => {
    setCode(''); setAmount(''); setDescription('');
    setUsageLimit('1'); setIsActive(true); setExpiresAt('');
    setEditingCode(null);
  }, []);

  const openEditModal = (rc: RedeemCode) => {
    setEditingCode(rc);
    setCode(rc.code);
    setAmount(rc.amount.toString());
    setDescription(rc.description || '');
    setUsageLimit(rc.usage_limit.toString());
    setIsActive(rc.is_active);
    setExpiresAt(rc.expires_at ? rc.expires_at.split('T')[0] : '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !amount) return;
    const ok = await saveRedeemCode({
      code: code.trim().toUpperCase(),
      amount: parseFloat(amount),
      description: description.trim() || null,
      usage_limit: parseInt(usageLimit) || 1,
      is_active: isActive,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    }, editingCode?.id);
    if (ok) { setShowModal(false); resetForm(); reload(); }
  };

  const handleDelete = async (id: string) => {
    if (await deleteRedeemCode(id)) reload();
  };

  const handleToggle = async (rc: RedeemCode) => {
    if (await toggleRedeemActive(rc)) reload();
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
        <Button size="sm" onClick={() => { resetForm(); setShowModal(true); }} className="btn-gradient rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> Add Code
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Users can redeem these codes to add money directly to their wallet.
      </p>

      <div className="space-y-3">
        {codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No redeem codes yet. Create one to get started.
          </div>
        ) : (
          codes.map((rc) => (
            <RedeemCodeRow key={rc.id} redeemCode={rc}
              onEdit={openEditModal} onDelete={handleDelete} onToggle={handleToggle} />
          ))
        )}
      </div>

      <RedeemCodeFormModal
        open={showModal} onOpenChange={setShowModal}
        isEditing={!!editingCode}
        code={code} setCode={setCode}
        amount={amount} setAmount={setAmount}
        description={description} setDescription={setDescription}
        usageLimit={usageLimit} setUsageLimit={setUsageLimit}
        isActive={isActive} setIsActive={setIsActive}
        expiresAt={expiresAt} setExpiresAt={setExpiresAt}
        onSave={handleSave}
      />
    </div>
  );
};

export default AdminRedeemCodeManager;
