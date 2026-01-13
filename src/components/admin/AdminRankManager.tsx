import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  ChevronUp, 
  ChevronDown,
  RefreshCw
} from 'lucide-react';
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

interface Rank {
  id: string;
  name: string;
  min_balance: number;
  discount_percent: number;
  color: string;
  bg_color: string;
  icon: string;
  discount_type: string;
  reseller_discount_percent: number;
  sort_order: number;
  is_active: boolean;
}

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage Discount' },
  { value: 'reseller', label: 'Reseller Price' },
  { value: 'reseller_extra', label: 'Reseller + Extra Discount' },
];

const ICON_OPTIONS = ['🥉', '🥈', '🥇', '💠', '💎', '🔮', '⚔️', '👑', '🏆', '⚡', '🌟', '🎖️', '🏅', '🎯'];

const COLOR_OPTIONS = [
  { value: 'text-amber-700', label: 'Amber' },
  { value: 'text-slate-500', label: 'Slate' },
  { value: 'text-yellow-600', label: 'Yellow' },
  { value: 'text-cyan-600', label: 'Cyan' },
  { value: 'text-blue-500', label: 'Blue' },
  { value: 'text-purple-500', label: 'Purple' },
  { value: 'text-red-500', label: 'Red' },
  { value: 'text-orange-500', label: 'Orange' },
  { value: 'text-pink-500', label: 'Pink' },
  { value: 'text-indigo-600', label: 'Indigo' },
  { value: 'text-green-500', label: 'Green' },
];

const BG_COLOR_OPTIONS = [
  { value: 'bg-amber-100', label: 'Amber' },
  { value: 'bg-slate-100', label: 'Slate' },
  { value: 'bg-yellow-100', label: 'Yellow' },
  { value: 'bg-cyan-100', label: 'Cyan' },
  { value: 'bg-blue-100', label: 'Blue' },
  { value: 'bg-purple-100', label: 'Purple' },
  { value: 'bg-red-100', label: 'Red' },
  { value: 'bg-orange-100', label: 'Orange' },
  { value: 'bg-pink-100', label: 'Pink' },
  { value: 'bg-indigo-100', label: 'Indigo' },
  { value: 'bg-green-100', label: 'Green' },
  { value: 'bg-gradient-to-r from-indigo-100 to-purple-100', label: 'Gradient' },
];

const AdminRankManager: React.FC = () => {
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRank, setEditingRank] = useState<Rank | null>(null);
  const [formData, setFormData] = useState<Partial<Rank>>({
    name: '',
    min_balance: 0,
    discount_percent: 0,
    color: 'text-gray-500',
    bg_color: 'bg-gray-100',
    icon: '🏅',
    discount_type: 'percentage',
    reseller_discount_percent: 0,
    is_active: true,
  });

  const loadRanks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ranks')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      toast.error('Failed to load ranks');
      console.error(error);
    } else {
      setRanks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRanks();
  }, []);

  const handleOpenModal = (rank?: Rank) => {
    if (rank) {
      setEditingRank(rank);
      setFormData(rank);
    } else {
      setEditingRank(null);
      setFormData({
        name: '',
        min_balance: 0,
        discount_percent: 0,
        color: 'text-gray-500',
        bg_color: 'bg-gray-100',
        icon: '🏅',
        discount_type: 'percentage',
        reseller_discount_percent: 0,
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Rank name is required');
      return;
    }

    const rankData = {
      name: formData.name,
      min_balance: formData.min_balance || 0,
      discount_percent: formData.discount_percent || 0,
      color: formData.color || 'text-gray-500',
      bg_color: formData.bg_color || 'bg-gray-100',
      icon: formData.icon || '🏅',
      discount_type: formData.discount_type || 'percentage',
      reseller_discount_percent: formData.reseller_discount_percent || 0,
      is_active: formData.is_active ?? true,
      sort_order: editingRank ? editingRank.sort_order : ranks.length + 1,
    };

    if (editingRank) {
      const { error } = await supabase
        .from('ranks')
        .update(rankData)
        .eq('id', editingRank.id);

      if (error) {
        toast.error('Failed to update rank');
        console.error(error);
        return;
      }
      toast.success('Rank updated!');
    } else {
      const { error } = await supabase.from('ranks').insert(rankData);

      if (error) {
        toast.error('Failed to create rank');
        console.error(error);
        return;
      }
      toast.success('Rank created!');
    }

    setShowModal(false);
    loadRanks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rank?')) return;

    const { error } = await supabase.from('ranks').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete rank');
      console.error(error);
      return;
    }
    toast.success('Rank deleted!');
    loadRanks();
  };

  const handleMoveOrder = async (id: string, direction: 'up' | 'down') => {
    const index = ranks.findIndex(r => r.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ranks.length) return;

    const swappedRank = ranks[newIndex];
    const currentRank = ranks[index];

    await Promise.all([
      supabase.from('ranks').update({ sort_order: newIndex + 1 }).eq('id', currentRank.id),
      supabase.from('ranks').update({ sort_order: index + 1 }).eq('id', swappedRank.id),
    ]);

    loadRanks();
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('ranks').update({ is_active: !isActive }).eq('id', id);
    loadRanks();
  };

  const getDiscountDescription = (rank: Rank): string => {
    switch (rank.discount_type) {
      case 'percentage':
        return `${rank.discount_percent}% discount`;
      case 'reseller':
        return 'Reseller price';
      case 'reseller_extra':
        return `Reseller -${rank.reseller_discount_percent}%`;
      default:
        return 'No discount';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Rank System
        </h3>
        <Button size="sm" onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-1" />
          Add Rank
        </Button>
      </div>

      <div className="space-y-2">
        {ranks.map((rank, index) => (
          <motion.div
            key={rank.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-xl ${rank.bg_color} ${!rank.is_active ? 'opacity-50' : ''}`}
          >
            <span className="text-2xl">{rank.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`font-semibold ${rank.color}`}>{rank.name}</p>
                {!rank.is_active && (
                  <span className="text-xs px-1.5 py-0.5 bg-muted rounded">Inactive</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Min: ₹{rank.min_balance.toLocaleString()} • {getDiscountDescription(rank)}
              </p>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleMoveOrder(rank.id, 'up')}
                disabled={index === 0}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleMoveOrder(rank.id, 'down')}
                disabled={index === ranks.length - 1}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Switch
                checked={rank.is_active}
                onCheckedChange={() => handleToggleActive(rank.id, rank.is_active)}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => handleOpenModal(rank)}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7"
                onClick={() => handleDelete(rank.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        ))}

        {ranks.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No ranks configured. Add your first rank!
          </p>
        )}
      </div>

      {/* Rank Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRank ? 'Edit Rank' : 'Add New Rank'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rank Name *</label>
                <Input
                  placeholder="e.g., Gold"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min Balance (₹) *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.min_balance || ''}
                  onChange={(e) => setFormData({ ...formData, min_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`text-xl p-2 rounded-lg transition-all ${
                      formData.icon === icon 
                        ? 'bg-primary/20 ring-2 ring-primary' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Discount Type *</label>
              <Select 
                value={formData.discount_type || 'percentage'} 
                onValueChange={(value: 'percentage' | 'reseller' | 'reseller_extra') => 
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.discount_type === 'percentage' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Discount Percentage (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={formData.discount_percent || ''}
                  onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {formData.discount_type === 'reseller_extra' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Extra Discount on Reseller (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0.5"
                  value={formData.reseller_discount_percent || ''}
                  onChange={(e) => setFormData({ ...formData, reseller_discount_percent: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will give reseller price minus {formData.reseller_discount_percent || 0}%
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Text Color</label>
                <Select 
                  value={formData.color || 'text-gray-500'} 
                  onValueChange={(value) => setFormData({ ...formData, color: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <span className={color.value}>{color.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Background Color</label>
                <Select 
                  value={formData.bg_color || 'bg-gray-100'} 
                  onValueChange={(value) => setFormData({ ...formData, bg_color: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BG_COLOR_OPTIONS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>{color.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
              <span className="text-sm font-medium">Active</span>
              <Switch
                checked={formData.is_active ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Preview */}
            <div className="p-4 border border-border rounded-xl">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${formData.bg_color || 'bg-gray-100'}`}>
                <span className="text-2xl">{formData.icon || '🏅'}</span>
                <div>
                  <p className={`font-semibold ${formData.color || 'text-gray-500'}`}>
                    {formData.name || 'Rank Name'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Min: ₹{(formData.min_balance || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button className="flex-1 btn-gradient" onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" />
                {editingRank ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRankManager;
