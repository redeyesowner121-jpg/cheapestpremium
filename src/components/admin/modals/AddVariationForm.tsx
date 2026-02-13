import React from 'react';
import { Plus, IndianRupee, Tag, Users, BadgePercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddVariationFormProps {
  value: { name: string; price: string; original_price: string; reseller_price: string };
  onChange: (v: { name: string; price: string; original_price: string; reseller_price: string }) => void;
  onAdd: () => void;
}

const AddVariationForm: React.FC<AddVariationFormProps> = ({ value, onChange, onAdd }) => {
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
      <div className="grid grid-cols-3 gap-2">
        <div className="relative">
          <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Price"
            value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
            className="pl-8 h-9 rounded-xl text-sm"
          />
        </div>
        <div className="relative">
          <BadgePercent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Original"
            value={value.original_price}
            onChange={(e) => onChange({ ...value, original_price: e.target.value })}
            className="pl-8 h-9 rounded-xl text-sm"
          />
        </div>
        <div className="relative">
          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Reseller"
            value={value.reseller_price}
            onChange={(e) => onChange({ ...value, reseller_price: e.target.value })}
            className="pl-8 h-9 rounded-xl text-sm"
          />
        </div>
      </div>
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
