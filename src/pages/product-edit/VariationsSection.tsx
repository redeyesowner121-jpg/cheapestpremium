import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Check, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import VariationDelivery from './VariationDelivery';

interface Props {
  productId: string;
  variations: any[];
  usdRate: number;
  editingVarId: string | null;
  setEditingVarId: (id: string | null) => void;
  editVarForm: any;
  setEditVarForm: (v: any) => void;
  newVar: any;
  setNewVar: (v: any) => void;
  onUpdateVariation: () => void;
  onDeleteVariation: (id: string) => void;
  onAddVariation: () => void;
}

const VariationsSection: React.FC<Props> = ({
  productId, variations, usdRate,
  editingVarId, setEditingVarId, editVarForm, setEditVarForm,
  newVar, setNewVar,
  onUpdateVariation, onDeleteVariation, onAddVariation,
}) => (
  <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Layers className="w-4 h-4 text-primary" /> Variations
      <Badge variant="secondary" className="ml-auto">{variations.length}</Badge>
    </h2>

    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {variations.map(v => (
          <motion.div key={v.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-border bg-background">
            {editingVarId === v.id ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Pencil className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">Editing</span>
                </div>
                <Input placeholder="Name" value={editVarForm.name}
                  onChange={e => setEditVarForm({ ...editVarForm, name: e.target.value })} className="rounded-xl" />
                <p className="text-[10px] font-semibold text-muted-foreground">🇮🇳 INR (₹)</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="₹ Price" value={editVarForm.price}
                    onChange={e => setEditVarForm({ ...editVarForm, price: e.target.value })} className="rounded-xl" />
                  <Input type="number" placeholder="₹ Original" value={editVarForm.original_price}
                    onChange={e => setEditVarForm({ ...editVarForm, original_price: e.target.value })} className="rounded-xl" />
                  <Input type="number" placeholder="₹ Reseller" value={editVarForm.reseller_price}
                    onChange={e => setEditVarForm({ ...editVarForm, reseller_price: e.target.value })} className="rounded-xl" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground">🇺🇸 USD ($)</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" placeholder="$ Price"
                    value={editVarForm.price ? (parseFloat(editVarForm.price) / usdRate).toFixed(2) : ''}
                    onChange={e => setEditVarForm({ ...editVarForm, price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
                    className="rounded-xl" />
                  <Input type="number" step="0.01" placeholder="$ Original"
                    value={editVarForm.original_price ? (parseFloat(editVarForm.original_price) / usdRate).toFixed(2) : ''}
                    onChange={e => setEditVarForm({ ...editVarForm, original_price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
                    className="rounded-xl" />
                  <Input type="number" step="0.01" placeholder="$ Reseller"
                    value={editVarForm.reseller_price ? (parseFloat(editVarForm.reseller_price) / usdRate).toFixed(2) : ''}
                    onChange={e => setEditVarForm({ ...editVarForm, reseller_price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
                    className="rounded-xl" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingVarId(null)} className="rounded-xl">
                    <X className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={onUpdateVariation} className="rounded-xl">
                    <Check className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{v.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-sm font-bold text-primary">₹{v.price}</span>
                      <span className="text-xs text-muted-foreground">(${(v.price / usdRate).toFixed(2)})</span>
                      {v.original_price && <span className="text-xs text-muted-foreground line-through">₹{v.original_price}</span>}
                      {v.reseller_price && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">R: ₹{v.reseller_price}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => {
                      setEditingVarId(v.id);
                      setEditVarForm({
                        name: v.name, price: String(v.price),
                        original_price: v.original_price ? String(v.original_price) : '',
                        reseller_price: v.reseller_price ? String(v.reseller_price) : '',
                      });
                    }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                      onClick={() => onDeleteVariation(v.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <VariationDelivery variation={v} productId={productId} />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>

    <div className="rounded-xl border border-dashed border-primary/25 bg-primary/[0.02] p-4 space-y-3">
      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Variation
      </h4>
      <Input placeholder="Variation Name" value={newVar.name}
        onChange={e => setNewVar({ ...newVar, name: e.target.value })} className="rounded-xl" />
      <p className="text-[10px] font-semibold text-muted-foreground">🇮🇳 INR (₹)</p>
      <div className="grid grid-cols-3 gap-2">
        <Input type="number" placeholder="₹ Price" value={newVar.price}
          onChange={e => setNewVar({ ...newVar, price: e.target.value })} className="rounded-xl" />
        <Input type="number" placeholder="₹ Original" value={newVar.original_price}
          onChange={e => setNewVar({ ...newVar, original_price: e.target.value })} className="rounded-xl" />
        <Input type="number" placeholder="₹ Reseller" value={newVar.reseller_price}
          onChange={e => setNewVar({ ...newVar, reseller_price: e.target.value })} className="rounded-xl" />
      </div>
      <p className="text-[10px] font-semibold text-muted-foreground">🇺🇸 USD ($)</p>
      <div className="grid grid-cols-3 gap-2">
        <Input type="number" step="0.01" placeholder="$ Price"
          value={newVar.price ? (parseFloat(newVar.price) / usdRate).toFixed(2) : ''}
          onChange={e => setNewVar({ ...newVar, price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
          className="rounded-xl" />
        <Input type="number" step="0.01" placeholder="$ Original"
          value={newVar.original_price ? (parseFloat(newVar.original_price) / usdRate).toFixed(2) : ''}
          onChange={e => setNewVar({ ...newVar, original_price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
          className="rounded-xl" />
        <Input type="number" step="0.01" placeholder="$ Reseller"
          value={newVar.reseller_price ? (parseFloat(newVar.reseller_price) / usdRate).toFixed(2) : ''}
          onChange={e => setNewVar({ ...newVar, reseller_price: e.target.value ? (parseFloat(e.target.value) * usdRate).toFixed(0) : '' })}
          className="rounded-xl" />
      </div>
      <Button onClick={onAddVariation} disabled={!newVar.name || !newVar.price} className="w-full rounded-xl gap-1.5">
        <Plus className="w-4 h-4" /> Add Variation
      </Button>
    </div>
  </section>
);

export default VariationsSection;
