import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FlashSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  onRefresh: () => void;
}

interface FlashSaleForm {
  product_id: string;
  variation_id: string;
  sale_price: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Variation {
  id: string;
  name: string;
  price: number;
  reseller_price: number | null;
}

const FlashSaleModal: React.FC<FlashSaleModalProps> = ({
  open,
  onOpenChange,
  products,
  onRefresh,
}) => {
  const [flashSaleForm, setFlashSaleForm] = React.useState<FlashSaleForm>({
    product_id: '',
    variation_id: '',
    sale_price: '',
    start_time: '',
    end_time: '',
    is_active: true
  });
  const [variations, setVariations] = React.useState<Variation[]>([]);
  const [loadingVariations, setLoadingVariations] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState('');
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const resetForm = () => {
    setFlashSaleForm({
      product_id: '',
      variation_id: '',
      sale_price: '',
      start_time: '',
      end_time: '',
      is_active: true
    });
    setVariations([]);
    setProductSearch('');
    setShowDropdown(false);
  };

  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
  }, [products, productSearch]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductChange = async (productId: string) => {
    setFlashSaleForm(prev => ({ ...prev, product_id: productId, variation_id: '', sale_price: '' }));
    setVariations([]);

    if (!productId) return;

    setLoadingVariations(true);
    const { data } = await supabase
      .from('product_variations')
      .select('id, name, price, reseller_price')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    setVariations(data || []);
    setLoadingVariations(false);
  };

  const handleVariationChange = (variationId: string) => {
    setFlashSaleForm(prev => ({ ...prev, variation_id: variationId }));
    if (variationId) {
      const variation = variations.find(v => v.id === variationId);
      if (variation && !flashSaleForm.sale_price) {
        // Auto-suggest a discounted price
      }
    }
  };

  const handleAddFlashSale = async () => {
    if (!flashSaleForm.product_id || !flashSaleForm.sale_price || !flashSaleForm.end_time) {
      toast.error('Please fill required fields');
      return;
    }

    // Get variation name for denormalized storage
    let variationName: string | null = null;
    if (flashSaleForm.variation_id) {
      const v = variations.find(v => v.id === flashSaleForm.variation_id);
      variationName = v?.name || null;
    }
    
    await supabase.from('flash_sales').insert({
      product_id: flashSaleForm.product_id,
      variation_id: flashSaleForm.variation_id || null,
      variation_name: variationName,
      sale_price: parseFloat(flashSaleForm.sale_price),
      start_time: flashSaleForm.start_time || new Date().toISOString(),
      end_time: flashSaleForm.end_time,
      is_active: flashSaleForm.is_active
    });
    
    toast.success('Flash sale added!');
    resetForm();
    onOpenChange(false);
    onRefresh();
  };

  const selectedProduct = products.find(p => p.id === flashSaleForm.product_id);
  const selectedVariation = variations.find(v => v.id === flashSaleForm.variation_id);
  const originalPrice = selectedVariation?.price ?? selectedProduct?.price;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add Flash Sale</DialogTitle>
          <DialogDescription>Create a time-limited flash sale for a product</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Searchable Product Selector */}
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search product... *"
                value={flashSaleForm.product_id ? (products.find(p => p.id === flashSaleForm.product_id)?.name || productSearch) : productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowDropdown(true);
                  if (flashSaleForm.product_id) {
                    handleProductChange('');
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-9 rounded-xl"
              />
            </div>
            {showDropdown && (
              <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-input bg-popover shadow-lg">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">No products found</p>
                ) : (
                  filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${flashSaleForm.product_id === p.id ? 'bg-accent font-medium' : ''}`}
                      onClick={() => {
                        handleProductChange(p.id);
                        setProductSearch(p.name);
                        setShowDropdown(false);
                      }}
                    >
                      {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                      <div className="min-w-0">
                        <p className="truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">₹{p.price} · {p.category}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Variation Selector - Only show if product has variations */}
          {flashSaleForm.product_id && (
            <div className="space-y-1">
              {loadingVariations ? (
                <p className="text-xs text-muted-foreground px-1">Loading variations...</p>
              ) : variations.length > 0 ? (
                <>
                  <label className="text-xs font-medium text-foreground px-1">Select Variation (Optional)</label>
                  <select
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                    value={flashSaleForm.variation_id}
                    onChange={(e) => handleVariationChange(e.target.value)}
                  >
                    <option value="">Main Product (₹{selectedProduct?.price})</option>
                    {variations.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} (₹{v.price})
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-xs text-muted-foreground px-1">No variations for this product</p>
              )}
            </div>
          )}

          {/* Show original price context */}
          {originalPrice && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground">Original Price:</span>
              <span className="text-sm font-semibold text-foreground">₹{originalPrice}</span>
            </div>
          )}

          <Input 
            type="number" 
            placeholder="Sale Price *" 
            value={flashSaleForm.sale_price} 
            onChange={(e) => setFlashSaleForm({...flashSaleForm, sale_price: e.target.value})} 
          />
          <div>
            <label className="text-xs text-muted-foreground">End Time *</label>
            <Input 
              type="datetime-local" 
              value={flashSaleForm.end_time} 
              onChange={(e) => setFlashSaleForm({...flashSaleForm, end_time: e.target.value})} 
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Switch checked={flashSaleForm.is_active} onCheckedChange={(v) => setFlashSaleForm({...flashSaleForm, is_active: v})} />
          </div>
          <Button className="w-full btn-gradient" onClick={handleAddFlashSale}>Add Flash Sale</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlashSaleModal;
