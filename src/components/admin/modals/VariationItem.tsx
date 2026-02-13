import React, { useState } from 'react';
import { Pencil, Trash2, Check, X, IndianRupee, Tag, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface VariationItemProps {
  variation: {
    id: string;
    name: string;
    price: number;
    reseller_price?: number | null;
  };
  onEdit: (id: string, data: { name: string; price: string; reseller_price: string }) => Promise<void>;
  onDelete: (id: string) => void;
  isPending?: boolean;
}

const VariationItem: React.FC<VariationItemProps> = ({ variation, onEdit, onDelete, isPending }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', reseller_price: '' });
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setForm({
      name: variation.name,
      price: String(variation.price),
      reseller_price: variation.reseller_price ? String(variation.reseller_price) : '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onEdit(variation.id, form);
    setSaving(false);
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border transition-all duration-200 ${
        isEditing
          ? 'border-primary/30 bg-primary/5 shadow-sm'
          : isPending
            ? 'border-accent/30 bg-accent/5'
            : 'border-border bg-card hover:border-primary/20 hover:shadow-sm'
      }`}
    >
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3 space-y-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Pencil className="w-2.5 h-2.5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Editing</span>
            </div>

            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Variation Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="pl-8 h-9 rounded-xl text-sm border-primary/20 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Price"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="pl-8 h-9 rounded-xl text-sm border-primary/20 focus:border-primary"
                />
              </div>
              <div className="relative">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Reseller"
                  value={form.reseller_price}
                  onChange={(e) => setForm({ ...form, reseller_price: e.target.value })}
                  className="pl-8 h-9 rounded-xl text-sm border-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-xl text-xs gap-1"
                onClick={() => setIsEditing(false)}
              >
                <X className="w-3 h-3" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-xl text-xs gap-1 bg-primary hover:bg-primary/90"
                onClick={handleSave}
                disabled={saving || !form.name || !form.price}
              >
                <Check className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3 flex items-center justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isPending ? 'bg-accent' : 'bg-primary'}`} />
                <p className="text-sm font-semibold text-foreground truncate">{variation.name}</p>
                {isPending && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                    New
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 ml-4">
                <span className="text-sm font-bold text-primary">₹{variation.price}</span>
                {variation.reseller_price && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                    Reseller: ₹{variation.reseller_price}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1 shrink-0">
              {!isPending && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={startEdit}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => onDelete(variation.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VariationItem;
