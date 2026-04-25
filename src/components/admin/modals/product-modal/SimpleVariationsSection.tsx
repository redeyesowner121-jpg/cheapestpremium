import React from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Variation } from './useProductForm';

interface Props {
  existingVariations: any[];
  pendingVariations: Variation[];
  newModalVariation: Variation;
  setNewModalVariation: (v: Variation) => void;
  editingVarId: string | null;
  setEditingVarId: (id: string | null) => void;
  editVarForm: Variation;
  setEditVarForm: (v: Variation) => void;
  onAdd: () => void;
  onDelete: (id: string, isExisting: boolean) => void;
  onUpdate: () => void;
  onStartEdit: (v: any) => void;
}

const SimpleVariationsSection: React.FC<Props> = (p) => (
  <>
    {p.existingVariations.length > 0 && (
      <div className="space-y-2 mb-3">
        {p.existingVariations.map((v) => (
          <div key={v.id} className="p-2 bg-muted rounded-xl">
            {p.editingVarId === v.id ? (
              <div className="space-y-2">
                <Input placeholder="Name" value={p.editVarForm.name}
                  onChange={(e) => p.setEditVarForm({ ...p.editVarForm, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Price" value={p.editVarForm.price}
                    onChange={(e) => p.setEditVarForm({ ...p.editVarForm, price: e.target.value })} />
                  <Input type="number" placeholder="Reseller" value={p.editVarForm.reseller_price}
                    onChange={(e) => p.setEditVarForm({ ...p.editVarForm, reseller_price: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => p.setEditingVarId(null)}>
                    <X className="w-3 h-3 mr-1" />Cancel
                  </Button>
                  <Button size="sm" onClick={p.onUpdate}><Check className="w-3 h-3 mr-1" />Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm">{v.name} - ₹{v.price} {v.reseller_price && `(R: ₹${v.reseller_price})`}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => p.onStartEdit(v)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => p.onDelete(v.id, true)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    {p.pendingVariations.length > 0 && (
      <div className="space-y-2 mb-3">
        {p.pendingVariations.map((v, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-accent/10 rounded-xl">
            <span className="text-sm">{v.name} - ₹{v.price} {v.reseller_price && `(R: ₹${v.reseller_price})`}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => p.onDelete(idx.toString(), false)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    )}

    <div className="grid grid-cols-2 gap-2">
      <Input placeholder="Name" value={p.newModalVariation.name}
        onChange={(e) => p.setNewModalVariation({ ...p.newModalVariation, name: e.target.value })} />
      <Input type="number" placeholder="Price" value={p.newModalVariation.price}
        onChange={(e) => p.setNewModalVariation({ ...p.newModalVariation, price: e.target.value })} />
    </div>
    <div className="flex gap-2 mt-2">
      <Input type="number" placeholder="Reseller Price" value={p.newModalVariation.reseller_price}
        onChange={(e) => p.setNewModalVariation({ ...p.newModalVariation, reseller_price: e.target.value })} />
      <Button onClick={p.onAdd}><Plus className="w-4 h-4 mr-1" />Add</Button>
    </div>
  </>
);

export default SimpleVariationsSection;
