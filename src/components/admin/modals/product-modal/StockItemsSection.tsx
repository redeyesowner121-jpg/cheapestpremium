import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface Props {
  editingProduct: any;
  deliveryType: 'link' | 'credentials';
  stockItems: any[];
  loadingStock: boolean;
  newStockLink: string;
  setNewStockLink: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

const StockItemsSection: React.FC<Props> = ({
  editingProduct, deliveryType, stockItems, loadingStock,
  newStockLink, setNewStockLink, onAdd, onDelete,
}) => {
  const availableStock = stockItems.filter(s => !s.is_used).length;
  const usedStock = stockItems.filter(s => s.is_used).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">📦 Available: {availableStock}</Badge>
        <Badge variant="outline" className="text-xs">✅ Used: {usedStock}</Badge>
      </div>
      {!editingProduct && (
        <p className="text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg">
          ⚠️ Save the product first, then add stock items
        </p>
      )}
      {editingProduct && (
        <>
          <div className="flex gap-2">
            <Textarea
              placeholder={deliveryType === 'credentials' ? 'ID: user | Password: pass' : 'https://link...'}
              value={newStockLink}
              onChange={(e) => setNewStockLink(e.target.value)}
              className="text-xs h-9 min-h-[36px] max-h-[36px] py-2 font-mono resize-none whitespace-nowrap overflow-x-auto"
              rows={1}
            />
            <Button size="sm" onClick={onAdd} className="shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          {loadingStock ? (
            <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
          ) : stockItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No stock items yet</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {stockItems.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${
                    item.is_used ? 'bg-muted/50 border-border opacity-60' : 'bg-background border-border'
                  }`}
                >
                  <span className="text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                  <span className="truncate flex-1 font-mono text-[11px]">{item.access_link}</span>
                  {item.is_used ? (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Used</Badge>
                  ) : (
                    <button onClick={() => onDelete(item.id)} className="text-destructive hover:text-destructive/80 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StockItemsSection;
