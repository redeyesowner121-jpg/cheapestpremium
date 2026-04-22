import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X, IndianRupee, Tag, Users, BadgePercent, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface VariationItemProps {
  variation: {
    id: string;
    name: string;
    price: number;
    original_price?: number | null;
    reseller_price?: number | null;
    description?: string | null;
    delivery_message?: string | null;
  };
  onEdit: (id: string, data: { name: string; price: string; original_price: string; reseller_price: string; description: string; delivery_message: string }) => Promise<void>;
  onDelete: (id: string) => void;
  isPending?: boolean;
  usdRate?: number;
}

const VariationItem: React.FC<VariationItemProps> = ({ variation, onEdit, onDelete, isPending, usdRate = 70 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', original_price: '', reseller_price: '', description: '', delivery_message: '' });
  const [saving, setSaving] = useState(false);

  const [usdManual, setUsdManual] = useState({ price: false, original_price: false, reseller_price: false });
  const [usdValues, setUsdValues] = useState({ price: '', original_price: '', reseller_price: '' });

  // Auto-convert INR → USD when not manual
  useEffect(() => {
    if (!isEditing) return;
    const newUsd = { ...usdValues };
    if (!usdManual.price) newUsd.price = form.price ? (parseFloat(form.price) / usdRate).toFixed(2) : '';
    if (!usdManual.original_price) newUsd.original_price = form.original_price ? (parseFloat(form.original_price) / usdRate).toFixed(2) : '';
    if (!usdManual.reseller_price) newUsd.reseller_price = form.reseller_price ? (parseFloat(form.reseller_price) / usdRate).toFixed(2) : '';
    setUsdValues(newUsd);
  }, [form.price, form.original_price, form.reseller_price, usdRate, isEditing]);

  const startEdit = () => {
    setForm({
      name: variation.name,
      price: String(variation.price),
      original_price: variation.original_price ? String(variation.original_price) : '',
      reseller_price: variation.reseller_price ? String(variation.reseller_price) : '',
      description: variation.description || '',
      delivery_message: variation.delivery_message || '',
    });
    setUsdManual({ price: false, original_price: false, reseller_price: false });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onEdit(variation.id, form);
    setSaving(false);
    setIsEditing(false);
  };

  const handleInrChange = (field: 'price' | 'original_price' | 'reseller_price', val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
    setUsdManual(prev => ({ ...prev, [field]: false }));
  };

  const handleUsdChange = (field: 'price' | 'original_price' | 'reseller_price', val: string) => {
    setUsdManual(prev => ({ ...prev, [field]: true }));
    setUsdValues(prev => ({ ...prev, [field]: val }));
    setForm(prev => ({ ...prev, [field]: val ? (parseFloat(val) * usdRate).toFixed(0) : '' }));
  };

  const toggleLink = (field: 'price' | 'original_price' | 'reseller_price') => {
    if (usdManual[field]) {
      setUsdManual(prev => ({ ...prev, [field]: false }));
      setUsdValues(prev => ({
        ...prev,
        [field]: form[field] ? (parseFloat(form[field]) / usdRate).toFixed(2) : ''
      }));
    } else {
      setUsdManual(prev => ({ ...prev, [field]: true }));
    }
  };

  const discount = variation.original_price && variation.original_price > variation.price
    ? Math.round(((variation.original_price - variation.price) / variation.original_price) * 100)
    : null;

  const fields: { key: 'price' | 'original_price' | 'reseller_price'; label: string }[] = [
    { key: 'price', label: 'Price' },
    { key: 'original_price', label: 'Original' },
    { key: 'reseller_price', label: 'Reseller' },
  ];

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
            className="p-3 space-y-2"
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

            {fields.map(({ key, label }) => (
              <div key={key} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleLink(key)}
                    className={`p-0.5 rounded transition-colors ${usdManual[key] ? 'text-orange-500 hover:text-orange-600' : 'text-primary/40 hover:text-primary/60'}`}
                    title={usdManual[key] ? 'Manual — click to auto-convert' : 'Auto — click for manual'}
                  >
                    <Link2 className="w-3 h-3" />
                  </button>
                  {usdManual[key] && <span className="text-[9px] text-orange-500 font-medium">Manual</span>}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      placeholder={`₹ ${label}`}
                      value={form[key]}
                      onChange={(e) => handleInrChange(key, e.target.value)}
                      className="pl-6 h-8 rounded-xl text-xs border-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`$ ${label}`}
                      value={usdValues[key]}
                      onChange={(e) => handleUsdChange(key, e.target.value)}
                      className={`pl-6 h-8 rounded-xl text-xs ${usdManual[key] ? 'border-orange-400/50' : ''}`}
                    />
                  </div>
                </div>
              </div>
            ))}

            <p className="text-[9px] text-muted-foreground text-center">1 USD = ₹{usdRate} • Click 🔗 to toggle auto/manual</p>

            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs gap-1" onClick={() => setIsEditing(false)}>
                <X className="w-3 h-3" /> Cancel
              </Button>
              <Button size="sm" className="h-8 rounded-xl text-xs gap-1 bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving || !form.name || !form.price}>
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">New</span>
                )}
                {discount && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-bold">{discount}% OFF</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 ml-4 flex-wrap">
                <span className="text-sm font-bold text-primary">₹{variation.price}</span>
                <span className="text-[11px] text-muted-foreground">(${(variation.price / usdRate).toFixed(2)})</span>
                {variation.original_price && (
                  <span className="text-[11px] text-muted-foreground line-through">₹{variation.original_price}</span>
                )}
                {variation.reseller_price && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                    Reseller: ₹{variation.reseller_price}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1 shrink-0">
              {!isPending && (
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" onClick={startEdit}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => onDelete(variation.id)}>
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
