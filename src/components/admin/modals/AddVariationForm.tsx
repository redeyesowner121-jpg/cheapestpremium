import React, { useState, useEffect } from 'react';
import { Plus, IndianRupee, DollarSign, Tag, Users, BadgePercent, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddVariationFormProps {
  value: { name: string; price: string; original_price: string; reseller_price: string };
  onChange: (v: { name: string; price: string; original_price: string; reseller_price: string }) => void;
  onAdd: () => void;
  usdRate?: number;
}

const AddVariationForm: React.FC<AddVariationFormProps> = ({ value, onChange, onAdd, usdRate = 70 }) => {
  // Track whether USD fields are manually set (unlinked from auto-convert)
  const [usdManual, setUsdManual] = useState({ price: false, original_price: false, reseller_price: false });
  const [usdValues, setUsdValues] = useState({ price: '', original_price: '', reseller_price: '' });

  // Auto-convert INR → USD when INR changes and not manually overridden
  useEffect(() => {
    const newUsd = { ...usdValues };
    if (!usdManual.price) newUsd.price = value.price ? (parseFloat(value.price) / usdRate).toFixed(2) : '';
    if (!usdManual.original_price) newUsd.original_price = value.original_price ? (parseFloat(value.original_price) / usdRate).toFixed(2) : '';
    if (!usdManual.reseller_price) newUsd.reseller_price = value.reseller_price ? (parseFloat(value.reseller_price) / usdRate).toFixed(2) : '';
    setUsdValues(newUsd);
  }, [value.price, value.original_price, value.reseller_price, usdRate]);

  const handleInrChange = (field: 'price' | 'original_price' | 'reseller_price', val: string) => {
    onChange({ ...value, [field]: val });
    // Reset manual USD override when INR is typed
    setUsdManual(prev => ({ ...prev, [field]: false }));
  };

  const handleUsdChange = (field: 'price' | 'original_price' | 'reseller_price', val: string) => {
    setUsdManual(prev => ({ ...prev, [field]: true }));
    setUsdValues(prev => ({ ...prev, [field]: val }));
    // Auto-convert USD → INR
    onChange({ ...value, [field]: val ? (parseFloat(val) * usdRate).toFixed(0) : '' });
  };

  const toggleLink = (field: 'price' | 'original_price' | 'reseller_price') => {
    if (usdManual[field]) {
      // Re-link: reset to auto-convert
      setUsdManual(prev => ({ ...prev, [field]: false }));
      setUsdValues(prev => ({
        ...prev,
        [field]: value[field] ? (parseFloat(value[field]) / usdRate).toFixed(2) : ''
      }));
    } else {
      // Unlink: allow manual USD
      setUsdManual(prev => ({ ...prev, [field]: true }));
    }
  };

  const fields: { key: 'price' | 'original_price' | 'reseller_price'; label: string; icon: any }[] = [
    { key: 'price', label: 'Price', icon: IndianRupee },
    { key: 'original_price', label: 'Original', icon: BadgePercent },
    { key: 'reseller_price', label: 'Reseller', icon: Users },
  ];

  return (
    <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.02] p-3 space-y-2.5">
      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        Add Variation
      </h4>
      <div className="relative">
        <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Variation Name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="pl-8 h-9 rounded-xl text-sm"
        />
      </div>

      {fields.map(({ key, label, icon: Icon }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
            <button
              type="button"
              onClick={() => toggleLink(key)}
              className={`p-0.5 rounded transition-colors ${usdManual[key] ? 'text-orange-500 hover:text-orange-600' : 'text-primary/40 hover:text-primary/60'}`}
              title={usdManual[key] ? 'Manual mode — click to auto-convert' : 'Auto-convert — click to set manually'}
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
                value={value[key]}
                onChange={(e) => handleInrChange(key, e.target.value)}
                className="pl-6 h-8 rounded-xl text-xs"
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

      <Button
        onClick={onAdd}
        disabled={!value.name || !value.price}
        className="w-full h-9 rounded-xl text-sm gap-1.5 bg-primary hover:bg-primary/90"
      >
        <Plus className="w-4 h-4" />
        Add Variation
      </Button>
    </div>
  );
};

export default AddVariationForm;
