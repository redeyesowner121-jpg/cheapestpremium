import React from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  products: any[];
  giveawayProducts: any[];
  variations: any[];
  selectedProduct: string;
  selectedVariation: string;
  pointsRequired: string;
  stock: string;
  productSearch: string;
  productDropdownOpen: boolean;
  filteredProducts: any[];
  selectedProductName: string;
  onSelectedProductChange: (id: string) => void;
  onSelectedVariationChange: (id: string) => void;
  onPointsRequiredChange: (v: string) => void;
  onStockChange: (v: string) => void;
  onProductSearchChange: (v: string) => void;
  onProductDropdownOpenChange: (v: boolean) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
}

export const ProductsTab: React.FC<Props> = ({
  giveawayProducts, variations, selectedProduct, selectedVariation,
  pointsRequired, stock, productSearch, productDropdownOpen, filteredProducts,
  selectedProductName, onSelectedProductChange, onSelectedVariationChange,
  onPointsRequiredChange, onStockChange, onProductSearchChange,
  onProductDropdownOpenChange, onAdd, onRemove, onToggleActive,
}) => (
  <div className="space-y-3">
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <h4 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Add Giveaway Product</h4>
      <Popover open={productDropdownOpen} onOpenChange={onProductDropdownOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full rounded-xl justify-between font-normal">
            {selectedProductName || 'Select Product'}<Search className="w-4 h-4 ml-2 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-2 max-h-72" align="start">
          <Input placeholder="Search..." value={productSearch} onChange={e => onProductSearchChange(e.target.value)} className="rounded-lg mb-2" autoFocus />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredProducts.map(p => (
              <button key={p.id} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent flex items-center gap-2 ${selectedProduct === p.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                onClick={() => { onSelectedProductChange(p.id); onProductDropdownOpenChange(false); onProductSearchChange(''); }}>
                {p.image_url && <img src={p.image_url} className="w-6 h-6 rounded object-cover" alt="" />}
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {variations.length > 0 && (
        <Select value={selectedVariation} onValueChange={onSelectedVariationChange}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Variation (Optional)" /></SelectTrigger>
          <SelectContent>{variations.map(v => <SelectItem key={v.id} value={v.id}>{v.name} - ₹{v.price}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Points" value={pointsRequired} onChange={e => onPointsRequiredChange(e.target.value)} className="rounded-xl" />
        <Input type="number" placeholder="Stock (∞)" value={stock} onChange={e => onStockChange(e.target.value)} className="rounded-xl" />
      </div>
      <Button className="w-full rounded-xl" onClick={onAdd}><Plus className="w-4 h-4 mr-2" /> Add</Button>
    </div>

    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      <h4 className="font-semibold mb-2">Products ({giveawayProducts.length})</h4>
      {giveawayProducts.map(gp => (
        <div key={gp.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
          <div className="flex-1">
            <p className="text-sm font-medium">{gp.product?.name || '?'}{gp.variation?.name && ` • ${gp.variation.name}`}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">🎯 {gp.points_required} pts</Badge>
              <Badge variant="outline" className="text-xs">📦 {gp.stock ?? '∞'}</Badge>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onToggleActive(gp.id, gp.is_active)} className="rounded-lg">
            {gp.is_active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive rounded-lg" onClick={() => onRemove(gp.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  </div>
);
