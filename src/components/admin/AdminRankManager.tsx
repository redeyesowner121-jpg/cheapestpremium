import React, { useState, useEffect } from 'react';
import { Award, Plus, Save, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RankTable, DISCOUNT_TYPES, ICON_OPTIONS, COLOR_OPTIONS, BG_COLOR_OPTIONS, Rank } from './rank';

const AdminRankManager: React.FC = () => {
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRank, setEditingRank] = useState<Rank | null>(null);
  const [formData, setFormData] = useState<Partial<Rank>>({
    name: '', min_balance: 0, discount_percent: 0, color: 'text-gray-500',
    bg_color: 'bg-gray-100', icon: '🏅', discount_type: 'percentage',
    reseller_discount_percent: 0, is_active: true,
  });

  const loadRanks = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ranks').select('*').order('sort_order', { ascending: true });
    if (error) { toast.error('Failed to load ranks'); } else { setRanks(data || []); }
    setLoading(false);
  };

  useEffect(() => { loadRanks(); }, []);

  const handleQuickUpdate = async (rankId: string, field: 'min_balance' | 'discount_percent', value: number) => {
    const { error } = await supabase.from('ranks').update({ [field]: value }).eq('id', rankId);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Updated!');
    loadRanks();
  };

  const handleOpenModal = (rank?: Rank) => {
    if (rank) { setEditingRank(rank); setFormData(rank); }
    else { setEditingRank(null); setFormData({ name: '', min_balance: 0, discount_percent: 0, color: 'text-gray-500', bg_color: 'bg-gray-100', icon: '🏅', discount_type: 'percentage', reseller_discount_percent: 0, is_active: true }); }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) { toast.error('Rank name is required'); return; }
    const rankData = { name: formData.name, min_balance: formData.min_balance || 0, discount_percent: formData.discount_percent || 0, color: formData.color || 'text-gray-500', bg_color: formData.bg_color || 'bg-gray-100', icon: formData.icon || '🏅', discount_type: formData.discount_type || 'percentage', reseller_discount_percent: formData.reseller_discount_percent || 0, is_active: formData.is_active ?? true, sort_order: editingRank ? editingRank.sort_order : ranks.length + 1 };
    if (editingRank) { const { error } = await supabase.from('ranks').update(rankData).eq('id', editingRank.id); if (error) { toast.error('Failed to update rank'); return; } toast.success('Rank updated!'); }
    else { const { error } = await supabase.from('ranks').insert(rankData); if (error) { toast.error('Failed to create rank'); return; } toast.success('Rank created!'); }
    setShowModal(false); loadRanks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rank?')) return;
    const { error } = await supabase.from('ranks').delete().eq('id', id);
    if (error) { toast.error('Failed to delete rank'); return; }
    toast.success('Rank deleted!'); loadRanks();
  };

  const handleMoveOrder = async (id: string, direction: 'up' | 'down') => {
    const index = ranks.findIndex(r => r.id === id); if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ranks.length) return;
    await Promise.all([
      supabase.from('ranks').update({ sort_order: newIndex + 1 }).eq('id', ranks[index].id),
      supabase.from('ranks').update({ sort_order: index + 1 }).eq('id', ranks[newIndex].id),
    ]);
    loadRanks();
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('ranks').update({ is_active: !isActive }).eq('id', id); loadRanks();
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Award className="w-5 h-5 text-primary" />Rank System</h3>
        <Button size="sm" onClick={() => handleOpenModal()}><Plus className="w-4 h-4 mr-1" />Add Rank</Button>
      </div>
      <RankTable ranks={ranks} onQuickUpdate={handleQuickUpdate} onMoveOrder={handleMoveOrder} onToggleActive={handleToggleActive} onEdit={handleOpenModal} onDelete={handleDelete} />
      {ranks.length === 0 && <p className="text-center text-muted-foreground py-8">No ranks configured. Add your first rank!</p>}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRank ? 'Edit Rank' : 'Add New Rank'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Rank Name *</label><Input placeholder="e.g., Gold" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Min Balance (₹) *</label><Input type="number" placeholder="0" value={formData.min_balance || ''} onChange={(e) => setFormData({ ...formData, min_balance: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Icon</label><div className="flex flex-wrap gap-2">{ICON_OPTIONS.map((icon) => (<button key={icon} type="button" onClick={() => setFormData({ ...formData, icon })} className={`text-xl p-2 rounded-lg transition-all ${formData.icon === icon ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}>{icon}</button>))}</div></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Discount Type *</label><Select value={formData.discount_type || 'percentage'} onValueChange={(value) => setFormData({ ...formData, discount_type: value })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{DISCOUNT_TYPES.map((type) => (<SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>))}</SelectContent></Select></div>
            {formData.discount_type === 'percentage' && <div><label className="text-xs text-muted-foreground mb-1 block">Discount Percentage (%)</label><Input type="number" step="0.1" placeholder="0" value={formData.discount_percent || ''} onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })} /></div>}
            {formData.discount_type === 'reseller_extra' && <div><label className="text-xs text-muted-foreground mb-1 block">Extra Discount on Reseller (%)</label><Input type="number" step="0.1" placeholder="0.5" value={formData.reseller_discount_percent || ''} onChange={(e) => setFormData({ ...formData, reseller_discount_percent: parseFloat(e.target.value) || 0 })} /><p className="text-xs text-muted-foreground mt-1">This will give reseller price minus {formData.reseller_discount_percent || 0}%</p></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Text Color</label><Select value={formData.color || 'text-gray-500'} onValueChange={(value) => setFormData({ ...formData, color: value })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{COLOR_OPTIONS.map((color) => (<SelectItem key={color.value} value={color.value}><span className={color.value}>{color.label}</span></SelectItem>))}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Background Color</label><Select value={formData.bg_color || 'bg-gray-100'} onValueChange={(value) => setFormData({ ...formData, bg_color: value })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{BG_COLOR_OPTIONS.map((color) => (<SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl"><span className="text-sm font-medium">Active</span><Switch checked={formData.is_active ?? true} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} /></div>
            <div className="p-4 border border-border rounded-xl"><p className="text-xs text-muted-foreground mb-2">Preview</p><div className={`flex items-center gap-3 p-3 rounded-xl ${formData.bg_color || 'bg-gray-100'}`}><span className="text-2xl">{formData.icon || '🏅'}</span><div><p className={`font-semibold ${formData.color || 'text-gray-500'}`}>{formData.name || 'Rank Name'}</p><p className="text-xs text-muted-foreground">Min: ₹{(formData.min_balance || 0).toLocaleString()}</p></div></div></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}><X className="w-4 h-4 mr-1" />Cancel</Button><Button className="flex-1 btn-gradient" onClick={handleSave}><Save className="w-4 h-4 mr-1" />{editingRank ? 'Update' : 'Create'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRankManager;
