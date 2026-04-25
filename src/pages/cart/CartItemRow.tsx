import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, Package } from 'lucide-react';
import { calculateFinalPrice } from '@/lib/ranks';

interface Props {
  item: any;
  userRank: any;
  isReseller: boolean;
  formatPrice: (n: number) => string;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
}

const CartItemRow: React.FC<Props> = ({ item, userRank, isReseller, formatPrice, updateQuantity, removeItem }) => {
  const navigate = useNavigate();
  const basePrice = item.variation?.price || item.product?.price || 0;
  const resellerPrice = item.variation?.reseller_price || item.product?.reseller_price || null;
  const { finalPrice } = calculateFinalPrice(basePrice, resellerPrice, userRank, isReseller);
  const variationIsRepeated = (item.variation as any)?.delivery_mode === 'repeated';
  const isOutOfStock = !variationIsRepeated && item.product?.stock !== null && item.product?.stock !== undefined && item.product.stock <= 0;

  return (
    <div className={`bg-card rounded-2xl p-4 shadow-card ${isOutOfStock ? 'opacity-60' : ''}`}>
      <div className="flex gap-3">
        <img
          src={item.product?.image_url || 'https://via.placeholder.com/80'}
          alt={item.product?.name}
          className="w-20 h-20 rounded-xl object-cover"
          onClick={() => navigate(`/product/${item.product_id}`)}
        />
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-sm truncate cursor-pointer"
            onClick={() => navigate(`/product/${item.product_id}`)}
          >
            {item.product?.name}
          </h3>
          {item.variation && (
            <p className="text-xs text-muted-foreground">{item.variation.name}</p>
          )}
          {isOutOfStock && (
            <span className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
              <Package className="w-3 h-3" /> Out of stock
            </span>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-primary font-bold">
              {formatPrice(finalPrice * item.quantity)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-90"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-90"
                disabled={item.product?.stock !== null && item.product?.stock !== undefined && item.quantity >= item.product.stock}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => removeItem(item.id)}
                className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center active:scale-90 ml-1"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItemRow;
