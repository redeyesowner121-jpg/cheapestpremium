import React from 'react';
import { Repeat, Link } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AnimatePresence } from 'framer-motion';
import VariationItem from '../VariationItem';
import VariationDeliveryManager from '../VariationDeliveryManager';

interface Props {
  editingProduct: any;
  existingVariations: any[];
  pendingVariations: any[];
  onEditVariation: (id: string, data: any) => Promise<void>;
  onDeleteVariation: (id: string) => void;
  onDeletePending: (idx: string) => void;
  updatePendingVariation: (index: number, updates: Record<string, any>) => void;
}

const VariationsList: React.FC<Props> = ({
  editingProduct, existingVariations, pendingVariations,
  onEditVariation, onDeleteVariation, onDeletePending, updatePendingVariation,
}) => (
  <div className="space-y-2 mb-3">
    <AnimatePresence mode="popLayout">
      {existingVariations.map((v) => (
        <div key={v.id}>
          <VariationItem variation={v} onEdit={onEditVariation} onDelete={onDeleteVariation} />
          <VariationDeliveryManager variation={{ ...v, product_id: editingProduct?.id }} />
        </div>
      ))}
      {pendingVariations.map((v, idx) => (
        <div key={`pending-${idx}`}>
          <VariationItem
            variation={{
              id: idx.toString(),
              name: v.name,
              price: parseFloat(v.price) || 0,
              original_price: v.original_price ? parseFloat(v.original_price) : null,
              reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null,
            }}
            onEdit={async () => {}}
            onDelete={onDeletePending}
            isPending
          />
          <div className="ml-4 mt-1.5 mb-1 border-l-2 border-primary/15 pl-3">
            <div className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Repeat className={`w-3 h-3 shrink-0 ${v.delivery_mode === 'unique' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {v.delivery_mode === 'unique' ? 'Auto Delivery' : 'Repeated Link'}
                </span>
              </div>
              <Switch
                checked={v.delivery_mode === 'unique'}
                onCheckedChange={(checked) => updatePendingVariation(idx, { delivery_mode: checked ? 'unique' : 'repeated' })}
                className="scale-75"
              />
            </div>
            {v.delivery_mode === 'unique' ? (
              <p className="pt-2 text-[10px] text-muted-foreground">Save the product first to add unique stock for this variation.</p>
            ) : (
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Link className="w-3 h-3" />
                  <span>Same link/credentials sent to every buyer</span>
                </div>
                <Textarea
                  placeholder="https://... or Email|Password"
                  value={v.access_link || ''}
                  onChange={(e) => updatePendingVariation(idx, { access_link: e.target.value })}
                  className="text-[11px] min-h-[50px] py-1.5 font-mono resize-none"
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </AnimatePresence>
  </div>
);

export default VariationsList;
