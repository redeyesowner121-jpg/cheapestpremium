import React from 'react';
import { ShoppingCart, Download, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { useAuth } from '@/contexts/AuthContext';
import { getUserRank, calculateFinalPrice } from '@/lib/ranks';
import { Product, ProductVariation } from './types';

interface ProductsBuyModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedProduct: Product | null;
  flashSalePrice: number | null;
  productVariations: ProductVariation[];
  selectedVariation: ProductVariation | null;
  onVariationSelect: (v: ProductVariation | null) => void;
  quantity: number;
  onQuantityChange: (q: number) => void;
  orderNote: string;
  onOrderNoteChange: (n: string) => void;
  onConfirmOrder: () => void;
}

const ProductsBuyModal: React.FC<ProductsBuyModalProps> = ({
  open, onOpenChange, selectedProduct, flashSalePrice,
  productVariations, selectedVariation, onVariationSelect,
  quantity, onQuantityChange, orderNote, onOrderNoteChange, onConfirmOrder
}) => {
  const { profile } = useAuth();
  const { formatPrice } = useCurrencyFormat();

  if (!selectedProduct) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Confirm Order</DialogTitle>
          <DialogDescription>Review your order before placing</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={selectedProduct.image_url || 'https://via.placeholder.com/80'}
              alt={selectedProduct.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div>
              <h3 className="font-semibold text-foreground">{selectedProduct.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
              <div className="mt-1">
                {flashSalePrice ? (
                  <div className="flex items-center gap-2">
                    <p className="text-primary font-bold">{formatPrice(flashSalePrice)} each</p>
                    <span className="text-xs text-muted-foreground line-through">{formatPrice(selectedProduct.original_price || selectedProduct.price)}</span>
                    <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">FLASH SALE</span>
                  </div>
                ) : (
                  (() => {
                    const userRank = getUserRank(profile?.rank_balance || 0);
                    const isReseller = profile?.is_reseller || false;
                    const { finalPrice, savings, discountType } = calculateFinalPrice(
                      selectedProduct.price,
                      selectedProduct.reseller_price || null,
                      userRank, isReseller
                    );
                    return (
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-primary font-bold">{formatPrice(finalPrice)} each</p>
                          {savings > 0 && <span className="text-xs text-muted-foreground line-through">{formatPrice(selectedProduct.price)}</span>}
                        </div>
                        {savings > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Tag className="w-3 h-3 text-green-600" />
                            <span className="text-xs text-green-600">{discountType}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
              {selectedProduct.access_link && (
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <Download className="w-3 h-3" /> Instant access after purchase
                </p>
              )}
            </div>
          </div>

          {productVariations.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Variation</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onVariationSelect(null)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${!selectedVariation ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Default - {formatPrice(flashSalePrice || selectedProduct.price)}
                </button>
                {productVariations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onVariationSelect(v)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${selectedVariation?.id === v.id ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                  >
                    {v.name} - {formatPrice(v.price)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <span className="font-medium text-foreground">Quantity</span>
            <div className="flex items-center gap-3">
              <button onClick={() => onQuantityChange(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg bg-card flex items-center justify-center font-bold">-</button>
              <span className="font-bold text-foreground w-8 text-center">{quantity}</span>
              <button onClick={() => onQuantityChange(quantity + 1)} className="w-8 h-8 rounded-lg bg-card flex items-center justify-center font-bold">+</button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Note for Admin (Optional)</label>
            <Textarea placeholder="Any special instructions, email for delivery, etc..." value={orderNote} onChange={(e) => onOrderNoteChange(e.target.value)} className="rounded-xl" rows={3} />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <span className="text-sm text-muted-foreground">Your Balance</span>
            <span className="font-bold text-foreground">{formatPrice(profile?.wallet_balance || 0)}</span>
          </div>

          <div className="flex items-center justify-between p-4 gradient-primary rounded-xl">
            <span className="font-medium text-primary-foreground">Total</span>
            <span className="text-2xl font-bold text-primary-foreground">
              {formatPrice((selectedVariation?.price || flashSalePrice || selectedProduct.price) * quantity)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {selectedProduct.access_link ? '✓ Instant access will be available after purchase' : '⏱ Processing may take up to 24 hours'}
          </p>

          <Button className="w-full h-12 btn-gradient rounded-xl" onClick={onConfirmOrder}>
            <ShoppingCart className="w-5 h-5 mr-2" /> Place Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductsBuyModal;
